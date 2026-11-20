import OpenAI from 'openai';
import { LlmProvider, LlmRequest, LlmResponse } from './provider.interface';
import {
  ModelShape,
  adaptShape,
  rememberShape,
  shapeFor,
} from './model-capabilities';

/**
 * One attempt per parameter that can be rejected, so a model refusing both the
 * token parameter and the temperature still resolves.
 */
const MAX_SHAPE_ATTEMPTS = 3;

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

  /**
   * Sends the request, correcting the parameter shape if the provider rejects
   * it, and remembering what worked for this model.
   *
   * Models disagree on parameter names and the disagreement changes between
   * generations, so the shape is taken from the registry where it is known and
   * learned from the API's own rejection where it is not.
   */
  async chat(request: LlmRequest): Promise<LlmResponse> {
    const model = request.model || this.defaultModel;
    let shape = shapeFor(model);

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.send(model, request, shape);
        rememberShape(model, shape);
        return response;
      } catch (err) {
        // Only retry when the provider said the parameters were wrong.
        // Anything else is a real failure and belongs to the caller.
        const corrected =
          attempt < MAX_SHAPE_ATTEMPTS ? adaptShape(shape, err) : null;
        if (!corrected) throw err;
        shape = corrected;
      }
    }
  }

  private async send(
    model: string,
    request: LlmRequest,
    shape: ModelShape,
  ): Promise<LlmResponse> {
    const params = {
      model,
      messages: request.messages,
      ...(shape.supportsTemperature && {
        temperature: request.temperature ?? 0.7,
      }),
      ...(request.max_tokens !== undefined && {
        [shape.tokenParam]: request.max_tokens,
      }),
    } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];

    return {
      content: choice?.message?.content || '',
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
