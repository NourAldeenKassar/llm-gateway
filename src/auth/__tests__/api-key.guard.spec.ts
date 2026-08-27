import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from '../api-key.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { API_KEY_NAME } from '../api-key-name.decorator';

const mockPrisma = {
  apiKey: {
    findUnique: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn(),
};

function mockContext(authHeader?: string) {
  const request: Record<string, unknown> = {
    headers: { authorization: authHeader },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  };
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApiKeyGuard,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    guard = module.get(ApiKeyGuard);
    jest.clearAllMocks();
  });

  it('rejects requests with no Authorization header', async () => {
    const ctx = mockContext(undefined);
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects requests with invalid Bearer format', async () => {
    const ctx = mockContext('Basic abc123');
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts valid DB API key', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue({
      key: 'gw_valid',
      name: 'my-app',
      enabled: true,
      expiresAt: null,
    });

    const ctx = mockContext('Bearer gw_valid');
    const result = await guard.canActivate(ctx as never);

    expect(result).toBe(true);
    expect(ctx.request[API_KEY_NAME]).toBe('my-app');
  });

  it('rejects disabled DB API key', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);
    mockConfig.get.mockReturnValue(undefined);

    const ctx = mockContext('Bearer gw_disabled');
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects expired DB API key', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue({
      key: 'gw_expired',
      name: 'old-app',
      enabled: true,
      expiresAt: new Date('2020-01-01'),
    });

    const ctx = mockContext('Bearer gw_expired');
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('falls back to GATEWAY_API_KEY env var', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);
    mockConfig.get.mockReturnValue('env-key');

    const ctx = mockContext('Bearer env-key');
    const result = await guard.canActivate(ctx as never);

    expect(result).toBe(true);
    expect(ctx.request[API_KEY_NAME]).toBe('env');
  });

  it('rejects invalid key when no DB match and no env match', async () => {
    mockPrisma.apiKey.findUnique.mockResolvedValue(null);
    mockConfig.get.mockReturnValue('correct-key');

    const ctx = mockContext('Bearer wrong-key');
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
