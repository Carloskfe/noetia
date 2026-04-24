import { processImageRender } from '../../../src/jobs/image-render.job';
import type { Job } from 'bullmq';

const makeJob = (id: string, data: Record<string, unknown> = {}): Job =>
  ({ id, data } as unknown as Job);

describe('processImageRender', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves without throwing for a valid job', async () => {
    const job = makeJob('job-1', { fragmentId: 'f1', platform: 'linkedin' });
    await expect(processImageRender(job)).resolves.toBeUndefined();
  });

  it('logs the job id and data to console', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const job = makeJob('job-42', { platform: 'instagram' });
    await processImageRender(job);
    expect(spy).toHaveBeenCalledWith('[image-render] processing job job-42', job.data);
  });

  it('handles jobs with empty data', async () => {
    const job = makeJob('job-empty', {});
    await expect(processImageRender(job)).resolves.toBeUndefined();
  });

  it('handles jobs with complex nested data', async () => {
    const job = makeJob('job-complex', {
      fragmentId: 'f99',
      platform: 'facebook',
      user: { id: 'u1', name: 'Alice' },
    });
    await expect(processImageRender(job)).resolves.toBeUndefined();
  });
});
