import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
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
import { AccessTier } from '../providers/tier';

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

  @Post('providers/reorder')
  @UseGuards(AdminGuard)
  async reorderProviders(@Body() body: { ids: string[] }) {
    await Promise.all(
      body.ids.map((id, index) =>
        this.prisma.provider.update({
          where: { id },
          data: { priority: index },
        }),
      ),
    );
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
        messages: [
          { role: 'system', content: 'You are a test bot.' },
          { role: 'user', content: 'Say "ok" and nothing else.' },
        ],
        max_tokens: 50,
      });

      if (!result.content || !result.content.trim()) {
        return {
          success: false,
          error: 'Provider returned empty response',
          model: result.model,
        };
      }

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
    @Body() body: { name: string; tier?: string; expiresAt?: string },
  ) {
    const key = `gw_${uuidv4().replace(/-/g, '')}`;
    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: body.name,
        key,
        tier: body.tier
          ? assertTier(body.tier)
          : await this.defaultKeyTier(),
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    return { ...apiKey, key };
  }

  @Patch('api-keys/:id')
  @UseGuards(AdminGuard)
  async updateApiKey(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean; tier?: string },
  ) {
    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        ...(body.tier !== undefined && { tier: assertTier(body.tier) }),
      },
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
  async getMonitoring(@Query('range') range?: string) {
    const windows: Record<string, { ms: number; buckets: number }> = {
      '1h': { ms: 60 * 60 * 1000, buckets: 12 },
      '24h': { ms: 24 * 60 * 60 * 1000, buckets: 24 },
      '7d': { ms: 7 * 24 * 60 * 60 * 1000, buckets: 28 },
    };
    const rangeKey = range && windows[range] ? range : '24h';
    const win = windows[rangeKey];

    const now = new Date();
    const start = new Date(now.getTime() - win.ms);
    const prevStart = new Date(now.getTime() - win.ms * 2);
    const bucketSeconds = Math.round(win.ms / win.buckets / 1000);

    const [
      summaryRows,
      prevRows,
      seriesRows,
      providerRows,
      appRows,
      recentFailures,
      recentLogs,
    ] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'success')::int AS success,
          COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
          COUNT(*) FILTER (WHERE status = 'rate_limited')::int AS rate_limited,
          COALESCE(ROUND(AVG("latencyMs")), 0)::int AS avg_latency,
          COALESCE(ROUND(percentile_cont(0.95) WITHIN GROUP (
            ORDER BY "latencyMs"::double precision)), 0)::int AS p95_latency,
          COALESCE(SUM("totalTokens"), 0)::int AS total_tokens
        FROM "RequestLog"
        WHERE "createdAt" >= ${start}
      `,
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'success')::int AS success,
          COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
          COUNT(*) FILTER (WHERE status = 'rate_limited')::int AS rate_limited,
          COALESCE(ROUND(AVG("latencyMs")), 0)::int AS avg_latency,
          COALESCE(ROUND(percentile_cont(0.95) WITHIN GROUP (
            ORDER BY "latencyMs"::double precision)), 0)::int AS p95_latency,
          COALESCE(SUM("totalTokens"), 0)::int AS total_tokens
        FROM "RequestLog"
        WHERE "createdAt" >= ${prevStart} AND "createdAt" < ${start}
      `,
      this.prisma.$queryRaw<
        { idx: number; success: number; rate_limited: number; errors: number }[]
      >`
        SELECT
          floor(extract(epoch FROM "createdAt" - ${start}::timestamptz)
            / ${bucketSeconds})::int AS idx,
          COUNT(*) FILTER (WHERE status = 'success')::int AS success,
          COUNT(*) FILTER (WHERE status = 'rate_limited')::int AS rate_limited,
          COUNT(*) FILTER (WHERE status = 'error')::int AS errors
        FROM "RequestLog"
        WHERE "createdAt" >= ${start}
        GROUP BY idx
        ORDER BY idx
      `,
      this.prisma.$queryRaw<
        {
          provider: string;
          model: string;
          total: number;
          success: number;
          errors: number;
          rate_limited: number;
          avg_latency: number;
          p95_latency: number;
          total_tokens: number;
        }[]
      >`
        SELECT
          provider,
          model,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'success')::int AS success,
          COUNT(*) FILTER (WHERE status = 'error')::int AS errors,
          COUNT(*) FILTER (WHERE status = 'rate_limited')::int AS rate_limited,
          COALESCE(ROUND(AVG("latencyMs")), 0)::int AS avg_latency,
          COALESCE(ROUND(percentile_cont(0.95) WITHIN GROUP (
            ORDER BY "latencyMs"::double precision)), 0)::int AS p95_latency,
          COALESCE(SUM("totalTokens"), 0)::int AS total_tokens
        FROM "RequestLog"
        WHERE "createdAt" >= ${start}
        GROUP BY provider, model
        ORDER BY total DESC
      `,
      this.prisma.$queryRaw<
        {
          app: string;
          tier: string | null;
          requests: number;
          failures: number;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        }[]
      >`
        SELECT
          COALESCE(l."apiKeyName", l.source, 'unknown') AS app,
          k.tier AS tier,
          COUNT(*)::int AS requests,
          COUNT(*) FILTER (WHERE l.status <> 'success')::int AS failures,
          COALESCE(SUM(l."promptTokens"), 0)::int AS prompt_tokens,
          COALESCE(SUM(l."completionTokens"), 0)::int AS completion_tokens,
          COALESCE(SUM(l."totalTokens"), 0)::int AS total_tokens
        FROM "RequestLog" l
        LEFT JOIN (
          SELECT name, MIN(tier) AS tier FROM "ApiKey" GROUP BY name
        ) k ON k.name = l."apiKeyName"
        WHERE l."createdAt" >= ${start}
        GROUP BY 1, 2
        ORDER BY requests DESC
      `,
      this.prisma.requestLog.findMany({
        where: { createdAt: { gte: start }, status: { not: 'success' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.requestLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const summary = summaryRows[0];
    const prev = prevRows[0];

    const points = Array.from({ length: win.buckets }, (_, i) => ({
      t: new Date(start.getTime() + i * bucketSeconds * 1000).toISOString(),
      success: 0,
      rateLimited: 0,
      errors: 0,
    }));
    for (const row of seriesRows) {
      const idx = Math.min(Math.max(row.idx, 0), points.length - 1);
      points[idx].success += row.success;
      points[idx].rateLimited += row.rate_limited;
      points[idx].errors += row.errors;
    }

    const rate = (s: SummaryRow) =>
      s.total > 0 ? Math.round((s.success / s.total) * 1000) / 10 : null;

    return {
      range: rangeKey,
      startedAt: start.toISOString(),
      kpis: {
        requests: summary.total,
        successRate: rate(summary),
        avgLatency: summary.avg_latency,
        p95Latency: summary.p95_latency,
        errors: summary.errors,
        rateLimited: summary.rate_limited,
        failures: summary.errors + summary.rate_limited,
        totalTokens: summary.total_tokens,
        prevRequests: prev.total,
        prevSuccessRate: rate(prev),
      },
      series: { bucketSeconds, points },
      providerStats: providerRows.map((s) => ({
        provider: s.provider,
        model: s.model,
        total: s.total,
        success: s.success,
        errors: s.errors,
        rateLimited: s.rate_limited,
        avgLatency: s.avg_latency,
        p95Latency: s.p95_latency,
        totalTokens: s.total_tokens,
        successRate:
          s.total > 0 ? Math.round((s.success / s.total) * 1000) / 10 : null,
      })),
      appStats: appRows.map((a) => ({
        app: a.app,
        tier: a.tier,
        requests: a.requests,
        failures: a.failures,
        promptTokens: a.prompt_tokens,
        completionTokens: a.completion_tokens,
        totalTokens: a.total_tokens,
      })),
      recentFailures: recentFailures.map((l) => ({
        id: l.id,
        provider: l.provider,
        model: l.model,
        status: l.status,
        error: l.error,
        apiKeyName: l.apiKeyName,
        source: l.source,
        createdAt: l.createdAt,
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
        tier: body.freeOnly === true ? 'free' : 'any',
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

  private async defaultKeyTier(): Promise<AccessTier> {
    const config = await this.prisma.gatewayConfig.findUnique({
      where: { id: 'default' },
    });
    return config?.freeOnlyDefault === false ? 'any' : 'free';
  }
}

interface SummaryRow {
  total: number;
  success: number;
  errors: number;
  rate_limited: number;
  avg_latency: number;
  p95_latency: number;
  total_tokens: number;
}

function assertTier(value: string): AccessTier {
  if (value !== 'free' && value !== 'paid' && value !== 'any') {
    throw new BadRequestException(
      `Invalid tier "${value}". Must be "free", "paid" or "any".`,
    );
  }
  return value;
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
