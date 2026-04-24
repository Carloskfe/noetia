import { processShareExport } from '../../../src/jobs/share-export.job';
import type { Job } from 'bullmq';

const makeJob = (id: string, data: Record<string, unknown> = {}): Job =>
  ({ id, data } as unknown as Job);

describe('processShareExport', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves without throwing for a valid job', async () => {
    const job = makeJob('job-2', { shareId: 's1', platform: 'whatsapp' });
    await expect(processShareExport(job)).resolves.toBeUndefined();
  });

  it('logs the job id and data to console', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const job = makeJob('job-99', { platform: 'linkedin' });
    await processShareExport(job);
    expect(spy).toHaveBeenCalledWith('[share-export] processing job job-99', job.data);
  });

  it('handles jobs with empty data', async () => {
    const job = makeJob('job-empty', {});
    await expect(processShareExport(job)).resolves.toBeUndefined();
  });

  it('handles jobs with multiple platforms', async () => {
    const job = makeJob('job-multi', { shareId: 's2', platforms: ['linkedin', 'instagram'] });
    await expect(processShareExport(job)).resolves.toBeUndefined();
  });
});
