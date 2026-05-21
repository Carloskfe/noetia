import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushService } from '../push/push.service';
import { ClubMember } from './club-member.entity';
import { ClubSession } from './club-session.entity';
import { ClubsService } from './clubs.service';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class ClubSessionsService {
  constructor(
    @InjectRepository(ClubSession) private readonly sessionRepo: Repository<ClubSession>,
    @InjectRepository(ClubMember)  private readonly memberRepo: Repository<ClubMember>,
    private readonly clubsService: ClubsService,
    private readonly pushService: PushService,
  ) {}

  async findAll(userId: string, clubId: string): Promise<ClubSession[]> {
    await this.clubsService.assertActiveMember(userId, clubId);
    return this.sessionRepo.find({ where: { clubId }, relations: ['book', 'host'], order: { scheduledAt: 'ASC' } });
  }

  async create(adminId: string, clubId: string, dto: CreateSessionDto): Promise<ClubSession> {
    await this.clubsService.assertAdmin(adminId, clubId);

    if (dto.endPhraseIndex <= dto.startPhraseIndex) throw new BadRequestException({ error: 'end_phrase_must_be_after_start' });
    if (new Date(dto.scheduledAt) <= new Date()) throw new BadRequestException({ error: 'scheduledAt_must_be_in_the_future' });

    const session = await this.sessionRepo.save(this.sessionRepo.create({
      clubId, hostId: adminId,
      bookId: dto.bookId,
      title: dto.title,
      scheduledAt: new Date(dto.scheduledAt),
      startPhraseIndex: dto.startPhraseIndex,
      endPhraseIndex: dto.endPhraseIndex,
    }));

    await this.notifyScheduled(clubId, session);
    return session;
  }

  async cancel(adminId: string, clubId: string, sessionId: string): Promise<ClubSession> {
    await this.clubsService.assertAdmin(adminId, clubId);
    const session = await this.sessionRepo.findOne({ where: { id: sessionId, clubId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'completed') throw new BadRequestException({ error: 'cannot_cancel_completed_session' });

    session.status = 'cancelled';
    return this.sessionRepo.save(session);
  }

  private async notifyScheduled(clubId: string, session: ClubSession): Promise<void> {
    const members = await this.memberRepo.find({ where: { clubId, status: 'active', notifSession: true } });
    await Promise.allSettled(
      members.map(m => this.pushService.sendToUser(m.userId, 'club_session_scheduled', {
        clubId,
        sessionId: session.id,
        title: session.title,
        scheduledAt: session.scheduledAt,
      })),
    );
  }
}
