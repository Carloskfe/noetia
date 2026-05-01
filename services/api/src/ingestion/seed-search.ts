import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { ReadingProgress } from '../books/reading-progress.entity';
import { User } from '../users/user.entity';
import { SearchModule } from '../search/search.module';
import { SearchService } from '../search/search.service';

@Injectable()
class SeedSearchService {
  constructor(
    @InjectRepository(Book) private readonly booksRepo: Repository<Book>,
    private readonly searchService: SearchService,
  ) {}

  async run() {
    const books = await this.booksRepo.find({ where: { isPublished: true } });
    console.log(`Indexing ${books.length} published books…`);
    await this.searchService.indexAll(books);
    console.log('Done.');
  }
}

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
    TypeOrmModule.forFeature([Book]),
    SearchModule,
  ],
  providers: [SeedSearchService],
})
class SeedSearchModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedSearchModule, {
    logger: ['log', 'error', 'warn'],
  });
  const seeder = app.get(SeedSearchService);
  await seeder.run();
  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
