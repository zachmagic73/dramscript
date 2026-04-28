/**
 * Shared search utilities for accent-folding and synonym expansion.
 * Used by recipes.ts and templates.ts worker routes.
 */

/** Fold accents and lowercase on the JS/worker side (for bound parameters). */
export function foldSearchInput(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

/**
 * Wrap a SQL column expression in a chain of REPLACE() calls so SQLite
 * compares accent-folded values (SQLite has no UNACCENT() function).
 */
export function sqlFold(expr: string): string {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(LOWER(${expr}), ''), 'á', 'a'), 'à', 'a'), 'â', 'a'), 'ä', 'a'), 'ã', 'a'), 'å', 'a'), 'ā', 'a'), 'ă', 'a'), 'ą', 'a'), 'é', 'e'), 'è', 'e'), 'ê', 'e'), 'ë', 'e'), 'ē', 'e'), 'ė', 'e'), 'ę', 'e'), 'í', 'i'), 'ì', 'i'), 'î', 'i'), 'ï', 'i'), 'ī', 'i'), 'į', 'i'), 'ó', 'o'), 'ò', 'o'), 'ô', 'o'), 'ö', 'o'), 'õ', 'o'), 'ō', 'o'), 'ú', 'u'), 'ù', 'u'), 'û', 'u'), 'ü', 'u'), 'ū', 'u'), 'ñ', 'n')`;
}

/**
 * Synonym groups — all members are interchangeable for search purposes.
 * If a user types any term in a group, all other terms in that group are
 * also searched. Terms are pre-folded at module load.
 */
const SYNONYM_GROUPS: string[][] = [
  // Whiskey family — the most common bar-call substitution
  ['whiskey', 'whisky', 'bourbon', 'rye', 'rye whiskey', 'scotch', 'single malt', 'blended scotch',
    'irish whiskey', 'tennessee whiskey', 'japanese whisky', 'canadian whisky'],
  // Brandy family
  ['brandy', 'cognac', 'armagnac', 'calvados', 'pisco'],
  // Agave spirits
  ['mezcal', 'tequila', 'sotol', 'raicilla'],
  // Sparkling wine
  ['sparkling wine', 'champagne', 'prosecco', 'cava', 'cremant', 'crémant'],
  // Gin family
  ['gin', 'genever', 'old tom gin', 'navy strength gin'],
  // Rum family
  ['rum', 'rhum agricole', 'cachaca', 'cachaça'],
  // Vermouth / aromatised wine
  ['vermouth', 'dry vermouth', 'sweet vermouth', 'bianco vermouth'],
  // Amaro family
  ['amaro', 'campari', 'aperol', 'cynar', 'fernet', 'averna', 'montenegro', 'nonino'],
  // Absinthe / anise
  ['absinthe', 'pastis', 'pernod', 'anise', 'ouzo'],
];

// Pre-fold all synonym groups once at module load.
const FOLDED_GROUPS: string[][] = SYNONYM_GROUPS.map(
  (group) => group.map(foldSearchInput),
);

/**
 * Given a raw user search string, returns a deduplicated array of folded
 * search terms — the original term plus any synonyms from the same group.
 *
 * Example: "whiskey" → ["whiskey", "whisky", "bourbon", "rye", ...]
 * Example: "daiquiri" → ["daiquiri"] (no synonym group)
 */
export function expandSearchTerms(raw: string): string[] {
  const folded = foldSearchInput(raw.trim());
  const terms = new Set<string>([folded]);

  for (const group of FOLDED_GROUPS) {
    if (group.includes(folded)) {
      group.forEach((t) => terms.add(t));
    }
  }

  return [...terms];
}
