import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { PushService } from '../push/push.service';
import { ClubBook } from './club-book.entity';
import { ClubMember } from './club-member.entity';
import { ClubsService } from './clubs.service';

@Injectable()
export class ClubBooksService {
  constructor(
    @InjectRepository(ClubBook)   private readonly clubBookRepo: Repository<ClubBook>,
    @InjectRepository(ClubMember) private readonly memberRepo: Repository<ClubMember>,
    @InjectRepository(Book)       private readonly bookRepo: Repository<Book>,
    private readonly clubsService: ClubsService,
    private readonly pushService: PushService,
  ) {}

  async findAll(clubId: string): Promise<ClubBook[]> {
    return this.clubBookRepo.find({ where: { clubId }, relations: ['book'], order: { createdAt: 'ASC' } });
  }

  async addBook(userId: string, clubId: string, bookId: string): Promise<ClubBook> {
    await this.clubsService.assertActiveMember(userId, clubId);
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');

    const exists = await this.clubBookRepo.findOne({ where: { clubId, bookId } });
    if (exists) throw new BadRequestException({ error: 'book_already_in_club' });

    return this.clubBookRepo.save(this.clubBookRepo.create({ clubId, bookId, addedById: userId, status: 'queued' }));
  }

  async setActive(adminId: string, clubId: string, bookId: string): Promise<ClubBook> {
    await this.clubsService.assertAdmin(adminId, clubId);

    const current = await this.clubBookRepo.findOne({ where: { clubId, status: 'active' } });
    if (current) {
      current.status = 'completed';
      current.completedAt = new Date();
      await this.clubBookRepo.save(current);
    }

    const next = await this.clubBookRepo.findOne({ where: { clubId, bookId } });
    if (!next) throw new NotFoundException('Book not in club reading list');

    next.status = 'active';
    next.startedAt = new Date();
    const saved = await this.clubBookRepo.save(next);

    await this.notifyNewBook(clubId, bookId);
    return saved;
  }

  private async notifyNewBook(clubId: string, bookId: string): Promise<void> {
    const members = await this.memberRepo.find({ where: { clubId, status: 'active', notifNewBook: true } });
    await Promise.allSettled(members.map(m => this.pushService.sendToUser(m.userId, 'club_new_book', { clubId, bookId })));
  }
}
