import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cause } from './cause.entity';
import { UserCausePreference } from './user-cause-preference.entity';
import { SavePreferencesDto } from './dto/save-preferences.dto';

@Injectable()
export class CausesService {
  constructor(
    @InjectRepository(Cause)
    private readonly causeRepo: Repository<Cause>,
    @InjectRepository(UserCausePreference)
    private readonly prefRepo: Repository<UserCausePreference>,
  ) {}

  findAllActive(): Promise<Cause[]> {
    return this.causeRepo.find({ where: { active: true }, order: { createdAt: 'ASC' } });
  }

  async getPreferences(userId: string): Promise<UserCausePreference | null> {
    return this.prefRepo.findOne({ where: { userId } });
  }

  /**
   * PO-053: one selected cause, or no preference (equal split across the three causes).
   * Stored in the existing columns without a schema change: `cause1Id` = the single cause (null = no
   * preference); every new save writes `cause2Id = null` and `randomDistribution = false`.
   * This records a preference only — no allocation or payout happens here.
   */
  async savePreferences(userId: string, dto: SavePreferencesDto): Promise<UserCausePreference> {
    // Defence in depth: the DTO already rejects these at the HTTP boundary.
    if (dto.cause2Id) throw new BadRequestException('Only one cause can be selected.');
    if (dto.randomDistribution) throw new BadRequestException('Random distribution is not available.');

    const causeId = dto.cause1Id ?? null;
    let cause: Cause | null = null;
    if (causeId) {
      cause = await this.causeRepo.findOne({ where: { id: causeId, active: true } });
      if (!cause) throw new BadRequestException('Unknown cause.');
    }

    let pref = await this.prefRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.prefRepo.create({ userId });
    }
    // Keep the eager relation objects consistent with the FK columns so TypeORM cannot write a stale
    // relation back over the new id.
    pref.cause1 = cause;
    pref.cause1Id = causeId;
    pref.cause2 = null;
    pref.cause2Id = null;
    pref.randomDistribution = false;
    return this.prefRepo.save(pref);
  }
}
