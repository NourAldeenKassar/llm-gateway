import OpenAI from 'openai';
import { LlmProvider, LlmRequest, LlmResponse } from './provider.interface';

export class OpenAICompatProvider implements LlmProvider {
  private client: OpenAI;

  constructor(
    public readonly name: string,
    public readonly isPaid: boolean,
    private readonly apiKey: string,
    public readonly defaultModel: string,
    private readonly baseUrl?: string,
  ) {
    this.client = new OpenAI({
      apiKey: this.apiKey,
      ...(this.baseUrl && { baseURL: this.baseUrl }),
    });
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model || this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens,
    });

    const choice = response.choices[0];

    return {
      content: choice.message.content || '',
      model: response.model,
      provider: this.name,
      usage: response.usage
        ? {
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}
