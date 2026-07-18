import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

class HeartbeatDto {
  @IsString()
  bookId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  phraseDelta?: number;
}

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Post('heartbeat')
  heartbeat(@Req() req: any, @Body() dto: HeartbeatDto) {
    return this.statsService.heartbeat(req.user.sub, dto.phraseDelta ?? 0);
  }

  @Get('me')
  getMyStats(@Req() req: any) {
    return this.statsService.getMyStats(req.user.sub);
  }

  @Get('history')
  getHistory(@Req() req: any) {
    return this.statsService.getStatsHistory(req.user.sub);
  }
}
