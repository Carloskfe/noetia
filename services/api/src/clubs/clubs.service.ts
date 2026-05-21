import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Book } from '../books/book.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { User } from '../users/user.entity';
import { ClubBook } from './club-book.entity';
import { ClubMember } from './club-member.entity';
import { Club } from './club.entity';
import { CreateClubDto } from './dto/create-club.dto';
import { UpdateClubDto } from './dto/update-club.dto';

const USER_CLUB_LIMIT = 3;
const DEFAULT_MAX_MEMBERS = 20;

@Injectable()
export class ClubsService {
  constructor(
    @InjectRepository(Club)       private readonly clubRepo: Repository<Club>,
    @InjectRepository(ClubMember) private readonly memberRepo: Repository<ClubMember>,
    @InjectRepository(ClubBook)   private readonly clubBookRepo: Repository<ClubBook>,
    @InjectRepository(Book)       private readonly bookRepo: Repository<Book>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
  ) {}

  async create(userId: string, dto: CreateClubDto): Promise<Club> {
    const owned = await this.clubRepo.count({ where: { ownerId: userId } });
    if (owned >= USER_CLUB_LIMIT) {
      throw new BadRequestException({ error: 'club_limit_reached', max: USER_CLUB_LIMIT });
    }

    const book = await this.bookRepo.findOne({ where: { id: dto.bookId } });
    if (!book) throw new NotFoundException('Book not found');

    const hasSubscription = await this.subRepo.findOne({ where: { userId, status: 'active' } });
    if (!book.isFree && !hasSubscription) {
      throw new ForbiddenException({ error: 'subscription_required_for_paid_book_club' });
    }

    const club = this.clubRepo.create({
      ...dto,
      ownerId: userId,
      maxMembers: DEFAULT_MAX_MEMBERS,
    });
    await this.clubRepo.save(club);

    await this.memberRepo.save(this.memberRepo.create({ clubId: club.id, userId, role: 'admin', notifConfigured: true }));
    await this.clubBookRepo.save(this.clubBookRepo.create({ clubId: club.id, bookId: dto.bookId, addedById: userId, status: 'active', startedAt: new Date() }));

    return club;
  }

  async findAll(query: { search?: string; type?: string; bookId?: string; sort?: string; limit?: number; offset?: number }): Promise<{ clubs: Club[]; total: number }> {
    const qb = this.clubRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.owner', 'owner')
      .where('c.type IN (:...types)', { types: ['public', 'author_event'] });

    if (query.search)  qb.andWhere('c.name ILIKE :search', { search: `%${query.search}%` });
    if (query.bookId) {
      qb.innerJoin('club_books', 'cb', 'cb."clubId" = c.id AND cb."bookId" = :bookId AND cb.status = \'active\'', { bookId: query.bookId });
    }

    const sort = query.sort === 'newest' ? 'c.createdAt' : 'c.name';
    qb.orderBy(sort, 'DESC').take(query.limit ?? 20).skip(query.offset ?? 0);

    const [clubs, total] = await qb.getManyAndCount();
    return { clubs, total };
  }

  async findOne(id: string): Promise<Club> {
    const club = await this.clubRepo.findOne({ where: { id }, relations: ['owner'] });
    if (!club) throw new NotFoundException('Club not found');
    return club;
  }

  async update(userId: string, clubId: string, dto: UpdateClubDto): Promise<Club> {
    const club = await this.findOne(clubId);
    await this.assertAdmin(userId, clubId);
    Object.assign(club, dto);
    return this.clubRepo.save(club);
  }

  async remove(userId: string, clubId: string): Promise<void> {
    const club = await this.findOne(clubId);
    if (club.ownerId !== userId) throw new ForbiddenException('Only the owner can delete a club');
    await this.clubRepo.remove(club);
  }

  async getMemberCount(clubId: string): Promise<number> {
    return this.memberRepo.count({ where: { clubId, status: 'active' } });
  }

  async assertAdmin(userId: string, clubId: string): Promise<void> {
    const m = await this.memberRepo.findOne({ where: { clubId, userId, status: 'active' } });
    if (!m || (m.role !== 'admin' && m.role !== 'moderator')) throw new ForbiddenException('Admin or moderator role required');
  }

  async assertActiveMember(userId: string, clubId: string): Promise<ClubMember> {
    const m = await this.memberRepo.findOne({ where: { clubId, userId, status: 'active' } });
    if (!m) throw new ForbiddenException('Active club membership required');
    return m;
  }
}
