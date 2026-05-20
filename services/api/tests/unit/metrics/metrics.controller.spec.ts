import { register } from 'prom-client';
import { MetricsController } from '../../../src/metrics/metrics.controller';

describe('MetricsController', () => {
  let controller: MetricsController;

  beforeEach(() => {
    register.clear();
    controller = new MetricsController();
  });

  it('returns prometheus metrics with correct content type', async () => {
    const res: any = {
      set: jest.fn(),
      end: jest.fn(),
    };

    await controller.getMetrics(res);

    expect(res.set).toHaveBeenCalledWith('Content-Type', register.contentType);
    expect(res.end).toHaveBeenCalledWith(expect.any(String));
  });

  it('metrics output is non-empty', async () => {
    let output = '';
    const res: any = {
      set: jest.fn(),
      end: jest.fn((data: string) => { output = data; }),
    };

    await controller.getMetrics(res);

    expect(output.length).toBeGreaterThan(0);
  });
});
