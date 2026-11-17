import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessTier } from '../providers/tier';

export const API_KEY_CONTEXT = 'apiKeyContext';

export interface ApiKeyContext {
  name: string;
  tier: AccessTier;
}

export const GetApiKeyContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyContext | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request[API_KEY_CONTEXT];
  },
);

export const GetApiKeyName = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request[API_KEY_CONTEXT]?.name;
  },
);
