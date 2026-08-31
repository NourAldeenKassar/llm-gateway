import { Injectable, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { LlmRequest, LlmResponse } from '../providers/provider.interface';

export interface RouteOptions {
  provider?: string;
  freeOnly?: boolean;
  source?: string;
  apiKeyName?: string;
}

@Injectable()
export class RouterService {
  private readonly logger = new Logger(RouterService.name);

  constructor(
    private providerFactory: ProviderFactory,
    private prisma: PrismaService,
  ) {}

  async route(
    request: LlmRequest,
    options: RouteOptions,
  ): Promise<LlmResponse> {
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

      const start = Date.now();
      try {
        const result = await provider.chat(request);
        await this.logRequest({
          provider: provider.name,
          model: result.model,
          status: 'success',
          latencyMs: Date.now() - start,
          usage: result.usage,
          source: options.source,
          apiKeyName: options.apiKeyName,
        });
        return result;
      } catch (error) {
        const isRateLimit = this.isRateLimitError(error);
        await this.logRequest({
          provider: provider.name,
          model: request.model || provider.defaultModel,
          status: isRateLimit ? 'rate_limited' : 'error',
          latencyMs: Date.now() - start,
          error: error instanceof Error ? error.message : String(error),
          source: options.source,
          apiKeyName: options.apiKeyName,
        });
        throw error;
      }
    }

    const freeOnly = await this.resolveFreeOnly(options.freeOnly);
    const providers = await this.providerFactory.getEnabledProviders(freeOnly);

    if (providers.length === 0) {
      throw new HttpException(
        { error: 'No providers available', freeOnly },
        503,
      );
    }

    const errors: { provider: string; error: string }[] = [];

    for (const provider of providers) {
      const start = Date.now();
      try {
        this.logger.log(`Trying provider: ${provider.name}`);
        const result = await provider.chat(request);
        await this.logRequest({
          provider: provider.name,
          model: result.model,
          status: 'success',
          latencyMs: Date.now() - start,
          usage: result.usage,
          source: options.source,
          apiKeyName: options.apiKeyName,
        });
        return {
          ...result,
          failedProviders: errors.length > 0 ? errors : undefined,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isRateLimit = this.isRateLimitError(error);
        this.logger.warn(`Provider ${provider.name} failed: ${message}`);
        errors.push({ provider: provider.name, error: message });
        await this.logRequest({
          provider: provider.name,
          model: request.model || provider.defaultModel,
          status: isRateLimit ? 'rate_limited' : 'error',
          latencyMs: Date.now() - start,
          error: message,
          source: options.source,
          apiKeyName: options.apiKeyName,
        });
      }
    }

    throw new HttpException(
      { error: 'All providers failed', providers_tried: errors },
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

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('rate limit') ||
        msg.includes('rate_limit') ||
        msg.includes('429') ||
        msg.includes('too many requests') ||
        msg.includes('quota')
      );
    }
    return false;
  }

  private async logRequest(data: {
    provider: string;
    model: string;
    status: string;
    latencyMs: number;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    error?: string;
    source?: string;
    apiKeyName?: string;
  }): Promise<void> {
    try {
      await this.prisma.requestLog.create({
        data: {
          provider: data.provider,
          model: data.model,
          status: data.status,
          latencyMs: data.latencyMs,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
          error: data.error,
          source: data.source || 'api',
          apiKeyName: data.apiKeyName,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to log request: ${err}`);
    }
  }
}
