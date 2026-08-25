import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmProvider } from './provider.interface';
import { OpenAICompatProvider } from './openai-compat.provider';
import { GeminiProvider } from './gemini.provider';
import { Provider } from '@prisma/client';

@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);

  constructor(private prisma: PrismaService) {}

  createFromConfig(config: Provider): LlmProvider {
    switch (config.type) {
      case 'openai-compat':
        return new OpenAICompatProvider(
          config.name,
          config.isPaid,
          config.apiKey,
          config.defaultModel,
          config.baseUrl || undefined,
        );
      case 'gemini':
        return new GeminiProvider(
          config.name,
          config.isPaid,
          config.apiKey,
          config.defaultModel,
        );
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  async getEnabledProviders(): Promise<LlmProvider[]> {
    const configs = await this.prisma.provider.findMany({
      where: { enabled: true },
      orderBy: { priority: 'asc' },
    });

    const providers: LlmProvider[] = [];
    for (const config of configs) {
      try {
        providers.push(this.createFromConfig(config));
      } catch (error) {
        this.logger.error(
          `Failed to create provider ${config.name}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return providers;
  }

  async getProviderByName(name: string): Promise<LlmProvider | null> {
    const config = await this.prisma.provider.findUnique({
      where: { name, enabled: true },
    });

    if (!config) return null;

    return this.createFromConfig(config);
  }
}
