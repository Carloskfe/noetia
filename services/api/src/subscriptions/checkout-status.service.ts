import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { UserBook } from '../library/user-book.entity';
import { fulfillmentKey } from './stripe-fulfillment-ledger';
import { StripeProcessedEvent } from './stripe-processed-event.entity';
import { Subscription } from './subscription.entity';

/**
 * G-1: authenticated, READ-ONLY verification of one Stripe Checkout session
 * (docs/reports/payment-lifecycle-20261112/g1-checkout-verification-design.md §R3/§R4; contract §R3.4).
 *
 * Read-only by construction: the only Stripe call is `checkout.sessions.retrieve`; the only database access is
 * counting the session's fulfillment key, counting one `user_books` row (book) and reading the caller's own
 * subscription row. It never claims a key, issues tokens, adds a book, writes a subscription or runs webhook
 * fulfillment — the Stripe webhook stays the only fulfillment path.
 *
 * R1-B (PO, final): a token-package session is NEVER reported `delivered`. The fulfillment key proves only that
 * the webhook processed the session (it is claimed before fulfillment, and an inactive package issues nothing —
 * W-1), so the strongest token outcome is `unconfirmed`. The token path reads nothing from `token_ledger`, token
 * balances, timestamps or `reason` text.
 */
export type CheckoutState = 'open' | 'complete' | 'expired';
export type PaymentState = 'paid' | 'unpaid' | 'no_payment_required';
export type Entitlement = null | 'not_recorded' | 'active' | 'payment_problem' | 'ended' | 'superseded';

export type CheckoutSessionStatus =
  | { kind: 'subscription'; checkout: CheckoutState; entitlement: Entitlement }
  | { kind: 'tokens'; checkout: CheckoutState; payment: PaymentState; delivery: null | 'pending' | 'unconfirmed' }
  | { kind: 'book'; checkout: CheckoutState; payment: PaymentState; delivery: null | 'pending' | 'delivered' | 'unconfirmed' };

/** The caller, as attached to the request by JwtStrategy (the User entity). */
export interface CheckoutStatusCaller {
  id: string;
  stripeCustomerId?: string | null;
}

/** Public format of a Stripe Checkout session id (§7.2). Anything else is rejected without calling Stripe. */
export const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

const ENTITLED = new Set(['trialing', 'active', 'canceling']);
const LIVE = new Set(['trialing', 'active', 'canceling', 'past_due']);
const CHECKOUT_STATES = new Set<CheckoutState>(['open', 'complete', 'expired']);

const notFound = () => new NotFoundException({ error: 'checkout_session_not_found' });
const unavailable = () => new ServiceUnavailableException({ error: 'checkout_status_unavailable' });

/** `cs_live_…abc123` — never the full id in logs (§7.2, CLAUDE.md: no PII / identifiers in logs). */
export const truncateSessionId = (id: string) => `${id.slice(0, id.indexOf('_', 3) + 1)}…${id.slice(-6)}`;

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof (v as { id?: unknown }).id === 'string' ? (v as { id: string }).id : null;

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

@Injectable()
export class CheckoutStatusService {
  private readonly logger = new Logger(CheckoutStatusService.name);
  private readonly stripe: InstanceType<typeof Stripe> | null;

  constructor(
    config: ConfigService,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(UserBook) private readonly userBookRepo: Repository<UserBook>,
    @InjectRepository(StripeProcessedEvent) private readonly processedRepo: Repository<StripeProcessedEvent>,
  ) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    this.stripe = key ? new Stripe(key) : null;
  }

  async getStatus(caller: CheckoutStatusCaller, sessionId: string): Promise<CheckoutSessionStatus> {
    if (typeof sessionId !== 'string' || !CHECKOUT_SESSION_ID.test(sessionId)) throw notFound();
    if (!this.stripe) throw unavailable();

    let session: any;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (err: any) {
      // Unknown id or another Stripe account/mode → the uniform 404; anything else → 503, no Stripe message.
      if (err?.statusCode === 404 || err?.code === 'resource_missing') throw notFound();
      this.logger.warn(`[checkout-status] Stripe unavailable for ${truncateSessionId(sessionId)} (${err?.type ?? 'error'})`);
      throw unavailable();
    }
    if (!session || session.id !== sessionId) throw notFound();

    const metadata = (session.metadata ?? {}) as Record<string, string | undefined>;
    if (metadata.type === 'gift') throw notFound(); // G-b: gift sessions are never answered, whoever asks.

    const checkout = session.status as CheckoutState;
    const kind = this.kindOf(session, metadata);
    if (!kind || !this.owns(caller, session, metadata, kind)) throw notFound();
    if (!CHECKOUT_STATES.has(checkout)) {
      this.logger.warn(`[checkout-status] unmappable Checkout status for ${truncateSessionId(sessionId)}`);
      throw unavailable(); // cannot be mapped safely → no claim at all
    }

    try {
      if (kind === 'subscription') {
        return { kind, checkout, entitlement: checkout === 'complete' ? await this.entitlementOf(caller, session) : null };
      }
      const payment = this.paymentOf(session.payment_status);
      const paidAndComplete = checkout === 'complete' && payment === 'paid';
      if (kind === 'tokens') {
        // R1-B: key → `unconfirmed` (processing recorded, issuance not independently verified); never `delivered`.
        const delivery = paidAndComplete ? ((await this.keyExists(sessionId)) ? 'unconfirmed' : 'pending') : null;
        return { kind, checkout, payment, delivery };
      }
      return { kind, checkout, payment, delivery: paidAndComplete ? await this.bookDelivery(caller, sessionId, metadata.bookId!) : null };
    } catch (err: any) {
      if (err instanceof NotFoundException || err instanceof ServiceUnavailableException) throw err;
      this.logger.warn(`[checkout-status] database unavailable for ${truncateSessionId(sessionId)} (${err?.name ?? 'error'})`);
      throw unavailable();
    }
  }

  /** Kind from Stripe's own `mode` + Noetia's server-written metadata only — never from the browser. */
  private kindOf(session: any, metadata: Record<string, string | undefined>): CheckoutSessionStatus['kind'] | null {
    if (session.mode === 'subscription') return 'subscription';
    if (session.mode !== 'payment' || !nonEmpty(metadata.userId)) return null;
    // Same precedence as the webhook (handlePaymentCompleted): a token package wins over a book.
    if (nonEmpty(metadata.tokenPackageId)) return 'tokens';
    if (nonEmpty(metadata.bookId)) return 'book';
    return null;
  }

  /** §7.1 ownership. Every failure is indistinguishable from an unknown session (uniform 404). */
  private owns(caller: CheckoutStatusCaller, session: any, metadata: Record<string, string | undefined>, kind: string): boolean {
    const customer = idOf(session.customer);
    const callerCustomer = nonEmpty(caller.stripeCustomerId) ? caller.stripeCustomerId : null;
    if (kind === 'subscription') {
      // Sessions created by PR #60 carry noetiaUserId; older ones fall back to the Stripe customer.
      if (nonEmpty(metadata.noetiaUserId)) return metadata.noetiaUserId === caller.id;
      return !!customer && !!callerCustomer && customer === callerCustomer;
    }
    if (metadata.userId !== caller.id) return false;
    return !(customer && callerCustomer && customer !== callerCustomer);
  }

  private paymentOf(status: unknown): PaymentState {
    return status === 'paid' || status === 'no_payment_required' ? status : 'unpaid';
  }

  private async keyExists(sessionId: string): Promise<boolean> {
    return (await this.processedRepo.countBy({ eventId: fulfillmentKey('checkout-session', sessionId) })) > 0;
  }

  /** Book: `delivered` needs the key AND the durable ownership row; a key without the row is `unconfirmed`. */
  private async bookDelivery(caller: CheckoutStatusCaller, sessionId: string, bookId: string): Promise<'pending' | 'delivered' | 'unconfirmed'> {
    if (!(await this.keyExists(sessionId))) return 'pending';
    if ((await this.userBookRepo.countBy({ userId: caller.id, bookId })) > 0) return 'delivered';
    this.logger.warn(`[checkout-status] fulfillment key without book ownership: user ${caller.id}, session ${truncateSessionId(sessionId)}`);
    return 'unconfirmed';
  }

  /**
   * Entitlement for THIS session's subscription only: the caller's own row must track exactly
   * `session.subscription`. An unrelated active subscription never confirms this Checkout. An active
   * entitlement says nothing about token allocation (§R2.7) — no token evidence is read.
   */
  private async entitlementOf(caller: CheckoutStatusCaller, session: any): Promise<Exclude<Entitlement, null>> {
    const subscriptionId = idOf(session.subscription);
    if (!subscriptionId) return 'not_recorded';
    const row = await this.subRepo.findOneBy({ userId: caller.id });
    if (!row || !row.stripeSubscriptionId) return 'not_recorded';
    if (row.stripeSubscriptionId !== subscriptionId) {
      // The row tracks another subscription. If that one is still live, this Checkout is superseded; if it has
      // ended, the webhook for this session may simply not have been recorded yet (non-terminal).
      return LIVE.has(row.status) ? 'superseded' : 'not_recorded';
    }
    if (ENTITLED.has(row.status)) return 'active';
    if (row.status === 'past_due') return 'payment_problem';
    if (row.status === 'canceled') return 'ended';
    return 'not_recorded';
  }
}
