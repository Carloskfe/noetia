import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBook } from '../library/user-book.entity';
import { Club } from './club.entity';
import { ClubBook } from './club-book.entity';
import { ClubMember, ClubRole } from './club-member.entity';
import { ClubsService } from './clubs.service';

@Injectable()
export class ClubMembersService {
  constructor(
    @InjectRepository(Club)       private readonly clubRepo: Repository<Club>,
    @InjectRepository(ClubMember) private readonly memberRepo: Repository<ClubMember>,
    @InjectRepository(ClubBook)   private readonly clubBookRepo: Repository<ClubBook>,
    @InjectRepository(UserBook)   private readonly userBookRepo: Repository<UserBook>,
    private readonly clubsService: ClubsService,
    private readonly jwtService: JwtService,
  ) {}

  async join(userId: string, clubId: string): Promise<ClubMember> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club not found');
    if (club.type === 'private') throw new ForbiddenException('This club requires an invite');

    await this.assertNotBanned(userId, clubId);
    await this.assertNotAlreadyMember(userId, clubId);
    await this.assertActiveBookOwnership(userId, clubId);
    await this.assertCapacity(club);

    const member = this.memberRepo.create({ clubId, userId, role: 'member' });
    return this.memberRepo.save(member);
  }

  async generateInviteLink(adminId: string, clubId: string): Promise<{ url: string }> {
    await this.clubsService.assertAdmin(adminId, clubId);
    const token = this.jwtService.sign({ clubId, purpose: 'club_invite' }, { expiresIn: '7d' });
    return { url: `${process.env.WEB_URL ?? 'http://localhost:3000'}/clubs/${clubId}/join?token=${token}` };
  }

  async acceptInvite(userId: string, token: string): Promise<ClubMember> {
    let payload: { clubId: string; purpose: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException({ error: 'invalid_or_expired_invite' });
    }
    if (payload.purpose !== 'club_invite') throw new BadRequestException({ error: 'invalid_invite' });

    const club = await this.clubRepo.findOne({ where: { id: payload.clubId } });
    if (!club) throw new NotFoundException('Club not found');

    await this.assertNotBanned(userId, payload.clubId);
    await this.assertNotAlreadyMember(userId, payload.clubId);
    await this.assertActiveBookOwnership(userId, payload.clubId);
    await this.assertCapacity(club);

    return this.memberRepo.save(this.memberRepo.create({ clubId: payload.clubId, userId, role: 'member' }));
  }

  async updateRole(adminId: string, clubId: string, targetUserId: string, role: ClubRole): Promise<ClubMember> {
    await this.clubsService.assertAdmin(adminId, clubId);
    const target = await this.memberRepo.findOne({ where: { clubId, userId: targetUserId, status: 'active' } });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'admin') throw new ForbiddenException('Cannot change owner role');
    target.role = role;
    return this.memberRepo.save(target);
  }

  async removeMember(adminId: string, clubId: string, targetUserId: string, ban: boolean): Promise<void> {
    await this.clubsService.assertAdmin(adminId, clubId);
    const target = await this.memberRepo.findOne({ where: { clubId, userId: targetUserId } });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'admin') throw new ForbiddenException('Cannot remove the club owner');

    if (ban) {
      target.status = 'banned';
      target.bannedAt = new Date();
      target.bannedById = adminId;
      await this.memberRepo.save(target);
      // Soft-delete all their messages and discussions is handled at the DB query layer by the caller
    } else {
      await this.memberRepo.remove(target);
    }
  }

  async leave(userId: string, clubId: string): Promise<void> {
    const member = await this.memberRepo.findOne({ where: { clubId, userId, status: 'active' } });
    if (!member) throw new NotFoundException('You are not a member of this club');
    if (member.role === 'admin') throw new ForbiddenException('Transfer ownership before leaving');
    await this.memberRepo.remove(member);
  }

  async updateNotificationPrefs(userId: string, clubId: string, prefs: {
    notifNearbyComment?: boolean;
    notifNewBook?: boolean;
    notifMilestone?: boolean;
    notifSession?: boolean;
  }): Promise<ClubMember> {
    const member = await this.memberRepo.findOne({ where: { clubId, userId, status: 'active' } });
    if (!member) throw new NotFoundException('Membership not found');
    Object.assign(member, prefs, { notifConfigured: true });
    return this.memberRepo.save(member);
  }

  async listMembers(clubId: string): Promise<ClubMember[]> {
    return this.memberRepo.find({ where: { clubId, status: 'active' }, relations: ['user'], order: { joinedAt: 'ASC' } });
  }

  private async assertNotBanned(userId: string, clubId: string): Promise<void> {
    const banned = await this.memberRepo.findOne({ where: { clubId, userId, status: 'banned' } });
    if (banned) throw new ForbiddenException({ error: 'user_banned_from_club' });
  }

  private async assertNotAlreadyMember(userId: string, clubId: string): Promise<void> {
    const existing = await this.memberRepo.findOne({ where: { clubId, userId, status: 'active' } });
    if (existing) throw new BadRequestException({ error: 'already_a_member' });
  }

  private async assertCapacity(club: Club): Promise<void> {
    if (club.maxMembers === null) return;
    const count = await this.memberRepo.count({ where: { clubId: club.id, status: 'active' } });
    if (count >= club.maxMembers) throw new BadRequestException({ error: 'club_full', max: club.maxMembers });
  }

  private async assertActiveBookOwnership(userId: string, clubId: string): Promise<void> {
    const activeBook = await this.clubBookRepo.findOne({ where: { clubId, status: 'active' } });
    if (!activeBook) return;
    const owned = await this.userBookRepo.findOne({ where: { userId, bookId: activeBook.bookId } });
    if (!owned) throw new ForbiddenException({ error: 'must_own_active_book_to_join', bookId: activeBook.bookId });
  }
}
