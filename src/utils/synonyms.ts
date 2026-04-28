/**
 * Synonym groups for intelligent search — shared between frontend and backend.
 * The worker has its own copy in worker/search-utils.ts (kept separate to avoid
 * cross-build-target imports). Keep these two in sync.
 */
export const SYNONYM_GROUPS: string[][] = [
  ['whiskey', 'whisky', 'bourbon', 'rye', 'rye whiskey', 'scotch', 'single malt', 'blended scotch',
    'irish whiskey', 'tennessee whiskey', 'japanese whisky', 'canadian whisky'],
  ['brandy', 'cognac', 'armagnac', 'calvados', 'pisco'],
  ['mezcal', 'tequila', 'sotol', 'raicilla'],
  ['sparkling wine', 'champagne', 'prosecco', 'cava', 'cremant', 'crémant'],
  ['gin', 'genever', 'old tom gin', 'navy strength gin'],
  ['rum', 'rhum agricole', 'cachaca', 'cachaça'],
  ['vermouth', 'dry vermouth', 'sweet vermouth', 'bianco vermouth'],
  ['amaro', 'campari', 'aperol', 'cynar', 'fernet', 'averna', 'montenegro', 'nonino'],
  ['absinthe', 'pastis', 'pernod', 'anise', 'ouzo'],
];

/**
 * Returns all synonym terms for the given raw search string.
 * If the term belongs to a group, all group members are returned.
 * Otherwise returns just the normalized input term.
 */
export function getSynonyms(raw: string): string[] {
  const lower = raw.toLowerCase().trim();
  for (const group of SYNONYM_GROUPS) {
    if (group.some((s) => s === lower || lower.includes(s) || s.includes(lower))) {
      return group;
    }
  }
  return [lower];
}

/**
 * Given a template's ingredient list and a raw search query, returns the first
 * ingredient name that matched as a synonym (not a direct match), or null if the
 * result matched directly or no synonym match is detectable.
 */
export function getMatchedVia(
  ingredientNames: string[],
  rawQuery: string,
): string | null {
  if (!rawQuery.trim()) return null;
  const lower = rawQuery.toLowerCase().trim();
  const synonyms = getSynonyms(lower);

  // Only flag if the user's term is NOT itself directly in any ingredient
  const directMatch = ingredientNames.some((n) => n.toLowerCase().includes(lower));
  if (directMatch) return null;

  // Check if any synonym (that's not the raw query itself) matches
  for (const synonym of synonyms) {
    if (synonym === lower) continue; // skip the original term
    for (const name of ingredientNames) {
      if (name.toLowerCase().includes(synonym)) {
        return name; // e.g. "Bourbon"
      }
    }
  }

  return null;
}
