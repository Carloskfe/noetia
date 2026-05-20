import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, register } from 'prom-client';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  private readonly counter: Counter<string>;
  private readonly histogram: Histogram<string>;

  constructor() {
    this.counter =
      (register.getSingleMetric('http_requests_total') as Counter<string>) ??
      new Counter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status'],
      });

    this.histogram =
      (register.getSingleMetric('http_request_duration_seconds') as Histogram<string>) ??
      new Histogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds',
        labelNames: ['method', 'route', 'status'],
        buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      });
  }

  use(req: Request, res: Response, next: NextFunction) {
    const startMs = Date.now();
    res.on('finish', () => {
      const route = (req.route?.path as string | undefined) ?? req.path ?? 'unknown';
      const labels = { method: req.method, route, status: String(res.statusCode) };
      this.counter.inc(labels);
      this.histogram.observe(labels, (Date.now() - startMs) / 1000);
    });
    next();
  }
}
