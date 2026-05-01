import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { ReadingProgress } from '../books/reading-progress.entity';
import { User } from '../users/user.entity';
import { IngestionModule } from './ingestion.module';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'noetia'),
        username: config.get('DB_USER', 'noetia'),
        password: config.get('DB_PASS', 'changeme'),
        entities: [Book, SyncMap, ReadingProgress, User],
        synchronize: false,
      }),
    }),
    IngestionModule,
  ],
})
class SeedCoversModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedCoversModule, {
    logger: ['log', 'error', 'warn'],
  });
  const service = app.get(IngestionService);
  await service.ingestAllCovers();
  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
