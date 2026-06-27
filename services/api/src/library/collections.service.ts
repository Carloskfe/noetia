import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { BookCollection } from './book-collection.entity';
import { Collection } from './collection.entity';

export interface CollectionSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  bookCount: number;
}

export interface CollectionDetail extends CollectionSummary {
  books: Book[];
}

@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(Collection) private readonly collectionRepo: Repository<Collection>,
    @InjectRepository(BookCollection) private readonly bcRepo: Repository<BookCollection>,
  ) {}

  // Shared quality-gate subquery: free books must have syncCoverage >= 0.90.
  private readonly QUALITY_GATE = `(
    b."isFree" = false
    OR EXISTS (
      SELECT 1 FROM sync_maps sm
      WHERE sm."bookId" = b.id AND sm."syncCoverage" >= 0.90
    )
  )`;

  async findAll(): Promise<CollectionSummary[]> {
    const collections = await this.collectionRepo.find({ order: { createdAt: 'ASC' } });
    const summaries: CollectionSummary[] = [];

    for (const c of collections) {
      // Count only quality-passing books so the displayed number is accurate.
      const bookCount = await this.bcRepo
        .createQueryBuilder('bc')
        .innerJoin('books', 'b', 'b.id = bc."bookId"')
        .where('bc."collectionId" = :id', { id: c.id })
        .andWhere('b."isPublished" = true')
        .andWhere(this.QUALITY_GATE)
        .getCount();

      // Hide collections that have no quality-passing books yet.
      if (bookCount > 0) {
        summaries.push({ id: c.id, name: c.name, slug: c.slug, description: c.description, coverUrl: c.coverUrl, bookCount });
      }
    }

    return summaries;
  }

  async findBySlug(slug: string): Promise<CollectionDetail> {
    const collection = await this.collectionRepo.findOneBy({ slug });
    if (!collection) throw new NotFoundException(`Collection "${slug}" not found`);

    const entries = await this.bcRepo.find({
      where: { collectionId: collection.id },
      relations: ['book'],
      order: { position: 'ASC' },
    });

    // Only surface quality-passing books within the collection.
    const books = entries
      .map((e) => e.book)
      .filter((b): b is Book => !!b && b.isPublished);

    const qualityBooks = await Promise.all(
      books.map(async (b) => {
        if (!b.isFree) return b;
        const [{ count }] = await this.bcRepo.query(
          `SELECT COUNT(*) AS count FROM sync_maps sm WHERE sm."bookId" = $1 AND sm."syncCoverage" >= 0.90`,
          [b.id],
        ) as [{ count: string }];
        return Number(count) > 0 ? b : null;
      }),
    );

    const filtered = qualityBooks.filter((b): b is Book => b !== null);

    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      coverUrl: collection.coverUrl,
      bookCount: filtered.length,
      books: filtered,
    };
  }

  async upsertCollection(
    slug: string,
    name: string,
    description: string | null,
    coverUrl: string | null,
    bookPositions: { bookId: string; position: number }[],
  ): Promise<Collection> {
    let collection = await this.collectionRepo.findOneBy({ slug });
    if (!collection) {
      collection = this.collectionRepo.create({ slug, name, description, coverUrl });
      collection = await this.collectionRepo.save(collection);
    } else {
      await this.collectionRepo.update(collection.id, { name, description, coverUrl });
    }

    // Remove old entries and re-insert in correct order
    await this.bcRepo.delete({ collectionId: collection.id });
    for (const { bookId, position } of bookPositions) {
      await this.bcRepo.save(
        this.bcRepo.create({ bookId, collectionId: collection.id, position }),
      );
    }

    return collection;
  }
}
