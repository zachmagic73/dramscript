import type { Env } from './types';
import { requireAuth, json } from './middleware';
import { canonicalize, matchIngredient } from './shopping-utils';

// ── Shared matching helpers ───────────────────────────────────────────────────

// Spirit family → ingredient name patterns (lowercase)
const SPIRIT_FAMILIES: Record<string, string[]> = {
  bourbon: ['bourbon', 'kentucky bourbon', 'wheat bourbon'],
  rye: ['rye', 'rye whiskey', 'rye whisky'],
  scotch: ['scotch', 'single malt', 'blended scotch', 'islay', 'highland'],
  whiskey: ['whiskey', 'whisky', 'bourbon', 'rye', 'scotch', 'irish whiskey', 'tennessee whiskey', 'japanese whisky', 'canadian whisky'],
  gin: ['gin', 'old tom gin', 'navy strength gin', 'genever'],
  rum: ['rum', 'rhum agricole', 'cachaca', 'cachaça', 'dark rum', 'white rum', 'aged rum', 'spiced rum'],
  tequila: ['tequila', 'blanco tequila', 'reposado tequila', 'anejo tequila', 'añejo tequila'],
  mezcal: ['mezcal'],
  vodka: ['vodka'],
  brandy: ['brandy', 'cognac', 'armagnac', 'calvados', 'pisco'],
  agave: ['tequila', 'mezcal', 'sotol', 'raicilla'],
};

// Modifier type → ingredient name patterns (lowercase)
const MODIFIER_TYPES: Record<string, string[]> = {
  vermouth: ['vermouth', 'dry vermouth', 'sweet vermouth', 'bianco vermouth', 'blanc vermouth'],
  amaro: ['amaro', 'campari', 'aperol', 'cynar', 'fernet', 'averna', 'montenegro', 'nonino', 'ramazzotti', 'braulio', 'gran classico'],
  citrus: ['lemon juice', 'lime juice', 'orange juice', 'grapefruit juice', 'lemon', 'lime', 'orange', 'grapefruit', 'citrus'],
  syrup: ['simple syrup', 'syrup', 'honey syrup', 'demerara syrup', 'orgeat', 'grenadine', 'falernum', 'gomme'],
  bitter: ['bitters', 'angostura', 'peychaud', 'orange bitters', 'mole bitters', 'aromatic bitters', 'celery bitters'],
  liqueur: ['triple sec', 'cointreau', 'grand marnier', 'chartreuse', 'benedictine', 'st-germain', 'maraschino', 'creme de', 'liqueur'],
  wine: ['wine', 'champagne', 'prosecco', 'cava', 'sparkling wine', 'port', 'sherry', 'madeira', 'lillet'],
  mixer: ['soda', 'club soda', 'tonic', 'ginger beer', 'ginger ale', 'sparkling water', 'cola'],
};

// Mood/flavor descriptor tags and what they match
const MOOD_DESCRIPTORS: Record<string, { tags: string[]; terms: string[] }> = {
  citrusy: { tags: ['citrusy', 'citrus', 'bright', 'fresh'], terms: ['lemon', 'lime', 'orange', 'grapefruit', 'citrus'] },
  boozy: { tags: ['boozy', 'spirit-forward', 'strong', 'neat'], terms: [] },
  smoky: { tags: ['smoky', 'peaty', 'smoke'], terms: ['mezcal', 'islay', 'peated', 'smoked'] },
  refreshing: { tags: ['refreshing', 'light', 'sessionable', 'low abv', 'crisp'], terms: ['soda', 'tonic', 'spritz', 'highball'] },
  bitter: { tags: ['bitter', 'bittersweet', 'negroni-style'], terms: ['campari', 'aperol', 'amaro', 'cynar', 'vermouth', 'bitters'] },
  tropical: { tags: ['tropical', 'tiki', 'exotic', 'fruity'], terms: ['rum', 'coconut', 'pineapple', 'mango', 'passion fruit', 'orgeat'] },
  cozy: { tags: ['cozy', 'warm', 'winter', 'holiday', 'fall', 'seasonal'], terms: ['cinnamon', 'clove', 'allspice', 'apple', 'pear', 'nutmeg', 'cider'] },
  floral: { tags: ['floral', 'delicate', 'elegant', 'spring'], terms: ['elderflower', 'rose', 'lavender', 'violet', 'hibiscus', 'jasmine', 'st-germain'] },
  'spirit-forward': { tags: ['spirit-forward', 'boozy', 'stirred', 'neat', 'old fashioned'], terms: [] },
  'low-abv': { tags: ['low abv', 'lower abv', 'sessionable', 'easy drinking', 'light'], terms: ['vermouth', 'wine', 'aperol', 'beer', 'cider', 'shrub'] },
};

// ── Type helpers ──────────────────────────────────────────────────────────────

interface RecipeRow {
  id: string;
  name: string;
  type: string;
  difficulty: string | null;
  tags: string | null;
  display_name: string | null;
  user_id: string;
  notes: string | null;
  placeholder_icon: number | null;
  glass_type: string | null;
  garnish: string | null;
  ice_type: string | null;
}

interface IngredientRow {
  recipe_id: string;
  name: string;
}

function parseBooleanQueryParam(
  url: URL,
  key: string,
  defaultValue: boolean,
): boolean {
  const raw = url.searchParams.get(key);
  if (raw === null) return defaultValue;

  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;

  return defaultValue;
}

async function loadUserInventoryNames(env: Env, userId: string): Promise<string[]> {
  const invRows = await env.dramscript_db
    .prepare('SELECT name FROM user_ingredients WHERE user_id = ?')
    .bind(userId)
    .all<{ name: string }>();

  return invRows.results.map((row) => canonicalize(row.name.toLowerCase().trim()));
}

function getMissingIngredients(
  ingredientNames: string[],
  inventoryNames: string[],
): string[] {
  const missingIngredients: string[] = [];

  for (const ingredientName of ingredientNames) {
    const { match } = matchIngredient(ingredientName, inventoryNames);
    if (match === 'missing') missingIngredients.push(ingredientName);
  }

  return missingIngredients;
}

function hasTermMatch(ingredientName: string, terms: string[]): boolean {
  const norm = ingredientName.toLowerCase();
  return terms.some((t) => norm.includes(t));
}

// ── Template discovery helper ─────────────────────────────────────────────────

interface TemplateDiscoverRow {
  id: string;
  name: string;
  description: string | null;
  base_type: string | null;
  riff_count: number;
  missing_count?: number;
  missing_ingredients?: string[];
  total_ingredients?: number;
}

// Return templates filtered by missing tolerance, sorted by fewest missing
async function queryMatchingTemplatesByInventory(
  env: Env,
  inventoryNames: string[],
  missingTolerance: number,
): Promise<TemplateDiscoverRow[]> {

  interface TRow { id: string; name: string; description: string | null; base_type: string | null; riff_count: number; canonical_json: string | null; }
  const all = await env.dramscript_db
    .prepare(
      `SELECT t.id, t.name, t.description, t.base_type,
              COUNT(r.id) AS riff_count, MAX(t.canonical_json) AS canonical_json
       FROM recipe_templates t
       LEFT JOIN recipes r ON r.template_id = t.id AND r.is_public = 1
       GROUP BY t.id`,
    )
    .all<TRow>();

  const results: TemplateDiscoverRow[] = [];
  for (const t of all.results) {
    if (!t.canonical_json) continue;
    let canonical: { ingredients?: { name: string }[] } | null = null;
    try { canonical = JSON.parse(t.canonical_json); } catch { continue; }
    const ings = canonical?.ingredients?.map((i) => i.name) ?? [];
    if (ings.length === 0) continue;
    const missingIngs: string[] = [];
    for (const ing of ings) {
      const { match } = matchIngredient(ing, inventoryNames);
      if (!match || match === 'missing') missingIngs.push(ing);
    }
    results.push({
      id: t.id, name: t.name, description: t.description,
      base_type: t.base_type, riff_count: t.riff_count,
      missing_count: missingIngs.length,
      missing_ingredients: missingIngs,
      total_ingredients: ings.length,
    });
  }
  // Sort: fully makeable first, then fewest missing; apply tolerance filter
  results.sort((a, b) => (a.missing_count ?? 0) - (b.missing_count ?? 0));
  return results.filter((r) => (r.missing_count ?? 0) <= missingTolerance).slice(0, 12);
}

async function queryMatchingTemplates(env: Env, keywords: string[], spiritTerms: string[] = []): Promise<TemplateDiscoverRow[]> {
  if (keywords.length === 0 && spiritTerms.length === 0) return [];

  interface TRow { id: string; name: string; description: string | null; base_type: string | null; riff_count: number; canonical_json: string | null; }
  let rows: { results: TRow[] };

  if (keywords.length > 0) {
    const terms = [...new Set(keywords.map((k) => k.toLowerCase()))].slice(0, 10);
    const clauses = terms.map(() => `(LOWER(t.name) LIKE ? OR LOWER(COALESCE(t.description,'')) LIKE ?)`).join(' OR ');
    const params = terms.flatMap((k) => [`%${k}%`, `%${k}%`]);
    rows = await env.dramscript_db
      .prepare(`
        SELECT t.id, t.name, t.description, t.base_type, COUNT(r.id) AS riff_count, MAX(t.canonical_json) AS canonical_json
        FROM recipe_templates t
        LEFT JOIN recipes r ON r.template_id = t.id AND r.is_public = 1
        WHERE ${clauses}
        GROUP BY t.id
        ORDER BY t.name ASC
        LIMIT 24
      `)
      .bind(...params)
      .all<TRow>();
  } else {
    // Spirit-only: scan all templates and filter by canonical_json ingredients
    rows = await env.dramscript_db
      .prepare(`
        SELECT t.id, t.name, t.description, t.base_type, COUNT(r.id) AS riff_count, MAX(t.canonical_json) AS canonical_json
        FROM recipe_templates t
        LEFT JOIN recipes r ON r.template_id = t.id AND r.is_public = 1
        GROUP BY t.id
        ORDER BY t.name ASC
      `)
      .all<TRow>();
  }

  const results: TemplateDiscoverRow[] = [];
  for (const row of rows.results) {
    if (spiritTerms.length > 0) {
      if (!row.canonical_json) continue;
      let canonical: { ingredients?: { name: string }[] } | null = null;
      try { canonical = JSON.parse(row.canonical_json); } catch { continue; }
      const ings = canonical?.ingredients?.map((i) => i.name) ?? [];
      if (!ings.some((ing) => hasTermMatch(ing, spiritTerms))) continue;
    }
    const { canonical_json: _cj, ...template } = row;
    results.push(template);
  }
  return results.slice(0, 8);
}

async function queryMatchingTemplatesWithInventory(
  env: Env,
  keywords: string[],
  inventoryNames: string[],
  missingTolerance: number,
  spiritTerms: string[] = [],
): Promise<TemplateDiscoverRow[]> {
  if (keywords.length === 0 && spiritTerms.length === 0) return [];

  interface TRow { id: string; name: string; description: string | null; base_type: string | null; riff_count: number; canonical_json: string | null; }
  let rows: { results: TRow[] };

  if (keywords.length > 0) {
    const terms = [...new Set(keywords.map((keyword) => keyword.toLowerCase()))].slice(0, 10);
    const clauses = terms
      .map(() => `(LOWER(t.name) LIKE ? OR LOWER(COALESCE(t.description,'')) LIKE ?)`)
      .join(' OR ');
    const params = terms.flatMap((keyword) => [`%${keyword}%`, `%${keyword}%`]);

    rows = await env.dramscript_db
      .prepare(`
        SELECT t.id, t.name, t.description, t.base_type, COUNT(r.id) AS riff_count, MAX(t.canonical_json) AS canonical_json
        FROM recipe_templates t
        LEFT JOIN recipes r ON r.template_id = t.id AND r.is_public = 1
        WHERE ${clauses}
        GROUP BY t.id
        ORDER BY t.name ASC
        LIMIT 24
      `)
      .bind(...params)
      .all<TRow>();
  } else {
    // Spirit-only: scan all templates and filter by canonical_json ingredients
    rows = await env.dramscript_db
      .prepare(`
        SELECT t.id, t.name, t.description, t.base_type, COUNT(r.id) AS riff_count, MAX(t.canonical_json) AS canonical_json
        FROM recipe_templates t
        LEFT JOIN recipes r ON r.template_id = t.id AND r.is_public = 1
        GROUP BY t.id
        ORDER BY t.name ASC
      `)
      .all<TRow>();
  }

  const results: TemplateDiscoverRow[] = [];

  for (const row of rows.results) {
    if (!row.canonical_json) continue;

    let canonical: { ingredients?: Array<{ name: string }> } | null = null;
    try {
      canonical = JSON.parse(row.canonical_json) as { ingredients?: Array<{ name: string }> };
    } catch {
      continue;
    }

    const ingredientNames = canonical?.ingredients?.map((ingredient) => ingredient.name) ?? [];
    if (ingredientNames.length === 0) continue;

    // Spirit filter: skip templates that don't contain the selected spirit
    if (spiritTerms.length > 0 && !ingredientNames.some((ing) => hasTermMatch(ing, spiritTerms))) continue;

    const missingIngredients = getMissingIngredients(ingredientNames, inventoryNames);
    if (missingIngredients.length > missingTolerance) continue;

    results.push({
      id: row.id,
      name: row.name,
      description: row.description,
      base_type: row.base_type,
      riff_count: row.riff_count,
      missing_count: missingIngredients.length,
      missing_ingredients: missingIngredients,
      total_ingredients: ingredientNames.length,
    });
  }

  results.sort((a, b) => {
    const missingDelta = (a.missing_count ?? 0) - (b.missing_count ?? 0);
    if (missingDelta !== 0) return missingDelta;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, 8);
}

// ── Mode 1: What Can I Make ───────────────────────────────────────────────────

export async function discoverByInventory(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const missingTolerance = Math.min(
    parseInt(url.searchParams.get('missing') ?? '0', 10),
    3,
  );

  // 1. Load user inventory
  const invRows = await env.dramscript_db
    .prepare('SELECT name FROM user_ingredients WHERE user_id = ?')
    .bind(auth.user_id)
    .all<{ name: string }>();

  const inventoryNames = invRows.results.map((r) =>
    canonicalize(r.name.toLowerCase().trim()),
  );

  // 2. Load accessible recipes (own + saved + public)
  // Own recipes
  const ownRows = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.type, r.difficulty, r.tags, r.notes, r.user_id,
             r.placeholder_icon, r.glass_type, r.garnish, r.ice_type,
             u.display_name
      FROM recipes r
      JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 200
    `)
    .bind(auth.user_id)
    .all<RecipeRow>();

  // Saved recipes (own saves of others' public recipes)
  const savedRows = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.type, r.difficulty, r.tags, r.notes, r.user_id,
             r.placeholder_icon, r.glass_type, r.garnish, r.ice_type,
             u.display_name
      FROM saved_recipes sr
      JOIN recipes r ON r.id = sr.recipe_id
      JOIN users u ON u.id = r.user_id
      WHERE sr.user_id = ?
      ORDER BY sr.saved_at DESC
      LIMIT 100
    `)
    .bind(auth.user_id)
    .all<RecipeRow>();

  // Friends' public recipes
  const friendRows = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.type, r.difficulty, r.tags, r.notes, r.user_id,
             r.placeholder_icon, r.glass_type, r.garnish, r.ice_type,
             u.display_name
      FROM recipes r
      JOIN users u ON u.id = r.user_id
      JOIN friendships f ON (
        (f.requester_id = ? AND f.addressee_id = r.user_id) OR
        (f.addressee_id = ? AND f.requester_id = r.user_id)
      )
      WHERE f.status = 'accepted' AND r.is_public = 1 AND r.user_id != ?
      ORDER BY r.updated_at DESC
      LIMIT 200
    `)
    .bind(auth.user_id, auth.user_id, auth.user_id)
    .all<RecipeRow>();

  // De-duplicate by recipe id
  const recipeMap = new Map<string, RecipeRow>();
  for (const r of [...ownRows.results, ...savedRows.results, ...friendRows.results]) {
    if (!recipeMap.has(r.id)) recipeMap.set(r.id, r);
  }
  const allRecipes = Array.from(recipeMap.values());
  if (allRecipes.length === 0) return json({ results: [], inventory_count: inventoryNames.length });

  // 3. Load ingredients and primary images for all recipe ids
  const ids = allRecipes.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const ingRows = await env.dramscript_db
    .prepare(`SELECT recipe_id, name FROM ingredients WHERE recipe_id IN (${placeholders})`)
    .bind(...ids)
    .all<IngredientRow>();

  const imgRows = await env.dramscript_db
    .prepare(`SELECT recipe_id, r2_key FROM recipe_images WHERE recipe_id IN (${placeholders}) AND is_primary = 1`)
    .bind(...ids)
    .all<{ recipe_id: string; r2_key: string }>();

  // Group ingredients by recipe
  const ingMap = new Map<string, string[]>();
  for (const row of ingRows.results) {
    if (!ingMap.has(row.recipe_id)) ingMap.set(row.recipe_id, []);
    ingMap.get(row.recipe_id)!.push(row.name);
  }

  const imageMap = new Map<string, string>();
  for (const row of imgRows.results) {
    imageMap.set(row.recipe_id, row.r2_key);
  }

  // 4. Score each recipe
  const results: Array<{
    id: string;
    name: string;
    type: string;
    difficulty: string | null;
    tags: string[];
    display_name: string | null;
    primary_image: string | null;
    placeholder_icon: number | null;
    glass_type: string | null;
    garnish: string | null;
    ice_type: string | null;
    missing_count: number;
    missing_ingredients: string[];
    total_ingredients: number;
  }> = [];

  for (const recipe of allRecipes) {
    const ings = ingMap.get(recipe.id) ?? [];
    if (ings.length === 0) continue;

    const missingIngs: string[] = [];
    for (const ing of ings) {
      const { match } = matchIngredient(ing, inventoryNames);
      if (match === 'missing') missingIngs.push(ing);
    }

    if (missingIngs.length <= missingTolerance) {
      results.push({
        id: recipe.id,
        name: recipe.name,
        type: recipe.type,
        difficulty: recipe.difficulty,
        tags: recipe.tags ? (JSON.parse(recipe.tags) as string[]) : [],
        display_name: recipe.display_name,
        primary_image: imageMap.get(recipe.id) ?? null,
        placeholder_icon: recipe.placeholder_icon,
        glass_type: recipe.glass_type,
        garnish: recipe.garnish,
        ice_type: recipe.ice_type,
        missing_count: missingIngs.length,
        missing_ingredients: missingIngs,
        total_ingredients: ings.length,
      });
    }
  }

  // Sort: fully makeable first, then fewest missing
  results.sort((a, b) => a.missing_count - b.missing_count);

  const templateResults = await queryMatchingTemplatesByInventory(env, inventoryNames, missingTolerance);
  return json({ results, template_results: templateResults, inventory_count: inventoryNames.length });
}

// ── Mode 2: Bartender's Choice (Mood-Based) ───────────────────────────────────

export async function discoverByMood(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const inventoryOnly = parseBooleanQueryParam(url, 'inventoryOnly', true);
  const moodsParam = url.searchParams.get('moods') ?? '';
  const selectedMoods = moodsParam
    .split(',')
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 5); // cap at 5 descriptors

  if (selectedMoods.length === 0) {
    return json({ error: 'At least one mood descriptor is required' }, 400);
  }

  const inventoryNames = inventoryOnly
    ? await loadUserInventoryNames(env, auth.user_id)
    : [];

  // Separate spirit selections from mood descriptor selections
  const spiritMoods = selectedMoods.filter((m) => m in SPIRIT_FAMILIES);
  const spiritIngredientTerms = spiritMoods.flatMap((s) => SPIRIT_FAMILIES[s] ?? []);
  const hasDescriptorMoods = selectedMoods.some((m) => m in MOOD_DESCRIPTORS);

  // Collect all tag patterns and ingredient terms for selected moods
  const tagPatterns: string[] = [];
  const ingredientTerms: string[] = [];
  for (const mood of selectedMoods) {
    const descriptor = MOOD_DESCRIPTORS[mood];
    if (!descriptor) continue;
    tagPatterns.push(...descriptor.tags);
    ingredientTerms.push(...descriptor.terms);
  }

  // Query public recipes + own + friends' accessible recipes
  // We'll pull a broad set and filter in JS
  const publicRows = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.type, r.difficulty, r.tags, r.notes, r.user_id,
             r.placeholder_icon, r.glass_type, r.garnish, r.ice_type,
             u.display_name
      FROM recipes r
      JOIN users u ON u.id = r.user_id
      WHERE r.is_public = 1
      ORDER BY r.updated_at DESC
      LIMIT 300
    `)
    .all<RecipeRow>();

  const ownRows = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.type, r.difficulty, r.tags, r.notes, r.user_id,
             r.placeholder_icon, r.glass_type, r.garnish, r.ice_type,
             u.display_name
      FROM recipes r
      JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 100
    `)
    .bind(auth.user_id)
    .all<RecipeRow>();

  const recipeMap = new Map<string, RecipeRow>();
  for (const r of [...ownRows.results, ...publicRows.results]) {
    if (!recipeMap.has(r.id)) recipeMap.set(r.id, r);
  }
  const allRecipes = Array.from(recipeMap.values());
  if (allRecipes.length === 0) return json({ results: [] });

  // Load ingredients and primary images for all recipes
  const ids = allRecipes.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const ingRows = await env.dramscript_db
    .prepare(`SELECT recipe_id, name FROM ingredients WHERE recipe_id IN (${placeholders})`)
    .bind(...ids)
    .all<IngredientRow>();

  const imgRows = await env.dramscript_db
    .prepare(`SELECT recipe_id, r2_key FROM recipe_images WHERE recipe_id IN (${placeholders}) AND is_primary = 1`)
    .bind(...ids)
    .all<{ recipe_id: string; r2_key: string }>();

  const ingMap = new Map<string, string[]>();
  for (const row of ingRows.results) {
    if (!ingMap.has(row.recipe_id)) ingMap.set(row.recipe_id, []);
    ingMap.get(row.recipe_id)!.push(row.name);
  }

  const imageMap = new Map<string, string>();
  for (const row of imgRows.results) {
    imageMap.set(row.recipe_id, row.r2_key);
  }

  // Score each recipe by how many mood descriptors it matches
  const results: Array<{
    id: string;
    name: string;
    type: string;
    difficulty: string | null;
    tags: string[];
    display_name: string | null;
    primary_image: string | null;
    placeholder_icon: number | null;
    glass_type: string | null;
    garnish: string | null;
    ice_type: string | null;
    score: number;
    matched_moods: string[];
  }> = [];

  for (const recipe of allRecipes) {
    const recipeTags = recipe.tags ? (JSON.parse(recipe.tags) as string[]).map((t) => t.toLowerCase()) : [];
    const recipeNotes = (recipe.notes ?? '').toLowerCase();
    const ings = ingMap.get(recipe.id) ?? [];

    if (inventoryOnly) {
      const missingIngredients = getMissingIngredients(ings, inventoryNames);
      if (missingIngredients.length > 0) continue;
    }

    // Hard filter: if a spirit was selected, recipe must contain that spirit
    if (spiritIngredientTerms.length > 0) {
      const hasSpiritIng = ings.some((ing) => hasTermMatch(ing, spiritIngredientTerms));
      if (!hasSpiritIng) continue;
    }

    let score = 0;
    const matchedMoods: string[] = [];

    for (const mood of selectedMoods) {
      const descriptor = MOOD_DESCRIPTORS[mood];
      if (!descriptor) continue;

      const tagMatch = descriptor.tags.some((t) => recipeTags.some((rt) => rt.includes(t)));
      const noteMatch = descriptor.tags.some((t) => recipeNotes.includes(t));
      const ingMatch = descriptor.terms.some((term) => ings.some((ing) => ing.toLowerCase().includes(term)));

      if (tagMatch || noteMatch || ingMatch) {
        score++;
        matchedMoods.push(mood);
      }
    }

    // Include if: mood descriptors matched, OR only a spirit was selected (no descriptor moods)
    if (score > 0 || (spiritIngredientTerms.length > 0 && !hasDescriptorMoods)) {
      results.push({
        id: recipe.id,
        name: recipe.name,
        type: recipe.type,
        difficulty: recipe.difficulty,
        tags: recipe.tags ? (JSON.parse(recipe.tags) as string[]) : [],
        display_name: recipe.display_name,
        primary_image: imageMap.get(recipe.id) ?? null,
        placeholder_icon: recipe.placeholder_icon,
        glass_type: recipe.glass_type,
        garnish: recipe.garnish,
        ice_type: recipe.ice_type,
        score: score || 1,
        matched_moods: matchedMoods.length > 0 ? matchedMoods : spiritMoods,
      });
    }
  }

  // Sort by score desc
  results.sort((a, b) => b.score - a.score);

  // Find matching templates, filtered by spirit if one was selected
  const templateKeywords = [...tagPatterns, ...ingredientTerms];
  const templateResults = inventoryOnly
    ? await queryMatchingTemplatesWithInventory(env, templateKeywords, inventoryNames, 0, spiritIngredientTerms)
    : await queryMatchingTemplates(env, templateKeywords, spiritIngredientTerms);

  return json({
    results: results.slice(0, 50),
    template_results: templateResults,
    inventory_count: inventoryNames.length,
    inventory_only: inventoryOnly,
  });
}

// ── Mode 3: Spirit + Modifier Finder ─────────────────────────────────────────

export async function discoverBySpiritModifier(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const inventoryOnly = parseBooleanQueryParam(url, 'inventoryOnly', true);
  const spirit = (url.searchParams.get('spirit') ?? '').toLowerCase().trim();
  const modifier = (url.searchParams.get('modifier') ?? '').toLowerCase().trim();

  if (!spirit) return json({ error: 'spirit parameter is required' }, 400);

  const spiritTerms = SPIRIT_FAMILIES[spirit] ?? [spirit];
  const modifierTerms = modifier ? (MODIFIER_TYPES[modifier] ?? [modifier]) : [];
  const inventoryNames = inventoryOnly
    ? await loadUserInventoryNames(env, auth.user_id)
    : [];

  // Load accessible public + own recipes
  const publicRows = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.type, r.difficulty, r.tags, r.notes, r.user_id,
             r.placeholder_icon, r.glass_type, r.garnish, r.ice_type,
             u.display_name
      FROM recipes r
      JOIN users u ON u.id = r.user_id
      WHERE r.is_public = 1
      ORDER BY r.updated_at DESC
      LIMIT 300
    `)
    .all<RecipeRow>();

  const ownRows = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.type, r.difficulty, r.tags, r.notes, r.user_id,
             r.placeholder_icon, r.glass_type, r.garnish, r.ice_type,
             u.display_name
      FROM recipes r
      JOIN users u ON u.id = r.user_id
      WHERE r.user_id = ?
      ORDER BY r.updated_at DESC
      LIMIT 100
    `)
    .bind(auth.user_id)
    .all<RecipeRow>();

  const recipeMap = new Map<string, RecipeRow>();
  for (const r of [...ownRows.results, ...publicRows.results]) {
    if (!recipeMap.has(r.id)) recipeMap.set(r.id, r);
  }
  const allRecipes = Array.from(recipeMap.values());
  if (allRecipes.length === 0) return json({ results: [] });

  // Load ingredients and primary images
  const ids = allRecipes.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const ingRows = await env.dramscript_db
    .prepare(`SELECT recipe_id, name FROM ingredients WHERE recipe_id IN (${placeholders})`)
    .bind(...ids)
    .all<IngredientRow>();

  const imgRows = await env.dramscript_db
    .prepare(`SELECT recipe_id, r2_key FROM recipe_images WHERE recipe_id IN (${placeholders}) AND is_primary = 1`)
    .bind(...ids)
    .all<{ recipe_id: string; r2_key: string }>();

  const ingMap = new Map<string, string[]>();
  for (const row of ingRows.results) {
    if (!ingMap.has(row.recipe_id)) ingMap.set(row.recipe_id, []);
    ingMap.get(row.recipe_id)!.push(row.name);
  }

  const imageMap = new Map<string, string>();
  for (const row of imgRows.results) {
    imageMap.set(row.recipe_id, row.r2_key);
  }

  // Filter recipes
  const results: Array<{
    id: string;
    name: string;
    type: string;
    difficulty: string | null;
    tags: string[];
    display_name: string | null;
    primary_image: string | null;
    placeholder_icon: number | null;
    glass_type: string | null;
    garnish: string | null;
    ice_type: string | null;
    matched_spirit: string | null;
    matched_modifier: string | null;
  }> = [];

  for (const recipe of allRecipes) {
    const ings = ingMap.get(recipe.id) ?? [];

    if (inventoryOnly) {
      const missingIngredients = getMissingIngredients(ings, inventoryNames);
      if (missingIngredients.length > 0) continue;
    }

    const spiritIng = ings.find((ing) => hasTermMatch(ing, spiritTerms));
    if (!spiritIng) continue;

    let modifierIng: string | null = null;
    if (modifierTerms.length > 0) {
      modifierIng = ings.find((ing) => hasTermMatch(ing, modifierTerms)) ?? null;
      if (!modifierIng) continue;
    }

    results.push({
      id: recipe.id,
      name: recipe.name,
      type: recipe.type,
      difficulty: recipe.difficulty,
      tags: recipe.tags ? (JSON.parse(recipe.tags) as string[]) : [],
      display_name: recipe.display_name,
      primary_image: imageMap.get(recipe.id) ?? null,
      placeholder_icon: recipe.placeholder_icon,
      glass_type: recipe.glass_type,
      garnish: recipe.garnish,
      ice_type: recipe.ice_type,
      matched_spirit: spiritIng,
      matched_modifier: modifierIng,
    });
  }

  // Find matching templates, always filtered by spirit ingredient
  const templateKeywords = modifierTerms.length ? modifierTerms : [];
  const templateResults = inventoryOnly
    ? await queryMatchingTemplatesWithInventory(env, templateKeywords, inventoryNames, 0, spiritTerms)
    : await queryMatchingTemplates(env, templateKeywords, spiritTerms);

  return json({
    results: results.slice(0, 50),
    template_results: templateResults,
    inventory_count: inventoryNames.length,
    inventory_only: inventoryOnly,
  });
}

// ── AI Suggestions ────────────────────────────────────────────────────────────

interface AiSuggestion {
  name: string;
  pitch: string;
  ingredients: string[];
  steps: string[];
}

type AiMode = 'inventory' | 'mood' | 'spirit-modifier';

interface AISuggestionsBody {
  mode: AiMode;
  context: Record<string, unknown>;
}

function buildPrompt(mode: AiMode, context: Record<string, unknown>): string {
  const schema = `[{"name":"Cocktail Name","pitch":"One sentence pitch.","ingredients":["1.5 oz spirit","0.5 oz syrup"],"steps":["Step one.","Step two."]},...]`;
  const existingNames = (context.existingNames as string[] | undefined) ?? [];
  const exclusionText = existingNames.length > 0
    ? `\n\nDo NOT suggest any of the following — they already appear in the results: ${existingNames.join(', ')}.`
    : '';

  if (mode === 'inventory') {
    const ingredients = (context.ingredients as string[] | undefined) ?? [];
    const missingTolerance = (context.missingTolerance as number | undefined) ?? 0;
    const toleranceText = missingTolerance > 0
      ? `They may use up to ${missingTolerance} additional ingredient${missingTolerance > 1 ? 's' : ''} not on the list, but every other ingredient MUST come from the list.`
      : 'Every single ingredient MUST come from the list above. Do not add any ingredient not on this list — not even water, ice, or garnishes unless they appear in the list.';
    return `You are an expert bartender. The user has exactly these ingredients available:
${ingredients.slice(0, 30).map((i) => `- ${i}`).join('\n')}

CRITICAL CONSTRAINT: ${toleranceText}

Suggest exactly 4 cocktails they could make. For each, provide:
- name: the cocktail name
- pitch: one sentence explaining why it works with their bar
- ingredients: full list with measurements — ONLY using items from the inventory list above
- steps: step-by-step instructions as an array of strings

Do not suggest cocktails that require spirits, liqueurs, or mixers not listed.${exclusionText}

Respond ONLY with a JSON array (no markdown, no explanation):
${schema}`;
  }

  if (mode === 'mood') {
    const moods = (context.moods as string[] | undefined) ?? [];
    return `You are an expert bartender. The user is in the mood for something: ${moods.join(', ')}.

Suggest exactly 4 cocktails that fit this vibe. For each, provide:
- name: the cocktail name
- pitch: one sentence explaining why it matches the mood
- ingredients: full ingredient list with measurements (e.g. "2 oz gin", "0.75 oz lime juice")
- steps: complete step-by-step instructions as an array of strings${exclusionText}

Respond ONLY with a JSON array (no markdown, no explanation):
${schema}`;
  }

  if (mode === 'spirit-modifier') {
    const spirit = (context.spirit as string | undefined) ?? '';
    const modifier = (context.modifier as string | undefined) ?? '';
    const modifierText = modifier ? ` paired with ${modifier}` : '';
    return `You are an expert bartender. The user wants to explore cocktails built on ${spirit}${modifierText}.

Suggest exactly 4 cocktails — include both classics and lesser-known gems. For each, provide:
- name: the cocktail name
- pitch: one sentence pitch
- ingredients: full ingredient list with measurements
- steps: complete step-by-step instructions as an array of strings${exclusionText}

Respond ONLY with a JSON array (no markdown, no explanation):
${schema}`;
  }

  return '';
}

// Strip leading amount+unit from an AI ingredient string, return the core name
function parseAiIngredientName(ingStr: string): string {
  return ingStr
    .replace(/^\s*[\d./½¾¼]+\s*(oz|ml|cl|tsp|tbsp|cup|cups|dash|dashes|drop|drops|pinch|barspoon|splash|parts?|ounces?)\s+/i, '')
    .trim();
}

// Non-alcoholic / garnish words we don't try to match against inventory
const SKIP_INGREDIENT_RE = /^(ice|water|hot\s+water|club\s+soda|soda\s+water|tonic\s+water|garnish|lemon\s+twist|orange\s+twist|lime\s+wheel|orange\s+peel|lemon\s+peel|cherry|maraschino\s+cherry|mint\s+sprig|mint\s+leaves|fresh\s+mint|egg\s+white|salt|sugar|simple\s+syrup|honey|cream)/i;

function aiSuggestionPassesInventory(
  suggestion: { ingredients: string[] },
  inventoryNames: string[], // pre-canonicalized
  missingTolerance: number,
): boolean {
  let missingCount = 0;
  for (const ingStr of suggestion.ingredients) {
    const name = parseAiIngredientName(ingStr);
    if (!name || SKIP_INGREDIENT_RE.test(name)) continue;
    const { match } = matchIngredient(name, inventoryNames);
    if (match === 'missing') missingCount++;
  }
  return missingCount <= missingTolerance;
}

export async function getAiSuggestions(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // Graceful degradation: if AI binding is not available (e.g., local dev), return empty
  if (!env.AI) {
    return json({ suggestions: [], note: 'AI not available in this environment' });
  }

  let body: AISuggestionsBody;
  try {
    body = (await request.json()) as AISuggestionsBody;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { mode, context } = body;
  if (!mode || !['inventory', 'mood', 'spirit-modifier'].includes(mode)) {
    return json({ error: 'Invalid mode' }, 400);
  }

  // For inventory mode, fetch the user's actual ingredient list from the DB
  let enrichedContext: Record<string, unknown> = context ?? {};
  if (mode === 'inventory') {
    const invRows = await env.dramscript_db
      .prepare('SELECT name FROM user_ingredients WHERE user_id = ?')
      .bind(auth.user_id)
      .all<{ name: string }>();
    enrichedContext = { ...enrichedContext, ingredients: invRows.results.map((r) => r.name) };
  }

  const prompt = buildPrompt(mode, enrichedContext);
  if (!prompt) return json({ suggestions: [] });

  try {
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content:
            'You are a knowledgeable bartender assistant. You always respond with valid JSON arrays only — no markdown, no explanation.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2048,
    });

    // Workers AI returns { response: string } for chat models
    const raw = (aiResponse as { response?: string }).response ?? '';

    // Extract JSON array from the response (strip any surrounding text)
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return json({ suggestions: [] });

    const suggestions = JSON.parse(match[0]) as AiSuggestion[];
    // Validate shape
    const clean = suggestions
      .filter(
        (s) =>
          typeof s.name === 'string' &&
          typeof s.pitch === 'string' &&
          Array.isArray(s.ingredients) &&
          Array.isArray(s.steps),
      )
      .map((s) => ({
        name: s.name,
        pitch: s.pitch,
        ingredients: (s.ingredients as unknown[]).filter((x) => typeof x === 'string') as string[],
        steps: (s.steps as unknown[]).filter((x) => typeof x === 'string') as string[],
      }))
      .slice(0, 5);

    // For inventory mode: post-filter against user's actual inventory
    let filtered = clean;
    if (mode === 'inventory' && Array.isArray(enrichedContext.ingredients)) {
      const invCanon = (enrichedContext.ingredients as string[]).map((n) =>
        canonicalize(n.toLowerCase().trim()),
      );
      const tolerance = typeof enrichedContext.missingTolerance === 'number' ? enrichedContext.missingTolerance : 0;
      filtered = clean.filter((s) => aiSuggestionPassesInventory(s, invCanon, tolerance));
      // If post-filter removed everything, fall back to returning the raw clean set
      if (filtered.length === 0) filtered = clean;
    }

    return json({ suggestions: filtered });
  } catch {
    // AI errors should not break the page
    return json({ suggestions: [] });
  }
}
