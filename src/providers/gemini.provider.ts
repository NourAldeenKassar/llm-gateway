import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  LlmProvider,
  LlmRequest,
  LlmResponse,
  ChatMessage,
} from './provider.interface';

export class GeminiProvider implements LlmProvider {
  private client: GoogleGenerativeAI;

  constructor(
    public readonly name: string,
    public readonly isPaid: boolean,
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  async chat(request: LlmRequest): Promise<LlmResponse> {
    const model = this.client.getGenerativeModel({
      model: request.model || this.defaultModel,
    });

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const chatMessages = request.messages.filter((m) => m.role !== 'system');

    const history = this.toGeminiHistory(chatMessages.slice(0, -1));
    const lastMessage = chatMessages[chatMessages.length - 1];

    const chat = model.startChat({
      history,
      ...(systemMessage && {
        systemInstruction: systemMessage.content,
      }),
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.max_tokens,
      },
    });

    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response;

    return {
      content: response.text(),
      model: request.model || this.defaultModel,
      provider: this.name,
      usage: response.usageMetadata
        ? {
            prompt_tokens: response.usageMetadata.promptTokenCount || 0,
            completion_tokens:
              response.usageMetadata.candidatesTokenCount || 0,
            total_tokens: response.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  private toGeminiHistory(
    messages: ChatMessage[],
  ): { role: string; parts: { text: string }[] }[] {
    return messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  }
}
