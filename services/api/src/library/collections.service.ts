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

  async findAll(): Promise<CollectionSummary[]> {
    const collections = await this.collectionRepo.find({ order: { createdAt: 'ASC' } });
    const summaries = await Promise.all(
      collections.map(async (c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        coverUrl: c.coverUrl,
        bookCount: await this.bcRepo.countBy({ collectionId: c.id }),
      })),
    );
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

    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      coverUrl: collection.coverUrl,
      bookCount: entries.length,
      books: entries.map((e) => e.book).filter(Boolean),
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
