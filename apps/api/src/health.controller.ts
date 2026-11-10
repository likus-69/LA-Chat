import { Controller, Get } from '@nestjs/common';

/**
 * Liveness + readiness probe target. Bypasses the API version prefix.
 */
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      status: 'ok',
      service: 'la-chat-api',
      time: new Date().toISOString(),
    };
  }
}
