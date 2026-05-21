import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubMember } from './club-member.entity';
import { ClubPoll, ClubPollOption, ClubPollVote } from './club-poll.entity';
import { ClubsService } from './clubs.service';
import { CreatePollDto } from './dto/create-poll.dto';

@Injectable()
export class ClubPollsService {
  constructor(
    @InjectRepository(ClubPoll)       private readonly pollRepo: Repository<ClubPoll>,
    @InjectRepository(ClubPollOption) private readonly optionRepo: Repository<ClubPollOption>,
    @InjectRepository(ClubPollVote)   private readonly voteRepo: Repository<ClubPollVote>,
    @InjectRepository(ClubMember)     private readonly memberRepo: Repository<ClubMember>,
    private readonly clubsService: ClubsService,
  ) {}

  async findAll(userId: string, clubId: string): Promise<ClubPoll[]> {
    await this.clubsService.assertActiveMember(userId, clubId);
    return this.pollRepo.find({ where: { clubId }, order: { createdAt: 'DESC' } });
  }

  async create(adminId: string, clubId: string, dto: CreatePollDto): Promise<ClubPoll> {
    await this.clubsService.assertAdmin(adminId, clubId);
    if (new Date(dto.closesAt) <= new Date()) throw new BadRequestException({ error: 'closesAt_must_be_in_the_future' });

    const poll = await this.pollRepo.save(this.pollRepo.create({ clubId, createdById: adminId, question: dto.question, closesAt: new Date(dto.closesAt) }));
    await this.optionRepo.save(dto.bookIds.map(bookId => this.optionRepo.create({ pollId: poll.id, bookId })));
    return poll;
  }

  async vote(userId: string, clubId: string, pollId: string, optionId: string): Promise<ClubPollVote> {
    await this.clubsService.assertActiveMember(userId, clubId);
    const poll = await this.pollRepo.findOne({ where: { id: pollId, clubId } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.status === 'closed') throw new BadRequestException({ error: 'poll_already_closed' });
    if (new Date() > poll.closesAt) throw new BadRequestException({ error: 'poll_expired' });

    const option = await this.optionRepo.findOne({ where: { id: optionId, pollId } });
    if (!option) throw new NotFoundException('Poll option not found');

    const existing = await this.voteRepo.findOne({ where: { pollId, userId } });
    if (existing) throw new BadRequestException({ error: 'already_voted' });

    return this.voteRepo.save(this.voteRepo.create({ pollId, optionId, userId }));
  }

  async close(adminId: string, clubId: string, pollId: string): Promise<ClubPoll> {
    await this.clubsService.assertAdmin(adminId, clubId);
    const poll = await this.pollRepo.findOne({ where: { id: pollId, clubId } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.status === 'closed') throw new BadRequestException({ error: 'poll_already_closed' });

    const winner = await this.voteRepo.createQueryBuilder('v')
      .select('v."optionId"')
      .addSelect('COUNT(*)', 'votes')
      .where('v."pollId" = :pollId', { pollId })
      .groupBy('v."optionId"')
      .orderBy('votes', 'DESC')
      .limit(1)
      .getRawOne<{ optionId: string }>();

    poll.status = 'closed';
    poll.winnerOptionId = winner?.optionId ?? null;
    return this.pollRepo.save(poll);
  }
}
