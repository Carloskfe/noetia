import { RateCardService } from '../../../../src/knowledge/metering/rate-card.service';
import { FakeDb } from '../support/fixtures';

describe('RateCardService', () => {
  const card = { id: 'rc', provider: 'simulated', modelKey: 'simulated-v1', version: 2, microUsdPerUnit: '9007199254740993' };

  it('returns the latest active card', async () => {
    const db = new FakeDb().on(/FROM ai_rate_cards/, () => [card]);
    expect(await new RateCardService(db as any).active('simulated', 'simulated-v1')).toEqual(card);
    expect(db.calls[0].sql).toMatch(/ORDER BY version DESC LIMIT 1/);
  });

  it('returns null when no card exists', async () => {
    const db = new FakeDb().on(/FROM ai_rate_cards/, () => []);
    expect(await new RateCardService(db as any).active('simulated', 'x')).toBeNull();
  });

  it('computes integer micro-USD with BigInt (no float drift)', () => {
    expect(new RateCardService(new FakeDb() as any).cost(3, card)).toBe('27021597764222979');
  });

  it('rejects negative or fractional units', () => {
    const svc = new RateCardService(new FakeDb() as any);
    expect(() => svc.cost(-1, card)).toThrow();
    expect(() => svc.cost(1.2, card)).toThrow();
  });
});
