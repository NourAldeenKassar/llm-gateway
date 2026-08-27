import { Test } from '@nestjs/testing';
import { ProviderFactory } from '../provider.factory';
import { OpenAICompatProvider } from '../openai-compat.provider';
import { GeminiProvider } from '../gemini.provider';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  provider: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const groqConfig = {
  id: '1',
  name: 'groq',
  displayName: 'Groq',
  type: 'openai-compat',
  apiKey: 'test-key',
  baseUrl: 'https://api.groq.com/openai/v1',
  defaultModel: 'llama-3',
  isPaid: false,
  enabled: true,
  priority: 0,
};

const geminiConfig = {
  id: '2',
  name: 'gemini',
  displayName: 'Gemini',
  type: 'gemini',
  apiKey: 'test-key',
  baseUrl: null,
  defaultModel: 'gemini-3.6-flash',
  isPaid: false,
  enabled: true,
  priority: 1,
};

describe('ProviderFactory', () => {
  let factory: ProviderFactory;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProviderFactory,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    factory = module.get(ProviderFactory);
    jest.clearAllMocks();
  });

  describe('createFromConfig', () => {
    it('creates OpenAICompatProvider for type "openai-compat"', () => {
      const provider = factory.createFromConfig(groqConfig as never);
      expect(provider).toBeInstanceOf(OpenAICompatProvider);
      expect(provider.name).toBe('groq');
      expect(provider.isPaid).toBe(false);
    });

    it('creates GeminiProvider for type "gemini"', () => {
      const provider = factory.createFromConfig(geminiConfig as never);
      expect(provider).toBeInstanceOf(GeminiProvider);
      expect(provider.name).toBe('gemini');
    });

    it('throws for unknown type', () => {
      expect(() =>
        factory.createFromConfig({ ...groqConfig, type: 'unknown' } as never),
      ).toThrow('Unknown provider type: unknown');
    });
  });

  describe('getEnabledProviders', () => {
    it('returns enabled providers sorted by priority', async () => {
      mockPrisma.provider.findMany.mockResolvedValue([groqConfig, geminiConfig]);

      const providers = await factory.getEnabledProviders();

      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('groq');
      expect(providers[1].name).toBe('gemini');
      expect(mockPrisma.provider.findMany).toHaveBeenCalledWith({
        where: { enabled: true },
        orderBy: { priority: 'asc' },
      });
    });
  });

  describe('getProviderByName', () => {
    it('returns provider when found and enabled', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(groqConfig);

      const provider = await factory.getProviderByName('groq');

      expect(provider).not.toBeNull();
      expect(provider!.name).toBe('groq');
    });

    it('returns null for disabled provider', async () => {
      mockPrisma.provider.findUnique.mockResolvedValue(null);

      const provider = await factory.getProviderByName('disabled');

      expect(provider).toBeNull();
    });
  });
});
