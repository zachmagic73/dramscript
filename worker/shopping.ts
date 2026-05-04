import type { Env } from './types';
import { requireAuth, json } from './middleware';
import { canonicalize, matchIngredient, type MatchType } from './shopping-utils';

interface IngredientMatch {
  name: string;
  match: MatchType;
  /** Only set when match = 'fuzzy': the inventory name that partially matched */
  matched_by?: string;
}

interface ShoppingItem {
  /** Ingredient name as written in the recipe */
  ingredient_name: string;
  /** How many "want to make" recipes need this ingredient */
  unblocks_count: number;
  /** The recipe names that need this ingredient */
  recipes: Array<{ id: string; name: string; source: 'own' | 'saved' }>;
}

interface RecipeWithIngredients {
  id: string;
  name: string;
  source: 'own' | 'saved';
  ingredients: Array<{ name: string }>;
}

// ── Main: Shopping List ───────────────────────────────────────────────────────

export async function getShoppingList(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // 1. Load inventory (normalized lowercase)
  const invRows = await env.dramscript_db
    .prepare('SELECT name FROM user_ingredients WHERE user_id = ?')
    .bind(auth.user_id)
    .all<{ name: string }>();

  const inventoryNames = invRows.results.map((r) => canonicalize(r.name.toLowerCase().trim()));

  // 2. Load own recipes flagged want_to_make = 1, with their ingredients
  const ownRecipes = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, i.name AS ing_name
      FROM recipes r
      JOIN ingredients i ON i.recipe_id = r.id
      WHERE r.user_id = ? AND r.want_to_make = 1
      ORDER BY r.id, i.order_index
    `)
    .bind(auth.user_id)
    .all<{ id: string; name: string; ing_name: string }>();

  // 3. Load saved recipes with status = 'want_to_make', with their ingredients
  const savedRecipes = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, i.name AS ing_name
      FROM saved_recipes sr
      JOIN recipes r ON r.id = sr.recipe_id
      JOIN ingredients i ON i.recipe_id = r.id
      WHERE sr.user_id = ? AND sr.status = 'want_to_make'
      ORDER BY r.id, i.order_index
    `)
    .bind(auth.user_id)
    .all<{ id: string; name: string; ing_name: string }>();

  // 4. Group rows by recipe, building RecipeWithIngredients[]
  function groupByRecipe(
    rows: Array<{ id: string; name: string; ing_name: string }>,
    source: 'own' | 'saved',
  ): RecipeWithIngredients[] {
    const map = new Map<string, RecipeWithIngredients>();
    for (const row of rows) {
      if (!map.has(row.id)) {
        map.set(row.id, { id: row.id, name: row.name, source, ingredients: [] });
      }
      map.get(row.id)!.ingredients.push({ name: row.ing_name });
    }
    return Array.from(map.values());
  }

  const recipes: RecipeWithIngredients[] = [
    ...groupByRecipe(ownRecipes.results, 'own'),
    ...groupByRecipe(savedRecipes.results, 'saved'),
  ];

  // 5. For each recipe, compute per-ingredient match and collect what's missing
  //    Also build per-recipe ingredient breakdown for the "recipe coverage" response
  const missingMap = new Map<string, ShoppingItem>();

  const recipeCoverage = recipes.map((recipe) => {
    const ingredientMatches: IngredientMatch[] = recipe.ingredients.map((ing) => {
      const { match, matched_by } = matchIngredient(ing.name, inventoryNames);
      return { name: ing.name, match, matched_by };
    });

    // Collect missing/fuzzy ingredients for the shopping list
    for (const ing of ingredientMatches) {
      if (ing.match === 'missing') {
        const key = ing.name.toLowerCase().trim();
        if (!missingMap.has(key)) {
          missingMap.set(key, {
            ingredient_name: ing.name,
            unblocks_count: 0,
            recipes: [],
          });
        }
        const item = missingMap.get(key)!;
        item.unblocks_count += 1;
        item.recipes.push({ id: recipe.id, name: recipe.name, source: recipe.source });
      }
    }

    const haveCount = ingredientMatches.filter((i) => i.match !== 'missing').length;
    const total = ingredientMatches.length;

    return {
      id: recipe.id,
      name: recipe.name,
      source: recipe.source,
      total_ingredients: total,
      have_count: haveCount,
      missing_count: total - haveCount,
      ingredient_matches: ingredientMatches,
    };
  });

  // 6. Sort shopping list by most recipe-unblocking first
  const shoppingList = Array.from(missingMap.values()).sort(
    (a, b) => b.unblocks_count - a.unblocks_count,
  );

  return json({
    inventory_count: inventoryNames.length,
    want_to_make_count: recipes.length,
    shopping_list: shoppingList,
    recipe_coverage: recipeCoverage,
  });
}

// ── Per-recipe ingredient coverage (for RecipeDetail callout) ─────────────────

export async function getRecipeCoverage(
  request: Request,
  env: Env,
  recipeId: string,
): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // Load inventory
  const invRows = await env.dramscript_db
    .prepare('SELECT name FROM user_ingredients WHERE user_id = ?')
    .bind(auth.user_id)
    .all<{ name: string }>();

  if (invRows.results.length === 0) {
    return json({ has_inventory: false, ingredients: [] });
  }

  const inventoryNames = invRows.results.map((r) => canonicalize(r.name.toLowerCase().trim()));

  // Load recipe ingredients
  const ingRows = await env.dramscript_db
    .prepare('SELECT name FROM ingredients WHERE recipe_id = ? ORDER BY order_index')
    .bind(recipeId)
    .all<{ name: string }>();

  const ingredientMatches: IngredientMatch[] = ingRows.results.map((ing) => {
    const { match, matched_by } = matchIngredient(ing.name, inventoryNames);
    return { name: ing.name, match, matched_by };
  });

  return json({ has_inventory: true, ingredients: ingredientMatches });
}
