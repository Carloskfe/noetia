import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

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
  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}

bootstrap();
