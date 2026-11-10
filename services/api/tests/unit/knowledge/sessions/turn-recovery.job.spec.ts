import { TurnRecoveryJobService } from '../../../../src/knowledge/sessions/turn-recovery.job';

describe('TurnRecoveryJobService (periodic fenced finalization)', () => {
  it('sweeps, counts, never overlaps, and survives failures', async () => {
    let release!: () => void;
    const records = { sweep: jest.fn(() => new Promise<number>((res) => { release = () => res(3); })) };
    const metrics = { finalizedInc: jest.fn() };
    const job = new TurnRecoveryJobService(records as any, metrics as any);
    const first = job.tick();
    expect(await job.tick()).toBeNull(); // no overlapping run
    release();
    expect(await first).toBe(3);
    expect(records.sweep).toHaveBeenCalledWith(500);
    expect(metrics.finalizedInc).toHaveBeenCalledWith('sweep', 3);
    records.sweep.mockImplementationOnce(async () => { throw new Error('db down'); });
    expect(await job.tick()).toBeNull();
    records.sweep.mockImplementationOnce(async () => 0);
    expect(await job.tick()).toBe(0);
  });
});
