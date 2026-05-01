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
import { AlignmentService } from './alignment.service';

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
class SeedAlignmentModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedAlignmentModule, {
    logger: ['log', 'error', 'warn'],
  });

  const bookId = process.argv[2];
  const service = app.get(AlignmentService);

  if (bookId) {
    const { Book: BookEntity } = await import('../books/book.entity');
    const { DataSource } = await import('typeorm');
    const ds = app.get<InstanceType<typeof DataSource>>(DataSource);
    const book = await ds.getRepository(BookEntity).findOneByOrFail({ id: bookId });
    await service.alignBook(book);
  } else {
    await service.alignAll();
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
