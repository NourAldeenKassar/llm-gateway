export type AccessTier = 'free' | 'paid' | 'any';

const TIERS: AccessTier[] = ['free', 'paid', 'any'];

export function parseTier(value: string | null | undefined): AccessTier {
  return TIERS.includes(value as AccessTier) ? (value as AccessTier) : 'free';
}

export function tierAllowsProvider(tier: AccessTier, isPaid: boolean): boolean {
  if (tier === 'any') return true;
  return tier === 'paid' ? isPaid : !isPaid;
}
