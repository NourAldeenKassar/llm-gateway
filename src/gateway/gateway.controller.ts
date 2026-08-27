import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { RouterService } from '../router/router.service';
import { GenerateDto } from './dto/generate.dto';
import { ChatMessage } from '../providers/provider.interface';

@Controller('api')
@UseGuards(ApiKeyGuard)
export class GatewayController {
  constructor(private router: RouterService) {}

  @Post('generate')
  async generate(@Body() body: GenerateDto, @Req() req: Request) {
    const messages: ChatMessage[] = [];

    if (body.system) {
      messages.push({ role: 'system', content: body.system });
    }
    messages.push({ role: 'user', content: body.prompt });

    const result = await this.router.route(
      {
        messages,
        temperature: body.temperature,
        max_tokens: body.maxTokens,
      },
      {
        freeOnly: body.freeOnly,
        source: 'api',
        apiKeyName: (req as unknown as Record<string, unknown>).apiKeyName as string,
      },
    );

    return {
      text: result.content,
      provider: result.provider,
      model: result.model,
      ...(result.failedProviders && { failedProviders: result.failedProviders }),
    };
  }
}
