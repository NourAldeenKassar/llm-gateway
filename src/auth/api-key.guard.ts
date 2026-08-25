import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const key = authHeader.slice(7);
    const validKey = this.config.get<string>('GATEWAY_API_KEY');

    if (!validKey || key !== validKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
