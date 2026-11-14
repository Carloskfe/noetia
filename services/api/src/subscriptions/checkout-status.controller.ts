import { Controller, Get, Param, Request, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckoutStatusService } from './checkout-status.service';

/**
 * G-1: the ONE route for server-side Checkout verification (design §R3/§R2.4). Authenticated only (no anonymous
 * or optional-auth path; no EmailConfirmedGuard — a just-registered buyer must be able to see their status),
 * read-only, `no-store`, 30 requests/minute/IP. There is deliberately no gift route (PO-1 = G-b).
 */
@Controller('subscriptions')
export class CheckoutStatusController {
  constructor(private readonly checkoutStatus: CheckoutStatusService) {}

  @Get('checkout-sessions/:id/status')
  @UseGuards(JwtAuthGuard)
  @Throttle({ global: { limit: 30, ttl: 60_000 } })
  getStatus(@Request() req: any, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store'); // set before any error so 404/503 are not cached either
    return this.checkoutStatus.getStatus({ id: req.user.id, stripeCustomerId: req.user.stripeCustomerId ?? null }, id);
  }
}
