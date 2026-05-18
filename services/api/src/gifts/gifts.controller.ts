import { Body, Controller, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailConfirmedGuard } from '../auth/email-confirmed.guard';
import { GiftsService } from './gifts.service';

@Controller('gifts')
export class GiftsController {
  constructor(private readonly giftsService: GiftsService) {}

  @Post('checkout')
  @HttpCode(200)
  createGiftSession(
    @Request() req: any,
    @Body() dto: { recipientEmail: string; tokenCount: number; message?: string; occasion?: string },
  ) {
    const buyerUserId = req.user?.id ?? null;
    return this.giftsService.createGiftSession(
      buyerUserId,
      dto.recipientEmail,
      dto.tokenCount,
      dto.message ?? null,
      dto.occasion ?? null,
    );
  }

  @Get('preview/:token')
  getPreview(@Param('token') token: string) {
    return this.giftsService.getGiftPreview(token);
  }

  @Post('claim')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  claimGift(@Request() req: any, @Body() dto: { token: string }) {
    return this.giftsService.claimGift(dto.token, req.user.id);
  }
}
