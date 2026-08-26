import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';

export interface ProviderHealth {
  name: string;
  displayName: string;
  isPaid: boolean;
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
export class HealthService implements OnModuleInit {
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

  async onModuleInit() {
    try {
      const saved = await this.prisma.healthCheck.findUnique({
        where: { id: 'latest' },
      });
      if (saved) {
        this.cachedHealth = {
          status: saved.status as HealthStatus['status'],
          database: saved.database as 'ok' | 'error',
          providers: saved.providers as unknown as ProviderHealth[],
          lastCheck: saved.checkedAt.toISOString(),
        };
        this.logger.log(
          `Loaded last health check from DB: ${saved.status} (${saved.checkedAt.toISOString()})`,
        );
      }
    } catch {
      this.logger.warn('Could not load saved health check');
    }
  }

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

    const providers = await Promise.all(
      configs.map(async (config): Promise<ProviderHealth> => {
        const start = Date.now();
        try {
          const provider = this.providerFactory.createFromConfig(config);
          await provider.chat({
            messages: [{ role: 'user', content: 'Say ok' }],
            max_tokens: 5,
          });
          return {
            name: config.name,
            displayName: config.displayName,
            isPaid: config.isPaid,
            status: 'healthy',
            latencyMs: Date.now() - start,
            error: null,
            checkedAt: new Date().toISOString(),
          };
        } catch (err) {
          return {
            name: config.name,
            displayName: config.displayName,
            isPaid: config.isPaid,
            status: 'unhealthy',
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : String(err),
            checkedAt: new Date().toISOString(),
          };
        }
      }),
    );

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

    await this.prisma.healthCheck
      .upsert({
        where: { id: 'latest' },
        update: {
          status,
          database,
          providers: providers as unknown as object[],
          checkedAt: new Date(),
        },
        create: {
          id: 'latest',
          status,
          database,
          providers: providers as unknown as object[],
          checkedAt: new Date(),
        },
      })
      .catch((err) => {
        this.logger.error(`Failed to save health check: ${err.message}`);
      });

    this.logger.log(
      `Health check complete: ${status} (${healthyCount}/${providers.length} providers healthy)`,
    );

    return this.cachedHealth;
  }
}
