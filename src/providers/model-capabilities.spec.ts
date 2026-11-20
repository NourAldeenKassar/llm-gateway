import {
  DEFAULT_SHAPE,
  adaptShape,
  forgetLearnedShapes,
  rememberShape,
  shapeFor,
} from './model-capabilities';

describe('shapeFor', () => {
  beforeEach(() => forgetLearnedShapes());

  it('uses the original parameter names for most models', () => {
    expect(shapeFor('llama-3.3-70b')).toEqual(DEFAULT_SHAPE);
    expect(shapeFor('mistral-large-latest')).toEqual(DEFAULT_SHAPE);
    expect(shapeFor('gpt-4o-mini')).toEqual(DEFAULT_SHAPE);
  });

  it('knows the models that renamed the token parameter', () => {
    for (const model of ['gpt-5', 'gpt-5-mini', 'o3', 'o1-preview']) {
      expect(shapeFor(model)).toEqual({
        tokenParam: 'max_completion_tokens',
        supportsTemperature: false,
      });
    }
  });

  it('prefers a learned shape over the registry', () => {
    rememberShape('some-future-model', {
      tokenParam: 'max_completion_tokens',
      supportsTemperature: false,
    });
    expect(shapeFor('some-future-model').tokenParam).toBe(
      'max_completion_tokens',
    );
  });

  it('hands out copies, so a caller cannot mutate the registry', () => {
    const first = shapeFor('gpt-5');
    first.supportsTemperature = true;
    expect(shapeFor('gpt-5').supportsTemperature).toBe(false);
  });
});

describe('adaptShape', () => {
  // The exact wording OpenAI returns, which is what makes this self-healing
  // for models released after the registry was written.
  const tokenRejection = {
    message:
      "400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.",
  };

  it('switches to max_completion_tokens when the API asks for it', () => {
    expect(adaptShape(DEFAULT_SHAPE, tokenRejection)).toEqual({
      tokenParam: 'max_completion_tokens',
      supportsTemperature: true,
    });
  });

  it('drops the temperature when the model refuses it', () => {
    const err = {
      message:
        "400 Unsupported value: 'temperature' does not support 0.7 with this model. Only the default (1) value is supported.",
    };
    expect(adaptShape(DEFAULT_SHAPE, err)?.supportsTemperature).toBe(false);
  });

  it('reads the message out of a nested error body', () => {
    const err = { error: { message: tokenRejection.message } };
    expect(adaptShape(DEFAULT_SHAPE, err)?.tokenParam).toBe(
      'max_completion_tokens',
    );
  });

  // Retrying a rate limit or an auth failure with different parameters would
  // waste calls and hide the real cause.
  it('returns null for failures that are not about parameters', () => {
    expect(adaptShape(DEFAULT_SHAPE, { message: '429 Rate limit exceeded' })).toBeNull();
    expect(adaptShape(DEFAULT_SHAPE, { message: '401 Invalid API key' })).toBeNull();
    expect(adaptShape(DEFAULT_SHAPE, { message: '500 Internal error' })).toBeNull();
    expect(adaptShape(DEFAULT_SHAPE, {})).toBeNull();
  });

  it('does not loop by re-suggesting a shape already in use', () => {
    const corrected = adaptShape(DEFAULT_SHAPE, tokenRejection)!;
    expect(adaptShape(corrected, tokenRejection)).toBeNull();
  });

  it('can fall back to max_tokens for a provider that only knows that name', () => {
    const modern = {
      tokenParam: 'max_completion_tokens' as const,
      supportsTemperature: true,
    };
    const err = { message: "Unrecognized request argument: max_completion_tokens" };
    expect(adaptShape(modern, err)?.tokenParam).toBe('max_tokens');
  });
});
