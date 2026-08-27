import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const API_KEY_NAME = 'apiKeyName';

export const GetApiKeyName = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request[API_KEY_NAME];
  },
);
