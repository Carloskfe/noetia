import { Controller, Get } from '@nestjs/common';

// Probed by the Docker healthcheck in docker-compose.server.yml. Traefik only routes
// /api to the container once this passes, so keep it cheap and dependency-free.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
