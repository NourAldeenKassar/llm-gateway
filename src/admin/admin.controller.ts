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
import { GenerateDto } from '../gateway/dto/generate.dto';
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
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD');

    if (!adminPassword || body.password !== adminPassword) {
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

  @Post('chat')
  @UseGuards(AdminGuard)
  async chat(@Body() body: GenerateDto) {
    const messages: ChatMessage[] = [];

    if (body.system) {
      messages.push({ role: 'system', content: body.system });
    }
    messages.push({ role: 'user', content: body.prompt });

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
      },
    );

    return {
      text: result.content,
      provider: result.provider,
      model: result.model,
    };
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
