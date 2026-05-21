import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserBook } from '../library/user-book.entity';
import { PushService } from '../push/push.service';
import { ClubDiscussion } from './club-discussion.entity';
import { ClubMember } from './club-member.entity';
import { ClubsService } from './clubs.service';

const NEARBY_PHRASE_WINDOW = 50;

@Injectable()
export class ClubDiscussionsService {
  constructor(
    @InjectRepository(ClubDiscussion) private readonly discRepo: Repository<ClubDiscussion>,
    @InjectRepository(ClubMember)     private readonly memberRepo: Repository<ClubMember>,
    @InjectRepository(UserBook)       private readonly userBookRepo: Repository<UserBook>,
    private readonly clubsService: ClubsService,
    private readonly pushService: PushService,
  ) {}

  async findByBook(userId: string, clubId: string, bookId: string, phraseFrom?: number, phraseTo?: number): Promise<ClubDiscussion[]> {
    await this.clubsService.assertActiveMember(userId, clubId);
    const qb = this.discRepo.createQueryBuilder('d')
      .leftJoinAndSelect('d.user', 'user')
      .where('d."clubId" = :clubId AND d."bookId" = :bookId AND d."deletedAt" IS NULL', { clubId, bookId })
      .orderBy('d."phraseIndex"', 'ASC')
      .addOrderBy('d."createdAt"', 'ASC');
    if (phraseFrom !== undefined) qb.andWhere('d."phraseIndex" >= :from', { from: phraseFrom });
    if (phraseTo   !== undefined) qb.andWhere('d."phraseIndex" <= :to',   { to: phraseTo });
    return qb.getMany();
  }

  async create(userId: string, clubId: string, bookId: string, phraseIndex: number, content: string): Promise<ClubDiscussion> {
    await this.clubsService.assertActiveMember(userId, clubId);

    const owned = await this.userBookRepo.findOne({ where: { userId, bookId } });
    if (!owned) throw new ForbiddenException({ error: 'must_own_book_to_discuss', bookId });

    const discussion = await this.discRepo.save(this.discRepo.create({ clubId, bookId, userId, phraseIndex, content }));
    await this.notifyNearby(clubId, bookId, phraseIndex, userId);
    return discussion;
  }

  async remove(userId: string, clubId: string, discussionId: string): Promise<void> {
    const disc = await this.discRepo.findOne({ where: { id: discussionId, clubId, deletedAt: IsNull() } });
    if (!disc) throw new NotFoundException('Discussion not found');

    const member = await this.clubsService.assertActiveMember(userId, clubId);
    const isMod = member.role === 'admin' || member.role === 'moderator';
    if (disc.userId !== userId && !isMod) throw new ForbiddenException('Cannot delete this discussion');

    disc.deletedAt = new Date();
    await this.discRepo.save(disc);
  }

  async deleteBannedUserContent(clubId: string, userId: string): Promise<void> {
    await this.discRepo.createQueryBuilder()
      .update(ClubDiscussion)
      .set({ deletedAt: new Date() })
      .where('"clubId" = :clubId AND "userId" = :userId AND "deletedAt" IS NULL', { clubId, userId })
      .execute();
  }

  private async notifyNearby(clubId: string, bookId: string, phraseIndex: number, authorId: string): Promise<void> {
    const members = await this.memberRepo.find({ where: { clubId, status: 'active', notifNearbyComment: true } });
    await Promise.allSettled(
      members
        .filter(m => m.userId !== authorId)
        .map(m => this.pushService.sendToUser(m.userId, 'club_nearby_comment', { clubId, bookId, phraseIndex })),
    );
  }
}
