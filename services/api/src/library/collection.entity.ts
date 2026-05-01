import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BookCollection } from './book-collection.entity';

@Entity('collections')
export class Collection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverUrl: string | null;

  @OneToMany(() => BookCollection, (bc) => bc.collection, { cascade: false })
  bookCollections: BookCollection[];

  @CreateDateColumn()
  createdAt: Date;
}
