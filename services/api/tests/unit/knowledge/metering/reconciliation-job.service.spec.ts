import { Logger } from '@nestjs/common';
import { ReconciliationJobService } from '../../../../src/knowledge/metering/reconciliation-job.service';

describe('ReconciliationJobService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('runs a reconciliation pass and returns its summary', async () => {
    const summary = { settled: 1, released: 0, flaggedExpired: 0, held: 0 };
    const job = new ReconciliationJobService({ reconcile: jest.fn().mockResolvedValue(summary) } as any);
    expect(await job.tick()).toEqual(summary);
  });

  it('stays quiet when nothing changed', async () => {
    const job = new ReconciliationJobService({ reconcile: jest.fn().mockResolvedValue({ settled: 0, released: 0, flaggedExpired: 0, held: 3 }) } as any);
    await job.tick();
    expect(Logger.prototype.log).not.toHaveBeenCalled();
  });

  it('swallows failures and allows the next pass', async () => {
    const reconcile = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce({ settled: 0, released: 0, flaggedExpired: 0, held: 0 });
    const job = new ReconciliationJobService({ reconcile } as any);
    expect(await job.tick()).toBeNull();
    expect(await job.tick()).not.toBeNull();
  });

  it('never overlaps passes', async () => {
    let release!: () => void;
    const reconcile = jest.fn(() => new Promise((r) => (release = () => r({ settled: 0, released: 0, flaggedExpired: 0, held: 0 }))));
    const job = new ReconciliationJobService({ reconcile } as any);
    const first = job.tick();
    expect(await job.tick()).toBeNull();
    release();
    await first;
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
