import { register } from 'prom-client';
import { MetricsMiddleware } from '../../../src/metrics/metrics.middleware';

describe('MetricsMiddleware', () => {
  let middleware: MetricsMiddleware;

  beforeEach(() => {
    register.clear();
    middleware = new MetricsMiddleware();
  });

  it('calls next()', () => {
    const req: any = { method: 'GET', path: '/health', route: { path: '/health' } };
    const res: any = { on: jest.fn(), statusCode: 200 };
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('records metrics on response finish', async () => {
    let finishHandler: () => void;
    const req: any = { method: 'GET', path: '/books', route: { path: '/books' } };
    const res: any = {
      statusCode: 200,
      on: jest.fn((event, handler) => { if (event === 'finish') finishHandler = handler; }),
    };

    middleware.use(req, res, jest.fn());
    finishHandler!();

    const metrics = await register.getMetricsAsJSON();
    const counter = metrics.find(m => m.name === 'http_requests_total');
    expect(counter).toBeDefined();
    const value = (counter as any).values.find(
      (v: any) => v.labels.method === 'GET' && v.labels.route === '/books' && v.labels.status === '200',
    );
    expect(value?.value).toBe(1);
  });

  it('falls back to req.path when req.route is undefined', async () => {
    let finishHandler: () => void;
    const req: any = { method: 'POST', path: '/unknown-path' };
    const res: any = {
      statusCode: 404,
      on: jest.fn((event, handler) => { if (event === 'finish') finishHandler = handler; }),
    };

    middleware.use(req, res, jest.fn());
    finishHandler!();

    const metrics = await register.getMetricsAsJSON();
    const counter = metrics.find(m => m.name === 'http_requests_total');
    const value = (counter as any).values.find(
      (v: any) => v.labels.status === '404',
    );
    expect(value?.value).toBe(1);
  });

  it('records duration in histogram', async () => {
    let finishHandler: () => void;
    const req: any = { method: 'GET', path: '/books', route: { path: '/books' } };
    const res: any = {
      statusCode: 200,
      on: jest.fn((event, handler) => { if (event === 'finish') finishHandler = handler; }),
    };

    middleware.use(req, res, jest.fn());
    await new Promise(r => setTimeout(r, 10));
    finishHandler!();

    const metrics = await register.getMetricsAsJSON();
    const hist = metrics.find(m => m.name === 'http_request_duration_seconds');
    expect(hist).toBeDefined();
  });
});
