import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import Stripe from 'stripe';
import { MoreThan, Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { PushService } from '../push/push.service';
import { TokenLedger } from '../subscriptions/token-ledger.entity';
import { User } from '../users/user.entity';
import { GiftCard } from './gift-card.entity';

const GIFT_EXPIRY_DAYS = 365;
const TOKEN_EXPIRY_DAYS = 90;

const OCCASION_LABELS: Record<string, string> = {
  birthday:   '🎂 Cumpleaños',
  graduation: '🎓 Graduación',
  just:       '💝 Solo porque sí',
  celebration:'🎉 Celebración',
  reading:    '📚 Inicio de lectura',
};

@Injectable()
export class GiftsService {
  private readonly stripe: InstanceType<typeof Stripe> | null;
  private readonly webUrl: string;
  private readonly logger = new Logger(GiftsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
    @InjectRepository(GiftCard)
    private readonly giftRepo: Repository<GiftCard>,
    @InjectRepository(TokenLedger)
    private readonly tokenRepo: Repository<TokenLedger>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
    this.webUrl = this.config.get('WEB_URL', 'http://localhost:3000');
  }

  private requireStripe() {
    if (!this.stripe) throw new BadRequestException({ error: 'payments_not_configured' });
    return this.stripe;
  }

  async createGiftSession(
    buyerUserId: string | null,
    recipientEmail: string,
    tokenCount: number,
    message: string | null,
    occasion: string | null,
  ): Promise<{ url: string }> {
    if (![1, 3].includes(tokenCount)) {
      throw new BadRequestException({ error: 'invalid_token_count' });
    }

    const priceMap: Record<number, number> = { 1: 999, 3: 2499 };
    const amountCents = priceMap[tokenCount];
    const productName = `Regalo Noetia — ${tokenCount} ${tokenCount === 1 ? 'Token' : 'Tokens'}`;

    const session = await this.requireStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: { name: productName },
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata: {
        type: 'gift',
        buyerUserId: buyerUserId ?? '',
        recipientEmail,
        tokenCount: String(tokenCount),
        message: message ?? '',
        occasion: occasion ?? '',
      },
      success_url: `${this.webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.webUrl}/gift`,
    });

    return { url: session.url! };
  }

  async fulfillGift(session: any): Promise<void> {
    const { buyerUserId, recipientEmail, tokenCount, message, occasion } = session.metadata ?? {};
    if (!recipientEmail || !tokenCount) return;

    const count = parseInt(tokenCount, 10);
    const claimToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + GIFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const gift = this.giftRepo.create({
      buyerUserId: buyerUserId || null,
      buyerEmail: session.customer_details?.email ?? null,
      recipientEmail,
      message: message || null,
      occasion: occasion || null,
      tokenCount: count,
      claimToken,
      status: 'sent',
      expiresAt,
      stripeSessionId: session.id,
    });
    await this.giftRepo.save(gift);

    const occasionLabel = OCCASION_LABELS[occasion] ?? null;
    const buyerName = buyerUserId
      ? (await this.userRepo.findOneBy({ id: buyerUserId }))?.name ?? 'Alguien'
      : session.customer_details?.name ?? 'Alguien';

    await this.emailService.sendGiftCard(recipientEmail, buyerName, count, message || null, occasionLabel, claimToken);

    if (session.customer_details?.email) {
      await this.emailService.sendGiftConfirmation(session.customer_details.email, buyerName, recipientEmail, count);
    }
  }

  async claimGift(claimToken: string, userId: string): Promise<{ tokenCount: number }> {
    const gift = await this.giftRepo.findOneBy({ claimToken });

    if (!gift) throw new NotFoundException({ error: 'gift_not_found' });
    if (gift.status === 'claimed') throw new BadRequestException({ error: 'gift_already_claimed' });
    if (gift.status === 'expired' || gift.expiresAt < new Date()) {
      await this.giftRepo.update(gift.id, { status: 'expired' });
      throw new BadRequestException({ error: 'gift_expired' });
    }

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const entries = Array.from({ length: gift.tokenCount }, () =>
      this.tokenRepo.create({
        userId,
        type: 'paid',
        status: 'active',
        issuedAt: new Date(),
        activatedAt: null,
        expiresAt,
        reason: `Gift card ${gift.id}`,
      }),
    );
    await this.tokenRepo.save(entries);

    await this.giftRepo.update(gift.id, {
      status: 'claimed',
      claimedByUserId: userId,
      claimedAt: new Date(),
    });

    // Notify the buyer if they have a Noetia account
    if (gift.buyerUserId) {
      this.pushService.sendToUser(gift.buyerUserId, 'gift_claimed', {
        tokenCount: gift.tokenCount,
      }).catch(() => {});
    }

    return { tokenCount: gift.tokenCount };
  }

  async getGiftPreview(claimToken: string): Promise<{
    tokenCount: number;
    message: string | null;
    occasion: string | null;
    buyerEmail: string | null;
    status: string;
  }> {
    const gift = await this.giftRepo.findOneBy({ claimToken });
    if (!gift) throw new NotFoundException({ error: 'gift_not_found' });
    return {
      tokenCount: gift.tokenCount,
      message: gift.message,
      occasion: gift.occasion ? (OCCASION_LABELS[gift.occasion] ?? gift.occasion) : null,
      buyerEmail: gift.buyerEmail,
      status: gift.status,
    };
  }
}
