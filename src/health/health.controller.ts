import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { AdminGuard } from '../auth/admin.guard';

@Controller('api/health')
export class HealthController {
  constructor(private healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Post('check')
  @UseGuards(AdminGuard)
  async runCheck() {
    return this.healthService.runCheck();
  }
}
