import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { CourtesyTokenQuota, CourtesyRole } from './courtesy-token-quota.entity';
import { SubscriptionsService } from './subscriptions.service';

class IssuePromotionalTokensDto {
  userId: string;
  count: number = 1;
  reason?: string;
  expiryDays?: number;
}

class IssueCourtesyTokensDto {
  userId: string;
  bookId: string;
  quotaId: string;
  reason?: string;
}

class SetCourtesyQuotaDto {
  bookId: string;
  creatorId: string;
  role: CourtesyRole;
  maxQuota: number;
}

@Controller('admin/tokens')
@UseGuards(JwtAuthGuard)
export class AdminTokensController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly usersService: UsersService,
    @InjectRepository(CourtesyTokenQuota)
    private readonly quotaRepo: Repository<CourtesyTokenQuota>,
  ) {}

  private assertAdmin(req: any) {
    // Admin status is the `User.isAdmin` boolean — NOT a `UserType` value.
    // (`UserType` is personal|author|editorial; there is no 'admin' userType, so
    // the previous `userType === 'admin'` check could never pass and 403'd every
    // caller, including real admins.) Aligns with all other admin routes.
    if (!req.user?.isAdmin) throw new ForbiddenException('Admin only');
  }

  // ── Promotional tokens ─────────────────────────────────────────────────────

  @Post('promotional')
  @HttpCode(200)
  async issuePromotional(@Request() req: any, @Body() dto: IssuePromotionalTokensDto) {
    this.assertAdmin(req);
    const user = await this.usersService.findById(dto.userId);
    if (!user) throw new NotFoundException('User not found');
    if (!dto.count || dto.count < 1 || dto.count > 10) {
      throw new BadRequestException('count must be between 1 and 10');
    }
    await this.subscriptionsService.issueTokens(dto.userId, dto.count, 'promotional', {
      reason: dto.reason ?? 'Admin promotional grant',
    });
    return { issued: dto.count, userId: dto.userId, type: 'promotional' };
  }

  // ── Courtesy token quotas ──────────────────────────────────────────────────

  @Get('courtesy/quotas')
  async listQuotas(@Request() req: any) {
    this.assertAdmin(req);
    return this.quotaRepo.find({ order: { createdAt: 'DESC' } });
  }

  @Post('courtesy/quotas')
  @HttpCode(200)
  async setQuota(@Request() req: any, @Body() dto: SetCourtesyQuotaDto) {
    this.assertAdmin(req);
    const existing = await this.quotaRepo.findOne({
      where: { bookId: dto.bookId, creatorId: dto.creatorId },
    });
    if (existing) {
      await this.quotaRepo.update(existing.id, { maxQuota: dto.maxQuota, role: dto.role });
      return { ...existing, maxQuota: dto.maxQuota };
    }
    const quota = this.quotaRepo.create(dto);
    return this.quotaRepo.save(quota);
  }

  @Post('courtesy/issue')
  @HttpCode(200)
  async issueCourtesy(@Request() req: any, @Body() dto: IssueCourtesyTokensDto) {
    this.assertAdmin(req);

    const quota = await this.quotaRepo.findOneBy({ id: dto.quotaId });
    if (!quota) throw new NotFoundException('Courtesy quota not found');
    if (quota.issuedCount >= quota.maxQuota) {
      throw new BadRequestException('Courtesy quota exhausted for this book');
    }

    const user = await this.usersService.findById(dto.userId);
    if (!user) throw new NotFoundException('User not found');

    await this.subscriptionsService.issueTokens(dto.userId, 1, 'courtesy', {
      reason: dto.reason ?? `Courtesy token — ${quota.role} authorization`,
    });
    await this.quotaRepo.increment({ id: quota.id }, 'issuedCount', 1);

    return {
      issued: 1,
      userId: dto.userId,
      bookId: dto.bookId,
      quotaRemaining: quota.maxQuota - quota.issuedCount - 1,
      type: 'courtesy',
    };
  }

  // ── Token balance lookup ───────────────────────────────────────────────────

  @Get('balance/:userId')
  async getUserTokenBalance(@Request() req: any, @Param('userId') userId: string) {
    this.assertAdmin(req);
    const balance = await this.subscriptionsService.getActiveTokenCount(userId);
    return { userId, tokenBalance: balance };
  }
}
