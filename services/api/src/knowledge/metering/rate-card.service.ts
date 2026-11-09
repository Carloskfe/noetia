import { Injectable } from '@nestjs/common';
import { KnowledgeDbService } from '../common/knowledge-db.service';

export interface RateCard {
  id: string;
  provider: string;
  modelKey: string;
  version: number;
  microUsdPerUnit: string;
}

/**
 * Versioned rate cards: internal units → integer micro-USD (ADR-005). Cost is
 * recorded separately from units so a provider price change never silently
 * shrinks a customer allowance. No card is seeded; values are test fixtures.
 */
@Injectable()
export class RateCardService {
  constructor(private readonly db: KnowledgeDbService) {}

  async active(provider: string, modelKey: string): Promise<RateCard | null> {
    const rows = await this.db.query<RateCard>(
      `SELECT id, provider, "modelKey", version, "microUsdPerUnit"::text AS "microUsdPerUnit"
         FROM ai_rate_cards WHERE provider = $1 AND "modelKey" = $2 AND active = true
        ORDER BY version DESC LIMIT 1`,
      [provider, modelKey],
    );
    return rows[0] ?? null;
  }

  /** Integer micro-USD, computed with BigInt to avoid float drift. */
  cost(units: number, card: RateCard): string {
    if (!Number.isInteger(units) || units < 0) throw new Error('units must be a non-negative integer');
    return (BigInt(units) * BigInt(card.microUsdPerUnit)).toString();
  }
}
