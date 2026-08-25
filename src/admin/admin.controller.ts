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
import { AdminGuard } from '../auth/admin.guard';
import { CreateProviderDto } from './dto/create-provider.dto';
import { UpdateProviderDto } from './dto/update-provider.dto';
import { UpdateConfigDto } from './dto/update-config.dto';

@Controller('api/admin')
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private providerFactory: ProviderFactory,
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
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
