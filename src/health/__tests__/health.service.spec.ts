import { Test } from '@nestjs/testing';
import { HealthService } from '../health.service';
import { ProviderFactory } from '../../providers/provider.factory';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  healthCheck: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  provider: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockProviderFactory = {
  createFromConfig: jest.fn(),
};

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProviderFactory, useValue: mockProviderFactory },
      ],
    }).compile();

    service = module.get(HealthService);
    jest.clearAllMocks();
    mockPrisma.healthCheck.upsert.mockResolvedValue({});
  });

  it('returns unchecked status initially', () => {
    const health = service.getHealth();
    expect(health.status).toBe('unchecked');
    expect(health.lastCheck).toBeNull();
  });

  it('loads cached health from DB on init', async () => {
    mockPrisma.healthCheck.findUnique.mockResolvedValue({
      status: 'healthy',
      database: 'ok',
      providers: [{ name: 'groq', status: 'healthy' }],
      checkedAt: new Date('2026-01-01'),
    });

    await service.onModuleInit();

    const health = service.getHealth();
    expect(health.status).toBe('healthy');
    expect(health.lastCheck).toBe('2026-01-01T00:00:00.000Z');
  });

  describe('runCheck', () => {
    it('returns healthy when DB and all providers pass', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.provider.findMany.mockResolvedValue([
        {
          name: 'groq',
          displayName: 'Groq',
          type: 'openai-compat',
          apiKey: 'key',
          baseUrl: 'url',
          defaultModel: 'model',
          isPaid: false,
        },
      ]);
      mockProviderFactory.createFromConfig.mockReturnValue({
        chat: jest.fn().mockResolvedValue({ content: 'ok' }),
      });

      const result = await service.runCheck();

      expect(result.status).toBe('healthy');
      expect(result.database).toBe('ok');
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].status).toBe('healthy');
    });

    it('returns degraded when some providers fail', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.provider.findMany.mockResolvedValue([
        { name: 'groq', displayName: 'Groq', isPaid: false },
        { name: 'gemini', displayName: 'Gemini', isPaid: false },
      ]);

      let callCount = 0;
      mockProviderFactory.createFromConfig.mockImplementation(() => ({
        chat: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 2) throw new Error('gemini down');
          return { content: 'ok' };
        }),
      }));

      const result = await service.runCheck();

      expect(result.status).toBe('degraded');
      expect(result.providers.filter((p) => p.status === 'healthy')).toHaveLength(1);
      expect(result.providers.filter((p) => p.status === 'unhealthy')).toHaveLength(1);
    });

    it('returns unhealthy when all providers fail', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.provider.findMany.mockResolvedValue([
        { name: 'groq', displayName: 'Groq', isPaid: false },
      ]);
      mockProviderFactory.createFromConfig.mockReturnValue({
        chat: jest.fn().mockRejectedValue(new Error('down')),
      });

      const result = await service.runCheck();

      expect(result.status).toBe('unhealthy');
    });

    it('saves results to DB after check', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPrisma.provider.findMany.mockResolvedValue([]);

      await service.runCheck();

      expect(mockPrisma.healthCheck.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'latest' },
        }),
      );
    });
  });
});
