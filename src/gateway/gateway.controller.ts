import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { RouterService } from '../router/router.service';
import { GenerateDto } from './dto/generate.dto';
import { ChatMessage } from '../providers/provider.interface';

@Controller('api')
@UseGuards(ApiKeyGuard)
export class GatewayController {
  constructor(private router: RouterService) {}

  @Post('generate')
  async generate(@Body() body: GenerateDto) {
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
