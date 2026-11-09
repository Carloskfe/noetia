import { Reflector } from '@nestjs/core';
import { IntelligenceDenied } from '../../../../src/knowledge/common/intelligence-denied.error';
import { CAPABILITY_METADATA, CapabilityGuard } from '../../../../src/knowledge/entitlement/capability.guard';
import { USER_A } from '../support/fixtures';

function ctx(user: unknown) {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('CapabilityGuard', () => {
  const resolve = jest.fn();
  let reflector: Reflector;
  let guard: CapabilityGuard;

  beforeEach(() => {
    resolve.mockReset();
    reflector = new Reflector();
    guard = new CapabilityGuard(reflector, { resolve } as any);
  });

  it('fails closed when a route declares no capability', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(ctx({ id: USER_A }))).rejects.toBeInstanceOf(IntelligenceDenied);
  });

  it('denies when there is no authenticated user', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ capability: 'research_session', access: 'use' });
    await expect(guard.canActivate(ctx(undefined))).rejects.toMatchObject({ reason: 'no_entitlement' });
  });

  it('history access does not require entitlement', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ capability: 'research_session', access: 'history' });
    await expect(guard.canActivate(ctx({ id: USER_A }))).resolves.toBe(true);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('use access passes when the resolver allows', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ capability: 'research_session', access: 'use' });
    resolve.mockResolvedValue({ allowed: true });
    await expect(guard.canActivate(ctx({ id: USER_A }))).resolves.toBe(true);
    expect(resolve).toHaveBeenCalledWith(USER_A, 'research_session');
  });

  it('use access surfaces the resolver denial reason', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ capability: 'research_session', access: 'use' });
    resolve.mockResolvedValue({ allowed: false, reason: 'prerequisite_missing' });
    await expect(guard.canActivate(ctx({ id: USER_A }))).rejects.toMatchObject({ reason: 'prerequisite_missing' });
  });

  it('exposes a stable metadata key', () => {
    expect(CAPABILITY_METADATA).toBe('knowledge:capability');
  });
});
