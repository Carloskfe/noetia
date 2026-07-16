import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { AuthProvider, DEFAULT_ONBOARDING_STATE, OnboardingState, User } from './user.entity';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly emailService: EmailService,
  ) {}

  findById(id: string) {
    return this.repo.findOneBy({ id });
  }

  findByEmail(email: string) {
    return this.repo.findOneBy({ email });
  }

  findByProvider(provider: AuthProvider, providerId: string) {
    return this.repo.findOneBy({ provider, providerId });
  }

  create(data: Partial<User>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<User>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  /** Merge a partial onboarding update into the user's stored state. Reads the
   *  current state (falling back to the default for legacy rows), applies only
   *  the provided fields, and persists — so concurrent surface/welcome updates
   *  never clobber each other's untouched fields. Returns the merged state. */
  async updateOnboarding(id: string, patch: UpdateOnboardingDto): Promise<OnboardingState> {
    const user = await this.findById(id);
    const current = user?.onboardingState ?? DEFAULT_ONBOARDING_STATE;
    const next: OnboardingState = {
      welcome: patch.welcome ?? current.welcome,
      welcomeStep: patch.welcomeStep ?? current.welcomeStep,
      tours: { ...current.tours },
    };
    if (patch.tourSeen) next.tours[patch.tourSeen] = true;
    await this.repo.update(id, { onboardingState: next });
    return next;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.repo.findOneBy({ id: userId });
    if (!user) return;

    const manager = this.dataSource.manager;

    // Delete data not covered by DB-level CASCADE on userId
    await manager.query(`DELETE FROM "user_books" WHERE "userId" = $1`, [userId]);
    await manager.query(`DELETE FROM "token_ledger" WHERE "userId" = $1`, [userId]);
    await manager.query(`DELETE FROM "user_cause_preferences" WHERE "userId" = $1`, [userId]);
    await manager.query(`DELETE FROM "courtesy_token_quotas" WHERE "creatorId" = $1`, [userId]);
    await manager.query(`DELETE FROM "subscriptions" WHERE "userId" = $1`, [userId]);
    await manager.query(`DELETE FROM "waitlist_entries" WHERE "email" = $1`, [user.email]);

    // Delete user — DB CASCADE covers: fragments, reading_progress
    await this.repo.delete(userId);

    // Farewell email (best-effort — don't block deletion if it fails)
    if (user.email) {
      const lang = (user.uiLanguage as 'es' | 'en') ?? 'es';
      await this.emailService.sendFarewell(user.email, user.name ?? (lang === 'en' ? 'Reader' : 'Lector'), lang).catch(() => {});
    }
  }
}
