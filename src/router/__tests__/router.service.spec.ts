import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { RouterService } from '../router.service';
import { ProviderFactory } from '../../providers/provider.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmProvider } from '../../providers/provider.interface';

const mockPrisma = {
  gatewayConfig: {
    findUnique: jest.fn(),
  },
  requestLog: {
    create: jest.fn(),
  },
};

const mockProviderFactory = {
  getProviderByName: jest.fn(),
  getEnabledProviders: jest.fn(),
};

function createMockProvider(
  name: string,
  isPaid: boolean,
  response?: { content: string; model: string },
  shouldFail?: string,
): LlmProvider {
  return {
    name,
    isPaid,
    defaultModel: 'test-model',
    chat: jest.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error(shouldFail);
      return {
        content: response?.content || 'ok',
        model: response?.model || 'test-model',
        provider: name,
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
    }),
  };
}

describe('RouterService', () => {
  let service: RouterService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RouterService,
        { provide: ProviderFactory, useValue: mockProviderFactory },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(RouterService);
    jest.clearAllMocks();
    mockPrisma.requestLog.create.mockResolvedValue({});
  });

  describe('direct provider routing', () => {
    it('routes to specific provider when provider option is set', async () => {
      const provider = createMockProvider('groq', false, {
        content: 'hello',
        model: 'llama-3',
      });
      mockProviderFactory.getProviderByName.mockResolvedValue(provider);

      const result = await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        { provider: 'groq' },
      );

      expect(result.content).toBe('hello');
      expect(result.provider).toBe('groq');
      expect(provider.chat).toHaveBeenCalled();
    });

    it('returns 404 when specified provider not found', async () => {
      mockProviderFactory.getProviderByName.mockResolvedValue(null);

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          { provider: 'nonexistent' },
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('fallback chain', () => {
    it('tries providers in order', async () => {
      const groq = createMockProvider('groq', false, {
        content: 'from groq',
        model: 'llama-3',
      });
      mockProviderFactory.getEnabledProviders.mockResolvedValue([groq]);
      mockPrisma.gatewayConfig.findUnique.mockResolvedValue({
        freeOnlyDefault: false,
      });

      const result = await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        {},
      );

      expect(result.content).toBe('from groq');
    });

    it('falls back to next provider when first fails', async () => {
      const groq = createMockProvider('groq', false, undefined, 'groq down');
      const gemini = createMockProvider('gemini', false, {
        content: 'from gemini',
        model: 'gemini-flash',
      });
      mockProviderFactory.getEnabledProviders.mockResolvedValue([
        groq,
        gemini,
      ]);
      mockPrisma.gatewayConfig.findUnique.mockResolvedValue({
        freeOnlyDefault: false,
      });

      const result = await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        {},
      );

      expect(result.content).toBe('from gemini');
      expect(result.provider).toBe('gemini');
    });

    it('returns failedProviders when fallback occurs', async () => {
      const groq = createMockProvider('groq', false, undefined, 'rate limited');
      const gemini = createMockProvider('gemini', false, {
        content: 'ok',
        model: 'gemini-flash',
      });
      mockProviderFactory.getEnabledProviders.mockResolvedValue([
        groq,
        gemini,
      ]);
      mockPrisma.gatewayConfig.findUnique.mockResolvedValue({
        freeOnlyDefault: false,
      });

      const result = await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        {},
      );

      expect(result.failedProviders).toEqual([
        { provider: 'groq', error: 'rate limited' },
      ]);
    });

    it('passes freeOnly to getEnabledProviders', async () => {
      const groq = createMockProvider('groq', false, {
        content: 'free',
        model: 'llama-3',
      });
      mockProviderFactory.getEnabledProviders.mockResolvedValue([groq]);

      await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        { freeOnly: true },
      );

      expect(mockProviderFactory.getEnabledProviders).toHaveBeenCalledWith(true);
    });

    it('returns 503 when no providers available', async () => {
      mockProviderFactory.getEnabledProviders.mockResolvedValue([]);
      mockPrisma.gatewayConfig.findUnique.mockResolvedValue({
        freeOnlyDefault: false,
      });

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          {},
        ),
      ).rejects.toThrow(HttpException);
    });

    it('returns 503 when all providers fail', async () => {
      const groq = createMockProvider('groq', false, undefined, 'down');
      const gemini = createMockProvider('gemini', false, undefined, 'also down');
      mockProviderFactory.getEnabledProviders.mockResolvedValue([
        groq,
        gemini,
      ]);
      mockPrisma.gatewayConfig.findUnique.mockResolvedValue({
        freeOnlyDefault: false,
      });

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          {},
        ),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('request logging', () => {
    it('logs successful requests to DB', async () => {
      const provider = createMockProvider('groq', false);
      mockProviderFactory.getProviderByName.mockResolvedValue(provider);

      await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        { provider: 'groq', source: 'api', apiKeyName: 'my-app' },
      );

      expect(mockPrisma.requestLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          provider: 'groq',
          status: 'success',
          source: 'api',
          apiKeyName: 'my-app',
        }),
      });
    });

    it('logs failed requests with rate_limited status', async () => {
      const provider = createMockProvider(
        'groq',
        false,
        undefined,
        '429 Too Many Requests',
      );
      mockProviderFactory.getProviderByName.mockResolvedValue(provider);

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          { provider: 'groq' },
        ),
      ).rejects.toThrow();

      expect(mockPrisma.requestLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'rate_limited',
          error: '429 Too Many Requests',
        }),
      });
    });
  });

  describe('freeOnly default', () => {
    it('uses default freeOnly from GatewayConfig', async () => {
      mockProviderFactory.getEnabledProviders.mockResolvedValue([]);
      mockPrisma.gatewayConfig.findUnique.mockResolvedValue({
        freeOnlyDefault: true,
      });

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          {},
        ),
      ).rejects.toThrow(HttpException);

      expect(mockProviderFactory.getEnabledProviders).toHaveBeenCalledWith(true);
    });
  });
});
