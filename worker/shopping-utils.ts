/**
 * Shared ingredient matching utilities used by shopping.ts and discover.ts.
 */

export type MatchType = 'exact' | 'fuzzy' | 'missing';

/**
 * Canonicalise a normalised ingredient string so that spelling variants
 * (e.g. "whiskey" vs "whisky") never cause a false mismatch.
 */
export function canonicalize(s: string): string {
  return s.replace(/whiskey/g, 'whisky');
}

/**
 * Returns true if `needle` appears in `haystack` as a complete word sequence —
 * bounded by start-of-string or a space on the left, and end-of-string or a
 * space on the right.
 *
 * e.g. matchesWholeWord("gin cordial", "gin")      → true  ✓
 *      matchesWholeWord("ginger beer", "gin")       → false ✓ ('n' is followed by 'g', not space/end)
 *      matchesWholeWord("kentucky bourbon", "bourbon") → true  ✓
 *      matchesWholeWord("angostura bitters", "bitters") → true  ✓
 */
function matchesWholeWord(haystack: string, needle: string): boolean {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return false;
  const leftOk = idx === 0 || haystack[idx - 1] === ' ';
  const rightOk = idx + needle.length === haystack.length || haystack[idx + needle.length] === ' ';
  return leftOk && rightOk;
}

/**
 * Checks whether `ingredientName` (from a recipe) is covered by the user's
 * inventory. Returns:
 *  - 'exact'   — case-insensitive exact string match
 *  - 'fuzzy'   — the inventory term appears as a complete word sequence inside
 *                the recipe ingredient name, or vice versa. Prevents partial
 *                token matches like "gin" → "ginger beer".
 *  - 'missing' — no match at all
 */
export function matchIngredient(
  ingredientName: string,
  inventoryNames: string[],
): { match: MatchType; matched_by?: string } {
  const recipeNorm = canonicalize(ingredientName.toLowerCase().trim());

  // Pass 1: exact
  for (const inv of inventoryNames) {
    if (inv === recipeNorm) return { match: 'exact' };
  }

  // Pass 2: whole-word fuzzy (either direction)
  // "gin" matches "gin cordial" ✓   "gin" does NOT match "ginger beer" ✓
  // "bourbon" matches "kentucky bourbon" ✓
  for (const inv of inventoryNames) {
    if (matchesWholeWord(recipeNorm, inv) || matchesWholeWord(inv, recipeNorm)) {
      return { match: 'fuzzy', matched_by: inv };
    }
  }

  return { match: 'missing' };
}
