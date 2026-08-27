import { Test } from '@nestjs/testing';
import { GatewayController } from '../gateway.controller';
import { RouterService } from '../../router/router.service';
import { ApiKeyGuard } from '../../auth/api-key.guard';

const mockRouter = {
  route: jest.fn(),
};

describe('GatewayController', () => {
  let controller: GatewayController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [{ provide: RouterService, useValue: mockRouter }],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(GatewayController);
    jest.clearAllMocks();
  });

  it('passes prompt as user message', async () => {
    mockRouter.route.mockResolvedValue({
      content: 'hi',
      provider: 'groq',
      model: 'llama-3',
    });

    await controller.generate(
      { prompt: 'hello' } as never,
      'test-app',
    );

    expect(mockRouter.route).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'hello' }],
      }),
      expect.anything(),
    );
  });

  it('passes system message when provided', async () => {
    mockRouter.route.mockResolvedValue({
      content: 'hi',
      provider: 'groq',
      model: 'llama-3',
    });

    await controller.generate(
      { prompt: 'hello', system: 'be brief' } as never,
      'test-app',
    );

    expect(mockRouter.route).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'be brief' },
          { role: 'user', content: 'hello' },
        ],
      }),
      expect.anything(),
    );
  });

  it('passes freeOnly to router', async () => {
    mockRouter.route.mockResolvedValue({
      content: 'hi',
      provider: 'groq',
      model: 'llama-3',
    });

    await controller.generate(
      { prompt: 'hello', freeOnly: true } as never,
      'test-app',
    );

    expect(mockRouter.route).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ freeOnly: true }),
    );
  });

  it('returns text, provider, model from result', async () => {
    mockRouter.route.mockResolvedValue({
      content: 'the answer',
      provider: 'gemini',
      model: 'gemini-flash',
    });

    const result = await controller.generate(
      { prompt: 'hello' } as never,
      'test-app',
    );

    expect(result).toEqual({
      text: 'the answer',
      provider: 'gemini',
      model: 'gemini-flash',
    });
  });

  it('includes failedProviders when present', async () => {
    mockRouter.route.mockResolvedValue({
      content: 'ok',
      provider: 'gemini',
      model: 'gemini-flash',
      failedProviders: [{ provider: 'groq', error: 'down' }],
    });

    const result = await controller.generate(
      { prompt: 'hello' } as never,
      'test-app',
    );

    expect(result.failedProviders).toEqual([
      { provider: 'groq', error: 'down' },
    ]);
  });
});
