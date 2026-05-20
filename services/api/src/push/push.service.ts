import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(PushToken)
    private readonly tokenRepo: Repository<PushToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async registerToken(userId: string, token: string, platform: string): Promise<void> {
    await this.tokenRepo.upsert(
      { userId, token, platform },
      { conflictPaths: ['userId', 'token'] },
    );
  }

  async sendToUser(userId: string, type: string, vars: Record<string, unknown> = {}): Promise<void> {
    const [tokens, user] = await Promise.all([
      this.tokenRepo.findBy({ userId }),
      this.userRepo.findOneBy({ id: userId }),
    ]);
    if (!tokens.length) return;

    const lang = user?.uiLanguage ?? 'es';
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
    } catch (err) {
      this.logger.warn(`Push failed to ${to}: ${(err as Error).message}`);
    }
  }
}
