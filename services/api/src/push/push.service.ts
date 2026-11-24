import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { PushToken } from './push-token.entity';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function buildContent(lang: string, type: string, vars: Record<string, unknown>): NotificationPayload {
  const en = lang === 'en';
  switch (type) {
    case 'invite_accepted':
      return {
        title: en ? 'Invitation accepted' : 'Invitación aceptada',
        body: en
          ? `Someone joined your ${vars.planName} plan on Noetia`
          : `Alguien se unió a tu plan ${vars.planName} en Noetia`,
        data: { type },
      };
    case 'gift_claimed': {
      const n = vars.tokenCount as number;
      return {
        title: en ? 'Gift claimed! 🎉' : '¡Regalo reclamado! 🎉',
        body: en
          ? `Your ${n} token gift has been claimed`
          : `Tu regalo de ${n} token${n !== 1 ? 's' : ''} fue reclamado`,
        data: { type },
      };
    }
    default:
      return { title: 'Noetia', body: String(vars.message ?? '') };
  }
}

/**
 * Namespace (first key) for the transaction-scoped advisory lock that serializes registrations of one token
 * (SP-1-I1). The second key is `hashtext(token)`; a hash collision only serializes two unrelated tokens.
 */
/** Static warning for a failed Expo submission (F-SP1-I1-1): carries no exception text or identifier. */
export const PUSH_SUBMISSION_FAILED_LOG = 'Push submission failed (details withheld)';

export const PUSH_TOKEN_LOCK_NAMESPACE = 53010001;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushToken)
    private readonly tokenRepo: Repository<PushToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Registers `token` for `userId` as its SOLE owner (SP-1-I1, PO decision SP-D1): in one transaction, take a
   * transaction-scoped advisory lock for the token, remove the token's registrations held by other accounts,
   * then upsert this account's registration. Concurrent registrations of the same token are serialized by the
   * lock, so exactly one account owns it after commit. Any failure rolls the whole reassignment back. Different
   * tokens of the same user are untouched (multi-device). No raw token or identifier is logged.
   */
  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    const evicted = await this.tokenRepo.manager.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [PUSH_TOKEN_LOCK_NAMESPACE, token]);
      const removed = await em.delete(PushToken, { token, userId: Not(userId) });
      await em.getRepository(PushToken).upsert(
        { userId, token, platform },
        { conflictPaths: ['userId', 'token'] },
      );
      return removed.affected ?? 0;
    });
    if (evicted > 0) {
      this.logger.log(`push.register: token reassigned; ${evicted} previous registration(s) removed`);
    }
  }

  async sendToUser(userId: string, type: string, vars: Record<string, unknown> = {}): Promise<void> {
    const [tokens, user] = await Promise.all([
      this.tokenRepo.findBy({ userId }),
      this.userRepo.findOneBy({ id: userId }),
    ]);
    // SP-1-I1 (mandatory): never submit for an account that no longer exists, even if orphaned
    // registrations remain (e.g. a deleted gift buyer whose old gift is claimed later).
    if (!user) return;
    if (!tokens.length) return;

    const lang = user.uiLanguage ?? 'es';
    const { title, body, data } = buildContent(lang, type, vars);

    await Promise.allSettled(
      tokens.map((t) => this.sendExpo(t.token, title, body, data)),
    );
  }

  private async sendExpo(
    to: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ to, title, body, data: data ?? {}, sound: 'default' }),
      });
    } catch {
      // SP-1-I1 / F-SP1-I1-1: static, identifier-free message. The exception text is uncontrolled
      // (it may echo the token, an email or a user ID), so it is never interpolated or logged.
      this.logger.warn(PUSH_SUBMISSION_FAILED_LOG);
    }
  }
}
