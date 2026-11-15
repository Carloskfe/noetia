import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { applyTrustedProxy } from './common/trusted-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // G1-I1: honour X-Forwarded-For only from the validated TRUSTED_PROXY_CIDRS (the dedicated Traefik↔API edge
  // network's allocation range). Unset/invalid → no trust (client address = TCP peer). Never `trust proxy: true`.
  applyTrustedProxy(app, process.env.TRUSTED_PROXY_CIDRS, new Logger('TrustedProxy'));

  // Quote-card backgrounds — gallery presets AND user uploads — are sent as
  // base64 data URIs inside the /fragments/:id/share JSON body. A ~1200px JPEG
  // encodes to ~200–300 KB, past Express's default 100 KB JSON limit, so the
  // request was rejected and the image couldn't be downloaded. Raise the limit
  // to comfortably fit an image payload.
  app.useBodyParser('json', { limit: '10mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '10mb' });
  if (process.env.SENTRY_DSN) {
    app.useGlobalFilters(new SentryGlobalFilter());
  }
  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Close the HTTP server + DB pool on SIGTERM so `docker stop` (every deploy)
  // exits in ~1s instead of hitting the 10s kill timeout with /api unrouted.
  // Requires `init: true` in docker-compose.server.yml. A clean stop exits 143
  // (Nest re-raises SIGTERM after closing); 137 means it was SIGKILLed.
  app.enableShutdownHooks();
  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}

bootstrap();
