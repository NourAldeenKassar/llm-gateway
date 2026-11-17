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
      { name: 'test-app', tier: 'free' },
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
      { name: 'test-app', tier: 'free' },
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

  it('passes the api key tier to the router', async () => {
    mockRouter.route.mockResolvedValue({
      content: 'hi',
      provider: 'groq',
      model: 'llama-3',
    });

    await controller.generate(
      { prompt: 'hello' } as never,
      { name: 'premium-app', tier: 'paid' },
    );

    expect(mockRouter.route).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tier: 'paid', apiKeyName: 'premium-app' }),
    );
  });

  it('ignores any tier hint in the request body', async () => {
    mockRouter.route.mockResolvedValue({
      content: 'hi',
      provider: 'groq',
      model: 'llama-3',
    });

    await controller.generate(
      { prompt: 'hello', freeOnly: false, tier: 'paid' } as never,
      { name: 'free-app', tier: 'free' },
    );

    expect(mockRouter.route).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tier: 'free' }),
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
      { name: 'test-app', tier: 'free' },
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
      { name: 'test-app', tier: 'free' },
    );

    expect(result.failedProviders).toEqual([
      { provider: 'groq', error: 'down' },
    ]);
  });
});
