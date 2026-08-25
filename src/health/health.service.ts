import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';

export interface ProviderHealth {
  name: string;
  displayName: string;
  status: 'healthy' | 'unhealthy';
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unchecked';
  database: 'ok' | 'error';
  providers: ProviderHealth[];
  lastCheck: string | null;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private cachedHealth: HealthStatus = {
    status: 'unchecked',
    database: 'error',
    providers: [],
    lastCheck: null,
  };

  constructor(
    private prisma: PrismaService,
    private providerFactory: ProviderFactory,
  ) {}

  getHealth(): HealthStatus {
    return this.cachedHealth;
  }

  async runCheck(): Promise<HealthStatus> {
    this.logger.log('Running health check...');

    let database: 'ok' | 'error' = 'error';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch {
      this.logger.error('Database health check failed');
    }

    const configs = await this.prisma.provider
      .findMany({ where: { enabled: true }, orderBy: { priority: 'asc' } })
      .catch(() => []);

    const providers: ProviderHealth[] = [];

    for (const config of configs) {
      const start = Date.now();
      try {
        const provider = this.providerFactory.createFromConfig(config);
        await provider.chat({
          messages: [{ role: 'user', content: 'Say ok' }],
          max_tokens: 5,
        });
        providers.push({
          name: config.name,
          displayName: config.displayName,
          status: 'healthy',
          latencyMs: Date.now() - start,
          error: null,
          checkedAt: new Date().toISOString(),
        });
      } catch (err) {
        providers.push({
          name: config.name,
          displayName: config.displayName,
          status: 'unhealthy',
          latencyMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
          checkedAt: new Date().toISOString(),
        });
      }
    }

    const healthyCount = providers.filter((p) => p.status === 'healthy').length;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'unhealthy';
    if (database === 'ok' && healthyCount === providers.length && providers.length > 0) {
      status = 'healthy';
    } else if (database === 'ok' && healthyCount > 0) {
      status = 'degraded';
    }

    this.cachedHealth = {
      status,
      database,
      providers,
      lastCheck: new Date().toISOString(),
    };

    this.logger.log(
      `Health check complete: ${status} (${healthyCount}/${providers.length} providers healthy)`,
    );

    return this.cachedHealth;
  }
}
