import { Injectable, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { LlmRequest, LlmResponse } from '../providers/provider.interface';

export interface RouteOptions {
  provider?: string;
  freeOnly?: boolean;
}

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  constructor(
    private providerFactory: ProviderFactory,
    private prisma: PrismaService,
  ) {}

  async route(request: LlmRequest, options: RouteOptions): Promise<LlmResponse> {
    if (options.provider) {
      const provider = await this.providerFactory.getProviderByName(
        options.provider,
      );
      if (!provider) {
        throw new HttpException(
          { error: `Provider "${options.provider}" not found or disabled` },
          404,
        );
      }
      return provider.chat(request);
    }

    const freeOnly = await this.resolveFreeOnly(options.freeOnly);
    const providers = await this.providerFactory.getEnabledProviders();

    const filtered = freeOnly
      ? providers.filter((p) => !p.isPaid)
      : providers;

    if (filtered.length === 0) {
      throw new HttpException(
        {
          error: 'No providers available',
          freeOnly,
        },
        503,
      );
    }

    const errors: { provider: string; error: string }[] = [];

    for (const provider of filtered) {
      try {
        this.logger.log(`Trying provider: ${provider.name}`);
        return await provider.chat(request);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Provider ${provider.name} failed: ${message}`);
        errors.push({ provider: provider.name, error: message });
      }
    }

    throw new HttpException(
      {
        error: 'All providers failed',
        providers_tried: errors,
      },
      503,
    );
  }

  private async resolveFreeOnly(
    requestFreeOnly?: boolean,
  ): Promise<boolean> {
    if (requestFreeOnly !== undefined) return requestFreeOnly;

    const config = await this.prisma.gatewayConfig.findUnique({
      where: { id: 'default' },
    });

    return config?.freeOnlyDefault ?? true;
  }
}
