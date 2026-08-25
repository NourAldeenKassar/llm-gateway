import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { RouterService } from '../router/router.service';
import { ChatCompletionDto } from './dto/chat-completion.dto';
import { GenerateDto } from './dto/generate.dto';
import { ChatMessage } from '../providers/provider.interface';

@Controller()
@UseGuards(ApiKeyGuard)
export class GatewayController {
  constructor(private router: RouterService) {}

  @Post('v1/chat/completions')
  async chatCompletions(
    @Body() body: ChatCompletionDto,
    @Headers('x-provider') providerHeader?: string,
    @Headers('x-free-only') freeOnlyHeader?: string,
  ) {
    let provider = providerHeader;
    let model = body.model;

    if (model && model.includes('/')) {
      const parts = model.split('/');
      provider = parts[0];
      model = parts.slice(1).join('/');
    }

    const result = await this.router.route(
      {
        messages: body.messages as ChatMessage[],
        model,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
      },
      {
        provider,
        freeOnly: freeOnlyHeader === 'true' ? true : undefined,
      },
    );

    return {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: result.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: result.content },
          finish_reason: 'stop',
        },
      ],
      usage: result.usage || null,
      x_provider: result.provider,
    };
  }

  @Post('api/generate')
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
