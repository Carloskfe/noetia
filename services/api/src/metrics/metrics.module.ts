import { Module, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, register } from 'prom-client';
import { MetricsController } from './metrics.controller';

let defaultMetricsCollected = false;

@Module({
  controllers: [MetricsController],
})
export class MetricsModule implements OnModuleInit {
  onModuleInit() {
    if (!defaultMetricsCollected) {
      collectDefaultMetrics({ register });
      defaultMetricsCollected = true;
    }
  }
}
