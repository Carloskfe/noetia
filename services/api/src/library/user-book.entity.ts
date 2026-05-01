import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Book } from '../books/book.entity';

@Entity('user_books')
@Unique(['userId', 'bookId'])
export class UserBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  bookId: string;

  @ManyToOne(() => Book, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'bookId' })
  book: Book;

  @CreateDateColumn()
  addedAt: Date;
}
