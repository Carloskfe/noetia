import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ClubMessage } from './club-message.entity';
import { ClubsService } from './clubs.service';

const PAGE_SIZE = 50;

@Injectable()
export class ClubMessagesService {
  constructor(
    @InjectRepository(ClubMessage) private readonly msgRepo: Repository<ClubMessage>,
    private readonly clubsService: ClubsService,
  ) {}

  async findAll(userId: string, clubId: string, before?: string): Promise<ClubMessage[]> {
    await this.clubsService.assertActiveMember(userId, clubId);
    const qb = this.msgRepo.createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m."clubId" = :clubId', { clubId })
      .andWhere('m."deletedAt" IS NULL')
      .orderBy('m."createdAt"', 'DESC')
      .take(PAGE_SIZE);
    if (before) qb.andWhere('m."createdAt" < :before', { before });
    return qb.getMany();
  }

  async create(userId: string, clubId: string, content: string): Promise<ClubMessage> {
    await this.clubsService.assertActiveMember(userId, clubId);
    return this.msgRepo.save(this.msgRepo.create({ clubId, userId, content }));
  }

  async remove(userId: string, clubId: string, messageId: string): Promise<void> {
    const msg = await this.msgRepo.findOne({ where: { id: messageId, clubId, deletedAt: IsNull() } });
    if (!msg) throw new NotFoundException('Message not found');

    const member = await this.clubsService.assertActiveMember(userId, clubId);
    const isMod = member.role === 'admin' || member.role === 'moderator';
    if (msg.userId !== userId && !isMod) throw new ForbiddenException('Cannot delete this message');

    msg.deletedAt = new Date();
    await this.msgRepo.save(msg);
  }

  async deleteBannedUserContent(clubId: string, userId: string): Promise<void> {
    await this.msgRepo.createQueryBuilder()
      .update(ClubMessage)
      .set({ deletedAt: new Date() })
      .where('"clubId" = :clubId AND "userId" = :userId AND "deletedAt" IS NULL', { clubId, userId })
      .execute();
  }
}
