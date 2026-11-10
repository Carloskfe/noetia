import { Logger } from '@nestjs/common';
import { CostReconciliationJobService } from '../../../../src/knowledge/metering/cost-reconciliation-job.service';

describe('CostReconciliationJobService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());
  const quiet = { settled: 0, released: 0, flaggedExpired: 0, held: 2 };

  it('runs a pass, returns its summary, and logs counts only', async () => {
    const s = { settled: 2, released: 1, flaggedExpired: 0, held: 0 };
    const job = new CostReconciliationJobService({ reconcileAttempts: jest.fn().mockResolvedValue(s) } as any);
    expect(await job.tick()).toEqual(s);
    expect(Logger.prototype.log).toHaveBeenCalledWith('attempts reconciled settled=2 released=1 flagged=0 held=0');
  });

  it('stays quiet when nothing changed', async () => {
    await new CostReconciliationJobService({ reconcileAttempts: jest.fn().mockResolvedValue(quiet) } as any).tick();
    expect(Logger.prototype.log).not.toHaveBeenCalled();
  });

  it('swallows failures and allows the next pass', async () => {
    const reconcileAttempts = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(quiet);
    const job = new CostReconciliationJobService({ reconcileAttempts } as any);
    expect(await job.tick()).toBeNull();
    expect(Logger.prototype.warn).toHaveBeenCalledWith('attempt reconciliation pass failed; will retry');
    expect(await job.tick()).toEqual(quiet);
  });

  it('never overlaps passes', async () => {
    let release!: (v: unknown) => void;
    const reconcileAttempts = jest.fn(() => new Promise((r) => { release = r; }));
    const job = new CostReconciliationJobService({ reconcileAttempts } as any);
    const first = job.tick();
    expect(await job.tick()).toBeNull();
    release(quiet);
    expect(await first).toEqual(quiet);
    expect(reconcileAttempts).toHaveBeenCalledTimes(1);
  });
});
