/**
 * How a model expects its parameters to be shaped.
 *
 * OpenAI-compatible APIs do not agree on this and it changes between model
 * generations: newer OpenAI models renamed `max_tokens` to
 * `max_completion_tokens` and stopped accepting an explicit temperature, while
 * Groq, Mistral and xAI still use the original form.
 */
export interface ModelShape {
  tokenParam: 'max_tokens' | 'max_completion_tokens';
  supportsTemperature: boolean;
}

export const DEFAULT_SHAPE: ModelShape = {
  tokenParam: 'max_tokens',
  supportsTemperature: true,
};

/**
 * Known models, so the common case costs no extra round trip.
 *
 * This list is allowed to be incomplete. Anything missing is discovered from
 * the API's own rejection and cached, so a model released after this was
 * written still works — it just pays one probe the first time.
 */
const REGISTRY: Array<{ match: RegExp; shape: ModelShape }> = [
  {
    // GPT-5 onwards and the o-series reasoning models.
    match: /^(gpt-[5-9]|o[1-9])/i,
    shape: { tokenParam: 'max_completion_tokens', supportsTemperature: false },
  },
];

/** Shapes learned from a rejection, keyed by model. */
const learned = new Map<string, ModelShape>();

export function shapeFor(model: string): ModelShape {
  const remembered = learned.get(model);
  if (remembered) return remembered;

  const known = REGISTRY.find((entry) => entry.match.test(model));
  return known ? { ...known.shape } : { ...DEFAULT_SHAPE };
}

export function rememberShape(model: string, shape: ModelShape): void {
  learned.set(model, shape);
}

/** Only used by tests, so one case cannot leak into the next. */
export function forgetLearnedShapes(): void {
  learned.clear();
}

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; error?: { message?: unknown } };
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error?.message === 'string') return e.error.message;
  }
  return '';
}

/**
 * Derives a corrected shape from a rejection, or null when the error is not
 * about parameter shape and retrying would be pointless.
 *
 * The API states which parameter it refused and often names the replacement,
 * so the correction comes from the provider rather than from a guess here.
 */
export function adaptShape(
  current: ModelShape,
  error: unknown,
): ModelShape | null {
  const message = messageOf(error).toLowerCase();
  if (!message) return null;

  const mentions = (param: string) =>
    message.includes(param) &&
    /unsupported|not supported|unrecognized|invalid|does not support|only the default/.test(
      message,
    );

  if (
    current.tokenParam === 'max_tokens' &&
    (message.includes('max_completion_tokens') || mentions('max_tokens'))
  ) {
    return { ...current, tokenParam: 'max_completion_tokens' };
  }

  if (
    current.tokenParam === 'max_completion_tokens' &&
    mentions('max_completion_tokens') &&
    !message.includes('max_tokens')
  ) {
    return { ...current, tokenParam: 'max_tokens' };
  }

  if (current.supportsTemperature && mentions('temperature')) {
    return { ...current, supportsTemperature: false };
  }

  return null;
}
