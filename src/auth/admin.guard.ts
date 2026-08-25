import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionToken = request.cookies?.['admin_session'];

    if (!sessionToken) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (sessionToken !== process.env.ADMIN_SESSION_SECRET) {
      throw new UnauthorizedException('Invalid session');
    }

    return true;
  }
}
