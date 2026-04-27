import type { RecipeType } from '../types';

export const ICON_COUNT = 50;

interface IconContext {
  name?: string | null;
  type?: RecipeType | string | null;
  glass_type?: string | null;
  garnish?: string | null;
  ice_type?: string | null;
}

const ALL_ICONS = Array.from({ length: ICON_COUNT }, (_, i) => i + 1);

const GLASS_ICON_GROUPS: Record<string, number[]> = {
  rocks: [1, 2, 6, 8, 23, 26, 27, 37, 39, 47],
  highball: [10, 11, 17, 18, 28, 30, 38, 49, 50],
  coupe: [3, 13, 14, 22, 24, 32, 33, 41, 42, 48],
  martini: [5, 7, 34, 35],
  nick_and_nora: [24, 42],
  mule: [9],
  champagne_flute: [15, 19, 36, 46],
  tiki: [9, 12, 20, 25, 37, 44],
  julep_cup: [21],
  wine: [18],
  snifter: [23],
};

const GARNISH_HINTS: Array<{ keywords: string[]; icons: number[] }> = [
  { keywords: ['olive'], icons: [5, 34] },
  { keywords: ['lime', 'cucumber'], icons: [4, 7, 10, 13, 17, 28, 35, 47] },
  { keywords: ['lemon'], icons: [18, 23, 30, 38, 48] },
  { keywords: ['orange peel', 'expressed orange'], icons: [26, 6, 1, 23, 27, 39] },
  { keywords: ['orange'], icons: [1, 2, 8, 27, 39, 40, 47] },
  { keywords: ['mint'], icons: [9, 11, 21, 28, 30, 43, 49, 50] },
  { keywords: ['cherry'], icons: [20, 31, 42] },
  { keywords: ['pineapple'], icons: [12, 25, 44] },
];

const ROCKS_ICE_TYPES = new Set(['large_cube', 'sphere', 'cubed', 'cracked']);

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function normalizeText(input: string | null | undefined): string {
  return (input ?? '').toLowerCase().trim();
}

function pickBySeed(seed: string, candidates: number[]): number {
  if (candidates.length === 0) return 1;
  return candidates[hashSeed(seed) % candidates.length];
}

export function normalizePlaceholderIcon(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  const n = Math.round(value);
  if (n < 1 || n > ICON_COUNT) return null;
  return n;
}

export function getAutomaticPlaceholderIcon(ctx: IconContext): number {
  const glass = normalizeText(ctx.glass_type);
  const garnish = normalizeText(ctx.garnish);
  const iceType = normalizeText(ctx.ice_type);

  // Old Fashioned profile: rocks + orange peel (+ common solid ice) => icon 26 (row 3, col 6).
  if (
    glass === 'rocks'
    && (garnish.includes('orange peel') || garnish.includes('expressed orange'))
    && (iceType === '' || ROCKS_ICE_TYPES.has(iceType))
  ) {
    return 26;
  }

  let candidates = glass && GLASS_ICON_GROUPS[glass] ? [...GLASS_ICON_GROUPS[glass]] : [...ALL_ICONS];

  for (const garnishMatch of GARNISH_HINTS) {
    const isMatch = garnishMatch.keywords.some((kw) => garnish.includes(kw));
    if (!isMatch) continue;
    const overlap = candidates.filter((n) => garnishMatch.icons.includes(n));
    candidates = overlap.length > 0 ? overlap : [...garnishMatch.icons];
    break;
  }

  if (ROCKS_ICE_TYPES.has(iceType)) {
    const iceDriven = glass === 'rocks'
      ? [26, 6, 1, 23, 27, 39]
      : [1, 6, 23, 26, 37, 39];
    const overlap = candidates.filter((n) => iceDriven.includes(n));
    candidates = overlap.length > 0 ? overlap : iceDriven;
  }

  const seed = `${ctx.type ?? ''}|${ctx.glass_type ?? ''}|${ctx.ice_type ?? ''}|${ctx.garnish ?? ''}|${ctx.name ?? ''}`;
  return pickBySeed(seed, candidates);
}

export function resolvePlaceholderIcon(
  ctx: IconContext,
  explicitIcon: number | null | undefined,
): number {
  const normalized = normalizePlaceholderIcon(explicitIcon ?? null);
  if (normalized) return normalized;
  return getAutomaticPlaceholderIcon(ctx);
}

export const PLACEHOLDER_ICON_OPTIONS = [
  { label: 'Auto (by glass/garnish)', value: 'auto' },
  ...Array.from({ length: ICON_COUNT }, (_, i) => ({
    label: `Icon ${i + 1}`,
    value: String(i + 1),
  })),
];
