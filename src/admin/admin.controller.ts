import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderFactory } from '../providers/provider.factory';
import { RouterService } from '../router/router.service';
import { AdminGuard } from '../auth/admin.guard';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { AdminChatDto } from './dto/admin-chat.dto';
import { ChatMessage } from '../providers/provider.interface';

@Controller('api/admin')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private providerFactory: ProviderFactory,
    private router: RouterService,
    private config: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: { password: string }, @Res() res: Response) {
    const gatewayConfig = await this.prisma.gatewayConfig.findUnique({
      where: { id: 'default' },
    });

    const validPassword =
      gatewayConfig?.adminPassword ||
      this.config.get<string>('ADMIN_PASSWORD');

    if (!validPassword || body.password !== validPassword) {
      throw new HttpException('Invalid password', 401);
    }

    const sessionSecret = uuidv4();
    process.env.ADMIN_SESSION_SECRET = sessionSecret;

    res.cookie('admin_session', sessionSecret, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    res.json({ success: true });
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('admin_session');
    process.env.ADMIN_SESSION_SECRET = '';
    res.json({ success: true });
  }

  @Get('session')
  @UseGuards(AdminGuard)
  async checkSession() {
    return { authenticated: true };
  }

  @Get('providers')
  @UseGuards(AdminGuard)
  async listProviders() {
    const providers = await this.prisma.provider.findMany({
      orderBy: { priority: 'asc' },
    });

    return providers.map((p) => ({
      ...p,
      apiKey: maskKey(p.apiKey),
    }));
  }

  @Post('providers')
  @UseGuards(AdminGuard)
  async createProvider(@Body() dto: CreateProviderDto) {
    const provider = await this.prisma.provider.create({ data: dto });
    return { ...provider, apiKey: maskKey(provider.apiKey) };
  }

  @Patch('providers/:id')
  @UseGuards(AdminGuard)
  async updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
  ) {
    const provider = await this.prisma.provider.update({
      where: { id },
      data: dto,
    });
    return { ...provider, apiKey: maskKey(provider.apiKey) };
  }

  @Delete('providers/:id')
  @UseGuards(AdminGuard)
  async deleteProvider(@Param('id') id: string) {
    await this.prisma.provider.delete({ where: { id } });
    return { success: true };
  }

  @Post('providers/:id/test')
  @UseGuards(AdminGuard)
  async testProvider(@Param('id') id: string) {
    const config = await this.prisma.provider.findUnique({ where: { id } });
    if (!config) {
      throw new HttpException('Provider not found', 404);
    }

    try {
      const provider = this.providerFactory.createFromConfig(config);
      const result = await provider.chat({
        messages: [{ role: 'user', content: 'Say "ok" and nothing else.' }],
        max_tokens: 10,
      });

      return {
        success: true,
        response: result.content,
        model: result.model,
        provider: result.provider,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  @Get('config')
  @UseGuards(AdminGuard)
  async getConfig() {
    let config = await this.prisma.gatewayConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      config = await this.prisma.gatewayConfig.create({
        data: { id: 'default' },
      });
    }

    return config;
  }

  @Patch('config')
  @UseGuards(AdminGuard)
  async updateConfig(@Body() dto: UpdateConfigDto) {
    const config = await this.prisma.gatewayConfig.upsert({
      where: { id: 'default' },
      update: dto,
      create: { id: 'default', ...dto },
    });

    return config;
  }

  @Post('change-password')
  @UseGuards(AdminGuard)
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const gatewayConfig = await this.prisma.gatewayConfig.findUnique({
      where: { id: 'default' },
    });

    const validPassword =
      gatewayConfig?.adminPassword ||
      this.config.get<string>('ADMIN_PASSWORD');

    if (body.currentPassword !== validPassword) {
      throw new HttpException('Current password is incorrect', 401);
    }

    if (!body.newPassword || body.newPassword.length < 6) {
      throw new HttpException('New password must be at least 6 characters', 400);
    }

    await this.prisma.gatewayConfig.upsert({
      where: { id: 'default' },
      update: { adminPassword: body.newPassword },
      create: { id: 'default', adminPassword: body.newPassword },
    });

    return { success: true };
  }

  @Get('api-keys')
  @UseGuards(AdminGuard)
  async listApiKeys() {
    const keys = await this.prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => ({
      ...k,
      key: maskKey(k.key),
    }));
  }

  @Post('api-keys')
  @UseGuards(AdminGuard)
  async createApiKey(
    @Body() body: { name: string; expiresAt?: string },
  ) {
    const key = `gw_${uuidv4().replace(/-/g, '')}`;
    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: body.name,
        key,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    return { ...apiKey, key };
  }

  @Patch('api-keys/:id')
  @UseGuards(AdminGuard)
  async updateApiKey(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean },
  ) {
    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: body,
    });
    return { ...apiKey, key: maskKey(apiKey.key) };
  }

  @Delete('api-keys/:id')
  @UseGuards(AdminGuard)
  async deleteApiKey(@Param('id') id: string) {
    await this.prisma.apiKey.delete({ where: { id } });
    return { success: true };
  }

  @Get('providers/:id/models')
  @UseGuards(AdminGuard)
  async listModels(@Param('id') id: string) {
    const config = await this.prisma.provider.findUnique({ where: { id } });
    if (!config) {
      throw new HttpException('Provider not found', 404);
    }

    try {
      if (config.type === 'openai-compat') {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({
          apiKey: config.apiKey,
          ...(config.baseUrl && { baseURL: config.baseUrl }),
        });
        const response = await client.models.list();
        const models: string[] = [];
        for await (const model of response) {
          models.push(model.id);
        }
        return { models: models.sort() };
      }

      if (config.type === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`,
        );
        const data = await res.json();
        const models = (data.models || [])
          .filter((m: { supportedGenerationMethods?: string[] }) =>
            m.supportedGenerationMethods?.includes('generateContent'),
          )
          .map((m: { name?: string }) => (m.name || '').replace('models/', ''))
          .filter(Boolean)
          .sort();
        return { models };
      }

      return { models: [config.defaultModel] };
    } catch (error) {
      throw new HttpException(
        { error: `Failed to list models: ${error instanceof Error ? error.message : error}` },
        502,
      );
    }
  }

  @Get('monitoring')
  @UseGuards(AdminGuard)
  async getMonitoring() {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalToday,
      totalWeek,
      lastMinute,
      lastHour,
      rateLimitsToday,
      errorsToday,
      providerStats,
      recentLogs,
    ] = await Promise.all([
      this.prisma.requestLog.count({ where: { createdAt: { gte: oneDayAgo } } }),
      this.prisma.requestLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.requestLog.count({ where: { createdAt: { gte: oneMinuteAgo } } }),
      this.prisma.requestLog.count({ where: { createdAt: { gte: oneHourAgo } } }),
      this.prisma.requestLog.count({
        where: { createdAt: { gte: oneDayAgo }, status: 'rate_limited' },
      }),
      this.prisma.requestLog.count({
        where: { createdAt: { gte: oneDayAgo }, status: 'error' },
      }),
      this.prisma.$queryRaw<
        {
          provider: string;
          model: string;
          total: bigint;
          success: bigint;
          errors: bigint;
          rate_limited: bigint;
          avg_latency: number;
          last_minute: bigint;
          last_hour: bigint;
        }[]
      >`
        SELECT
          provider,
          model,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'success') as success,
          COUNT(*) FILTER (WHERE status = 'error') as errors,
          COUNT(*) FILTER (WHERE status = 'rate_limited') as rate_limited,
          ROUND(AVG(CAST("latencyMs" AS numeric))) as avg_latency,
          COUNT(*) FILTER (WHERE "createdAt" > ${oneMinuteAgo}) as last_minute,
          COUNT(*) FILTER (WHERE "createdAt" > ${oneHourAgo}) as last_hour
        FROM "RequestLog"
        WHERE "createdAt" > ${sevenDaysAgo}
        GROUP BY provider, model
        ORDER BY total DESC
      `,
      this.prisma.requestLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      overview: {
        requestsToday: totalToday,
        requestsThisWeek: totalWeek,
        requestsLastMinute: lastMinute,
        requestsLastHour: lastHour,
        rateLimitsToday,
        errorsToday,
      },
      providerStats: providerStats.map((s) => ({
        provider: s.provider,
        model: s.model,
        total: Number(s.total),
        success: Number(s.success),
        errors: Number(s.errors),
        rateLimited: Number(s.rate_limited),
        avgLatency: Number(s.avg_latency),
        lastMinute: Number(s.last_minute),
        lastHour: Number(s.last_hour),
      })),
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        provider: l.provider,
        model: l.model,
        status: l.status,
        latencyMs: l.latencyMs,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,
        error: l.error,
        source: l.source,
        apiKeyName: l.apiKeyName,
        createdAt: l.createdAt,
      })),
    };
  }

  @Get('conversations')
  @UseGuards(AdminGuard)
  async listConversations() {
    return this.prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('conversations/:id')
  @UseGuards(AdminGuard)
  async getConversation(@Param('id') id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  @Delete('conversations/:id')
  @UseGuards(AdminGuard)
  async deleteConversation(@Param('id') id: string) {
    await this.prisma.conversation.delete({ where: { id } });
    return { success: true };
  }

  @Post('chat')
  @UseGuards(AdminGuard)
  async chat(@Body() body: AdminChatDto) {
    let conversationId = body.conversationId;

    if (!conversationId) {
      const title =
        body.prompt.length > 50
          ? body.prompt.slice(0, 50) + '...'
          : body.prompt;
      const conversation = await this.prisma.conversation.create({
        data: { title },
      });
      conversationId = conversation.id;
    }

    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: body.prompt,
      },
    });

    const history = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    const messages: ChatMessage[] = [];
    if (body.system) {
      messages.push({ role: 'system', content: body.system });
    }
    for (const msg of history) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const result = await this.router.route(
      {
        messages,
        model: body.model,
        temperature: body.temperature,
        max_tokens: body.maxTokens,
      },
      {
        provider: body.provider,
        freeOnly: body.freeOnly,
        source: 'admin_chat',
      },
    );

    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: result.content,
        provider: result.provider,
        model: result.model,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId,
      text: result.content,
      provider: result.provider,
      model: result.model,
      ...(result.failedProviders && { failedProviders: result.failedProviders }),
    };
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
