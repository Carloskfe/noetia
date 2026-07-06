import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from '../books/book.entity';
import { SyncMap } from '../books/sync-map.entity';
import { ReadingProgress } from '../books/reading-progress.entity';
import { User } from '../users/user.entity';
import { UserBook } from '../library/user-book.entity';
import { Collection } from '../library/collection.entity';
import { BookCollection } from '../library/book-collection.entity';
import { LibraryModule } from '../library/library.module';
import { CollectionsService } from '../library/collections.service';
import { DataSource } from 'typeorm';

// Canonical Bible order for the books we have in the catalogue
const BIBLE_ORDER = [
  // Old Testament
  'Génesis',
  'Éxodo',
  'Salmos',
  'Proverbios',
  'Isaías',
  // New Testament
  'Mateo',
  'Marcos',
  'Lucas',
  'Juan',
  'Hechos',
  'Romanos',
  '1 Corintios',
  'Efesios',
  'Filipenses',
  'Hebreos',
  'Santiago',
  'Apocalipsis',
];

const QUIJOTE_ORDER = [
  'Don Quijote de la Mancha — Vol. I',
  'Don Quijote de la Mancha — Vol. II',
];

const KJV_ORDER = [
  // Old Testament
  'Genesis',
  'Exodus',
  'Psalms',
  'Proverbs',
  'Isaiah',
  // New Testament
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'Romans',
  '1 Corinthians',
  'Ephesians',
  'Philippians',
  'Hebrews',
  'James',
  'Revelation',
];

const INFANTIL_ORDER = [
  'Fábulas y Verdades',
  'La Edad de Oro',
  'Cuentos de la Selva',
];

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
        entities: [Book, SyncMap, ReadingProgress, User, UserBook, Collection, BookCollection],
        synchronize: false,
      }),
    }),
    LibraryModule,
  ],
})
class SeedCollectionsModule {}

async function resolveBookIds(
  ds: DataSource,
  titles: string[],
): Promise<{ bookId: string; position: number }[]> {
  const bookRepo = ds.getRepository(Book);
  const result: { bookId: string; position: number }[] = [];

  for (let i = 0; i < titles.length; i++) {
    const book = await bookRepo.findOneBy({ title: titles[i], isPublished: true });
    if (!book) {
      console.warn(`  ⚠ Book not found: "${titles[i]}" — skipping`);
      continue;
    }
    result.push({ bookId: book.id, position: i + 1 });
  }

  return result;
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeedCollectionsModule, {
    logger: ['log', 'error', 'warn'],
  });

  const service = app.get(CollectionsService);
  const ds = app.get<DataSource>(DataSource);

  // ── Biblia Reina-Valera ────────────────────────────────────────────────────
  console.log('Seeding collection: Biblia Reina-Valera…');
  const biblePositions = await resolveBookIds(ds, BIBLE_ORDER);
  await service.upsertCollection(
    'biblia-reina-valera',
    'Biblia Reina-Valera',
    'La Sagrada Biblia en la traducción clásica Reina-Valera 1909. Libros del Antiguo y Nuevo Testamento disponibles como texto sincronizado con audio.',
    '/covers/biblia-reina-valera.png',
    biblePositions,
  );
  console.log(`  ✓ ${biblePositions.length} books in canonical order`);

  // ── Bible — King James Version ────────────────────────────────────────────
  console.log('Seeding collection: Bible (King James Version)…');
  const kjvPositions = await resolveBookIds(ds, KJV_ORDER);
  await service.upsertCollection(
    'bible-kjv',
    'Bible (King James Version)',
    'The Holy Bible in the classic King James Version. Books of the Old and New Testament available as text synchronized with audio.',
    '/covers/bible-kjv.png',
    kjvPositions,
  );
  console.log(`  ✓ ${kjvPositions.length} books in canonical order`);

  // ── Don Quijote de la Mancha ───────────────────────────────────────────────
  console.log('Seeding collection: Don Quijote de la Mancha…');
  const quijotePositions = await resolveBookIds(ds, QUIJOTE_ORDER);
  await service.upsertCollection(
    'don-quijote',
    'Don Quijote de la Mancha',
    'La obra maestra de Miguel de Cervantes en dos volúmenes. La novela más importante de la literatura española y una de las más influyentes de la historia universal.',
    'https://covers.openlibrary.org/b/id/14428305-L.jpg',
    quijotePositions,
  );
  console.log(`  ✓ ${quijotePositions.length} books in order`);

  // ── Literatura Infantil ────────────────────────────────────────────────────
  console.log('Seeding collection: Literatura Infantil…');
  const infantilPositions = await resolveBookIds(ds, INFANTIL_ORDER);
  await service.upsertCollection(
    'literatura-infantil',
    'Literatura Infantil',
    'Cuentos, fábulas y poemas para niños de los grandes autores latinoamericanos: Rafael Pombo, José Martí y Horacio Quiroga. Todo en dominio público.',
    null,
    infantilPositions,
  );
  console.log(`  ✓ ${infantilPositions.length} books in order`);

  await app.close();
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
