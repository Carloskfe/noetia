import {
  BadRequestException,
  Controller,
  Headers,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import Stripe from 'stripe';
import { createStripeClient } from '../common/payments-activation';
import { WebhooksService } from './webhooks.service';

@SkipThrottle({ global: true })
@Controller('webhooks')
export class WebhooksController {
  private readonly stripe: InstanceType<typeof Stripe> | null;
  private readonly webhookSecret: string | undefined;
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly config: ConfigService,
  ) {
    // Fail closed: no client (so every event is rejected below, nothing is fulfilled) unless
    // PAYMENTS_ENABLED=true AND a valid key (common/payments-activation.ts).
    this.stripe = createStripeClient(this.config);
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  @Post('stripe')
  async handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') sig: string,
  ) {
    if (!this.stripe || !this.webhookSecret) {
      throw new BadRequestException('Stripe is not configured');
    }

    let event: any;

    try {
      event = this.stripe.webhooks.constructEvent(req.rawBody!, sig, this.webhookSecret);
    } catch (err: any) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook error: ${err.message}`);
    }

    await this.webhooksService.handleEvent(event);
    return { received: true };
  }
}
