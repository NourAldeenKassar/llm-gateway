import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';

@Controller('api/health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private providerFactory: ProviderFactory,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
    }

    const providers = await this.providerFactory.getEnabledProviders();
    checks.providers = `${providers.length} enabled`;

    const healthy = checks.database === 'ok';

    return {
      status: healthy ? 'ok' : 'degraded',
      checks,
    };
  }
}
