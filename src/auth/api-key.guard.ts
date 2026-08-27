import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { API_KEY_NAME } from './api-key-name.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const key = authHeader.slice(7);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key, enabled: true },
    });

    if (apiKey) {
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        throw new UnauthorizedException('API key expired');
      }
      request[API_KEY_NAME] = apiKey.name;
      return true;
    }

    const envKey = this.config.get<string>('GATEWAY_API_KEY');
    if (envKey && key === envKey) {
      request[API_KEY_NAME] = 'env';
      return true;
    }

    throw new UnauthorizedException('Invalid API key');
  }
}
