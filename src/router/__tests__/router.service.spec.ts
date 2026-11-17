import { Test } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { RouterService } from '../router.service';
import { ProviderFactory } from '../../providers/provider.factory';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmProvider } from '../../providers/provider.interface';

const mockPrisma = {
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

      const result = await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        {},
      );

      expect(result.failedProviders).toEqual([
        { provider: 'groq', error: 'rate limited' },
      ]);
    });

    it('passes the tier to getEnabledProviders', async () => {
      const gpt = createMockProvider('openai', true, {
        content: 'premium',
        model: 'gpt-5',
      });
      mockProviderFactory.getEnabledProviders.mockResolvedValue([gpt]);

      await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        { tier: 'paid' },
      );

      expect(mockProviderFactory.getEnabledProviders).toHaveBeenCalledWith(
        'paid',
      );
    });

    it('defaults to the free tier when no tier is given', async () => {
      const groq = createMockProvider('groq', false);
      mockProviderFactory.getEnabledProviders.mockResolvedValue([groq]);

      await service.route({ messages: [{ role: 'user', content: 'hi' }] }, {});

      expect(mockProviderFactory.getEnabledProviders).toHaveBeenCalledWith(
        'free',
      );
    });

    it('never falls back to free when the paid tier is exhausted', async () => {
      const gpt = createMockProvider('openai', true, undefined, 'down');
      mockProviderFactory.getEnabledProviders.mockResolvedValue([gpt]);

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          { tier: 'paid' },
        ),
      ).rejects.toThrow(HttpException);

      expect(mockProviderFactory.getEnabledProviders).toHaveBeenCalledTimes(1);
      expect(mockProviderFactory.getEnabledProviders).toHaveBeenCalledWith(
        'paid',
      );
    });

    it('returns 503 when no providers available', async () => {
      mockProviderFactory.getEnabledProviders.mockResolvedValue([]);

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

  describe('tier enforcement on pinned providers', () => {
    it('returns 403 when a free-tier key pins a paid provider', async () => {
      const gpt = createMockProvider('openai', true);
      mockProviderFactory.getProviderByName.mockResolvedValue(gpt);

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          { provider: 'openai', tier: 'free' },
        ),
      ).rejects.toMatchObject({ status: 403 });

      expect(gpt.chat).not.toHaveBeenCalled();
    });

    it('returns 403 when a paid-tier key pins a free provider', async () => {
      const groq = createMockProvider('groq', false);
      mockProviderFactory.getProviderByName.mockResolvedValue(groq);

      await expect(
        service.route(
          { messages: [{ role: 'user', content: 'hi' }] },
          { provider: 'groq', tier: 'paid' },
        ),
      ).rejects.toMatchObject({ status: 403 });

      expect(groq.chat).not.toHaveBeenCalled();
    });

    it('allows a paid-tier key to pin a paid provider', async () => {
      const gpt = createMockProvider('openai', true, {
        content: 'premium answer',
        model: 'gpt-5',
      });
      mockProviderFactory.getProviderByName.mockResolvedValue(gpt);

      const result = await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        { provider: 'openai', tier: 'paid' },
      );

      expect(result.content).toBe('premium answer');
    });

    it('allows the any tier to pin either kind of provider', async () => {
      const gpt = createMockProvider('openai', true, {
        content: 'ok',
        model: 'gpt-5',
      });
      mockProviderFactory.getProviderByName.mockResolvedValue(gpt);

      const result = await service.route(
        { messages: [{ role: 'user', content: 'hi' }] },
        { provider: 'openai', tier: 'any' },
      );

      expect(result.content).toBe('ok');
    });
  });
});
