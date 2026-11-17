// G1-I1 Checkpoint IV disposable harness — upstream standing in for the Noetia API (or another app's upstream).
// Uses the REAL trusted-proxy code (services/api/src/common/trusted-proxy.ts, the same call as main.ts) and the
// API's exact throttler configuration (one throttler 'global' 120/min; the checkout-status route overrides it to
// 30/min, mirrored by /limited). Listens like main.ts: app.listen(PORT) with no host.
// Env: PORT (default 4000), INSTANCE (label returned by /whoami), TRUSTED_PROXY_CIDRS (as in production).
import 'reflect-metadata';
import { Controller, Get, Logger, Module, Req } from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SkipThrottle, Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { applyTrustedProxy } from '../../../services/api/src/common/trusted-proxy';

const INSTANCE = process.env.INSTANCE ?? 'api';

@Controller()
class UpstreamController {
  @Get('health') @SkipThrottle({ global: true })
  health() { return { ok: true, instance: INSTANCE }; }

  @Get('whoami') @SkipThrottle({ global: true })
  whoami(@Req() req: any) {
    return { instance: INSTANCE, reqIp: req.ip, socket: req.socket.remoteAddress, xForwardedFor: req.headers['x-forwarded-for'] ?? null };
  }

  @Get('limited') @Throttle({ global: { limit: 30, ttl: 60_000 } }) // = CheckoutStatusController
  limited() { return { ok: true, instance: INSTANCE }; }

  @Get('other') // = every other throttled API route (global 120/min)
  other() { return { ok: true, instance: INSTANCE }; }
}

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 120 }])], // = app.module.ts
  controllers: [UpstreamController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class UpstreamModule {}

(async () => {
  const app = await NestFactory.create<NestExpressApplication>(UpstreamModule, { logger: ['log', 'warn', 'error'] });
  const effective = applyTrustedProxy(app, process.env.TRUSTED_PROXY_CIDRS, new Logger('TrustedProxy'));
  await app.listen(Number(process.env.PORT ?? 4000));
  console.log(`upstream ${INSTANCE} listening; trust=${JSON.stringify(effective)}`);
})();
