/** SP-1-I1 — controller contract and route-level throttle (existing @nestjs/throttler). */
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerGuard, ThrottlerStorageService } from '@nestjs/throttler';
import { THROTTLER_LIMIT, THROTTLER_TRACKER, THROTTLER_TTL } from '@nestjs/throttler/dist/throttler.constants';
import { PushController } from '../../../src/push/push.controller';
import { PUSH_REGISTER_THROTTLE, pushRegisterTracker } from '../../../src/push/push-register.throttle';

describe('PushController (SP-1-I1)', () => {
  it('passes the validated token and the existing default platform to the service', async () => {
    const svc = { registerToken: jest.fn().mockResolvedValue(undefined) };
    const ctrl = new PushController(svc as any);
    await ctrl.register({ user: { id: 'u1' } }, { token: 'ExponentPushToken[abc]' });
    expect(svc.registerToken).toHaveBeenCalledWith('u1', 'ExponentPushToken[abc]', 'unknown');
    await ctrl.register({ user: { id: 'u1' } }, { token: 'ExponentPushToken[abc]', platform: 'android' });
    expect(svc.registerToken).toHaveBeenLastCalledWith('u1', 'ExponentPushToken[abc]', 'android');
  });

  it('14. route throttle metadata targets the app\'s "global" throttler (10 / 60 s, per-session tracker)', () => {
    const handler = PushController.prototype.register;
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'global', handler)).toBe(10);
    expect(Reflect.getMetadata(THROTTLER_TTL + 'global', handler)).toBe(60_000);
    expect(Reflect.getMetadata(THROTTLER_TRACKER + 'global', handler)).toBe(pushRegisterTracker);
    expect(Reflect.getMetadata(THROTTLER_LIMIT + 'default', handler)).toBeUndefined();
  });

  describe('14. enforced by the real ThrottlerGuard with the app configuration', () => {
    async function makeGuard() {
      const guard = new ThrottlerGuard(
        [{ name: 'global', ttl: 60_000, limit: 120 }] as any, // app.module.ts
        new ThrottlerStorageService(),
        new Reflector(),
      );
      await guard.onModuleInit();
      return guard;
    }
    function ctx(req: Record<string, unknown>): ExecutionContext {
      const res = { header: jest.fn() };
      return {
        getHandler: () => PushController.prototype.register,
        getClass: () => PushController,
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
        getType: () => 'http',
      } as unknown as ExecutionContext;
    }

    it('allows 10 registrations per session per minute, then rejects the 11th (429)', async () => {
      const guard = await makeGuard();
      const req = { ip: '10.0.0.1', headers: { authorization: 'Bearer session-one' } };
      for (let i = 0; i < PUSH_REGISTER_THROTTLE.limit; i++) await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
      await expect(guard.canActivate(ctx(req))).rejects.toBeInstanceOf(ThrottlerException);
    });

    it('different sessions behind the same proxy IP have independent buckets', async () => {
      const guard = await makeGuard();
      const a = { ip: '172.18.0.2', headers: { authorization: 'Bearer session-A' } };
      const b = { ip: '172.18.0.2', headers: { authorization: 'Bearer session-B' } };
      for (let i = 0; i < 10; i++) await guard.canActivate(ctx(a));
      await expect(guard.canActivate(ctx(a))).rejects.toBeInstanceOf(ThrottlerException);
      await expect(guard.canActivate(ctx(b))).resolves.toBe(true);
    });
  });
});

describe('pushRegisterTracker', () => {
  it('hashes the bearer (never returns it) and is stable per session', () => {
    const t1 = pushRegisterTracker({ headers: { authorization: 'Bearer abc.def.ghi' }, ip: '1.1.1.1' });
    expect(t1).toMatch(/^push-register:[0-9a-f]{32}$/);
    expect(t1).not.toContain('abc.def.ghi');
    expect(pushRegisterTracker({ headers: { authorization: 'Bearer abc.def.ghi' }, ip: '2.2.2.2' })).toBe(t1);
    expect(pushRegisterTracker({ headers: { authorization: 'Bearer other' } })).not.toBe(t1);
  });

  it('falls back to the client address without a bearer', () => {
    expect(pushRegisterTracker({ headers: {}, ip: '9.9.9.9' })).toBe('9.9.9.9');
    expect(pushRegisterTracker({ headers: { authorization: 'Basic x' }, ip: '9.9.9.9' })).toBe('9.9.9.9');
    expect(pushRegisterTracker({ headers: { authorization: 'Bearer ' } })).toBe('unknown');
  });
});
