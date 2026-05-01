import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Book } from '../books/book.entity';
import { Collection } from './collection.entity';

@Entity('book_collections')
@Unique(['bookId', 'collectionId'])
export class BookCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  bookId: string;

  @Column()
  collectionId: string;

  @Column({ type: 'int', default: 0 })
  position: number;

  @ManyToOne(() => Book, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  @ManyToOne(() => Collection, (c) => c.bookCollections, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'collectionId' })
  collection: Collection;
}
