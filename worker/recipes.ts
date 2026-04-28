import type { Env } from './types';
import { requireAuth, json, notFound } from './middleware';
import { sqlFold, expandSearchTerms } from './search-utils';

interface RecipeInput {
  name: string;
  type?: string;
  glass_type?: string | null;
  ice_type?: string | null;
  method?: string | null;
  garnish?: string | null;
  notes?: string | null;
  difficulty?: string | null;
  tags?: string[];
  is_public?: boolean;
  visibility?: 'private' | 'friends' | 'public';
  want_to_make?: boolean;
  placeholder_icon?: number | null;
  template_id?: string | null;
  source_recipe_id?: string | null;
  servings?: number;
  ingredients?: { name: string; amount?: number | null; unit?: string | null; referenced_recipe_id?: string | null }[];
  steps?: { description: string }[];
}

type DbRow = Record<string, unknown>;

async function insertIngredients(
  env: Env,
  recipeId: string,
  ingredients: NonNullable<RecipeInput['ingredients']>,
) {
  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    await env.dramscript_db
      .prepare('INSERT INTO ingredients (id, recipe_id, name, amount, unit, referenced_recipe_id, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(crypto.randomUUID(), recipeId, ing.name, ing.amount ?? null, ing.unit ?? null, ing.referenced_recipe_id ?? null, i)
      .run();
  }
}

async function insertSteps(
  env: Env,
  recipeId: string,
  steps: NonNullable<RecipeInput['steps']>,
) {
  for (let i = 0; i < steps.length; i++) {
    await env.dramscript_db
      .prepare('INSERT INTO steps (id, recipe_id, description, order_index) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), recipeId, steps[i].description, i)
      .run();
  }
}

export async function listRecipes(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const difficulty = url.searchParams.get('difficulty');
  const tag = url.searchParams.get('tag');
  const search = url.searchParams.get('q');
  const all = url.searchParams.get('all');

  // If requesting all recipes for dropdown, return minimal fields
  if (all === 'true') {
    const result = await env.dramscript_db
      .prepare('SELECT id, name, type FROM recipes WHERE user_id = ? ORDER BY updated_at DESC')
      .bind(auth.user_id)
      .all<DbRow>();
    return json({ recipes: result.results });
  }

  let query = `
    SELECT r.*,
           ri.r2_key AS primary_image
    FROM recipes r
    LEFT JOIN recipe_images ri ON ri.recipe_id = r.id AND ri.is_primary = 1
    WHERE r.user_id = ?
  `;
  const params: unknown[] = [auth.user_id];

  if (type) { query += ' AND r.type = ?'; params.push(type); }
  if (difficulty) { query += ' AND r.difficulty = ?'; params.push(difficulty); }
  if (tag) { query += ' AND r.tags LIKE ?'; params.push(`%"${tag}"%`); }
  if (search) {
    const terms = expandSearchTerms(search);
    const termClauses = terms
      .map(() => `(
        ${sqlFold('r.name')} LIKE ?
        OR ${sqlFold('r.notes')} LIKE ?
        OR EXISTS (
          SELECT 1 FROM ingredients i
          WHERE i.recipe_id = r.id
            AND ${sqlFold('i.name')} LIKE ?
        )
      )`)
      .join(' OR ');
    query += ` AND (${termClauses})`;
    for (const term of terms) {
      const like = `%${term}%`;
      params.push(like, like, like);
    }
  }
  query += ' ORDER BY r.updated_at DESC';

  const result = await env.dramscript_db.prepare(query).bind(...params).all<DbRow>();
  const recipes = result.results.map((r) => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags as string) : [],
  }));

  return json({ recipes });
}

export async function getRecipe(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const recipe = await env.dramscript_db
    .prepare('SELECT * FROM recipes WHERE id = ?')
    .bind(id)
    .first<DbRow>();

  if (!recipe) return notFound();

  // Check visibility: own recipes are always visible, public recipes are visible to all,
  // friends-only recipes are visible to friends, private recipes are only for owner
  if (recipe.user_id !== auth.user_id) {
    const visibility = (recipe.visibility as string) || 'private';
    if (visibility === 'private') return notFound();
    if (visibility === 'friends') {
      // Check if they are friends
      const friendship = await env.dramscript_db
        .prepare(
          `SELECT id FROM friendships
           WHERE status = 'accepted'
           AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`
        )
        .bind(auth.user_id, recipe.user_id, recipe.user_id, auth.user_id)
        .first();
      if (!friendship) return notFound();
    }
    // visibility === 'public' is always allowed
  }

  const [ingredients, steps, images] = await Promise.all([
    env.dramscript_db.prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY order_index').bind(id).all(),
    env.dramscript_db.prepare('SELECT * FROM steps WHERE recipe_id = ? ORDER BY order_index').bind(id).all(),
    env.dramscript_db.prepare('SELECT * FROM recipe_images WHERE recipe_id = ? ORDER BY is_primary DESC, created_at ASC').bind(id).all(),
  ]);

  // Fetch referenced recipes for ingredients that have them
  const ingredientsWithRefs = await Promise.all(
    ingredients.results.map(async (ing: DbRow) => {
      if (!ing.referenced_recipe_id) return ing;
      const refRecipe = await env.dramscript_db
        .prepare('SELECT id, name, type FROM recipes WHERE id = ?')
        .bind(ing.referenced_recipe_id)
        .first<DbRow>();
      return { ...ing, referencedRecipe: refRecipe ?? null };
    })
  );

  return json({
    recipe: {
      ...recipe,
      tags: recipe.tags ? JSON.parse(recipe.tags as string) : [],
      ingredients: ingredientsWithRefs,
      steps: steps.results,
      images: images.results,
    },
  });
}

export async function createRecipe(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as RecipeInput;
  if (!body.name?.trim()) return json({ error: 'Name is required' }, 400);

  const id = crypto.randomUUID();

  const visibility = body.visibility || (body.is_public ? 'public' : 'private');

  await env.dramscript_db
    .prepare(`
      INSERT INTO recipes
        (id, user_id, name, type, glass_type, ice_type, method, garnish, notes,
         difficulty, tags, is_public, visibility, want_to_make, placeholder_icon, template_id, source_recipe_id, servings, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)
    .bind(
      id, auth.user_id, body.name.trim(), body.type ?? 'cocktail',
      body.glass_type ?? null, body.ice_type ?? null, body.method ?? null,
      body.garnish ?? null, body.notes ?? null, body.difficulty ?? null,
      JSON.stringify(body.tags ?? []),
      body.is_public ? 1 : 0,
      visibility, body.want_to_make ? 1 : 0,
      body.placeholder_icon ?? null,
      body.template_id ?? null, body.source_recipe_id ?? null,
      body.servings ?? 1,
    )
    .run();

  if (body.ingredients?.length) await insertIngredients(env, id, body.ingredients);
  if (body.steps?.length) await insertSteps(env, id, body.steps);

  return json({ id }, 201);
}

export async function updateRecipe(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const recipe = await env.dramscript_db
    .prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?')
    .bind(id, auth.user_id)
    .first<DbRow & { version: number }>();

  if (!recipe) return notFound();

  const body = await request.json() as RecipeInput;
  if (!body.name?.trim()) return json({ error: 'Name is required' }, 400);

  // Save snapshot of current version before overwriting
  const [ings, stps] = await Promise.all([
    env.dramscript_db.prepare('SELECT * FROM ingredients WHERE recipe_id = ?').bind(id).all(),
    env.dramscript_db.prepare('SELECT * FROM steps WHERE recipe_id = ?').bind(id).all(),
  ]);

  const snapshot = JSON.stringify({
    ...recipe,
    tags: recipe.tags ? JSON.parse(recipe.tags as string) : [],
    ingredients: ings.results,
    steps: stps.results,
  });

  await env.dramscript_db
    .prepare('INSERT INTO recipe_versions (id, recipe_id, version, snapshot) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), id, recipe.version, snapshot)
    .run();

  const newVersion = recipe.version + 1;
  const visibility = body.visibility || (body.is_public ? 'public' : 'private');

  await env.dramscript_db
    .prepare(`
      UPDATE recipes SET
        name = ?, type = ?, glass_type = ?, ice_type = ?, method = ?,
        garnish = ?, notes = ?, difficulty = ?, tags = ?, is_public = ?,
        visibility = ?, want_to_make = ?, placeholder_icon = ?, servings = ?, version = ?,
        updated_at = strftime('%s', 'now')
      WHERE id = ? AND user_id = ?
    `)
    .bind(
      body.name.trim(), body.type ?? 'cocktail',
      body.glass_type ?? null, body.ice_type ?? null, body.method ?? null,
      body.garnish ?? null, body.notes ?? null, body.difficulty ?? null,
      JSON.stringify(body.tags ?? []),
      body.is_public ? 1 : 0,
      visibility, body.want_to_make ? 1 : 0,
      body.placeholder_icon ?? null,
      body.servings ?? 1, newVersion,
      id, auth.user_id,
    )
    .run();

  await env.dramscript_db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').bind(id).run();
  await env.dramscript_db.prepare('DELETE FROM steps WHERE recipe_id = ?').bind(id).run();

  if (body.ingredients?.length) await insertIngredients(env, id, body.ingredients);
  if (body.steps?.length) await insertSteps(env, id, body.steps);

  return json({ ok: true, version: newVersion });
}

export async function deleteRecipe(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const result = await env.dramscript_db
    .prepare('DELETE FROM recipes WHERE id = ? AND user_id = ?')
    .bind(id, auth.user_id)
    .run();

  if (!result.meta.changes) return notFound();
  return json({ ok: true });
}

export async function getRecipeVersions(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const recipe = await env.dramscript_db
    .prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
    .bind(id, auth.user_id)
    .first();

  if (!recipe) return notFound();

  const versions = await env.dramscript_db
    .prepare('SELECT id, recipe_id, version, changed_at FROM recipe_versions WHERE recipe_id = ? ORDER BY version DESC')
    .bind(id)
    .all();

  return json({ versions: versions.results });
}

export async function getVersionSnapshot(request: Request, env: Env, versionId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const version = await env.dramscript_db
    .prepare(`
      SELECT rv.snapshot FROM recipe_versions rv
      JOIN recipes r ON r.id = rv.recipe_id
      WHERE rv.id = ? AND r.user_id = ?
    `)
    .bind(versionId, auth.user_id)
    .first<{ snapshot: string }>();

  if (!version) return notFound();

  return json({ snapshot: JSON.parse(version.snapshot) });
}

export async function restoreVersion(request: Request, env: Env, versionId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const version = await env.dramscript_db
    .prepare(`
      SELECT rv.id, rv.recipe_id, rv.snapshot
      FROM recipe_versions rv
      JOIN recipes r ON r.id = rv.recipe_id
      WHERE rv.id = ? AND r.user_id = ?
    `)
    .bind(versionId, auth.user_id)
    .first<{ id: string; recipe_id: string; snapshot: string }>();

  if (!version) return notFound();

  const currentRecipe = await env.dramscript_db
    .prepare('SELECT * FROM recipes WHERE id = ? AND user_id = ?')
    .bind(version.recipe_id, auth.user_id)
    .first<DbRow & { version: number }>();

  if (!currentRecipe) return notFound();

  const [currentIngredients, currentSteps] = await Promise.all([
    env.dramscript_db.prepare('SELECT * FROM ingredients WHERE recipe_id = ?').bind(version.recipe_id).all(),
    env.dramscript_db.prepare('SELECT * FROM steps WHERE recipe_id = ?').bind(version.recipe_id).all(),
  ]);

  // Snapshot current state before restoring.
  const currentSnapshot = JSON.stringify({
    ...currentRecipe,
    tags: currentRecipe.tags ? JSON.parse(currentRecipe.tags as string) : [],
    ingredients: currentIngredients.results,
    steps: currentSteps.results,
  });

  await env.dramscript_db
    .prepare('INSERT INTO recipe_versions (id, recipe_id, version, snapshot) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), version.recipe_id, currentRecipe.version, currentSnapshot)
    .run();

  const snapshot = JSON.parse(version.snapshot) as RecipeInput & {
    tags?: string[];
    ingredients?: { name: string; amount?: number | null; unit?: string | null }[];
    steps?: { description: string }[];
  };

  const newVersion = currentRecipe.version + 1;

  await env.dramscript_db
    .prepare(`
      UPDATE recipes SET
        name = ?, type = ?, glass_type = ?, ice_type = ?, method = ?,
        garnish = ?, notes = ?, difficulty = ?, tags = ?, is_public = ?,
        want_to_make = ?, placeholder_icon = ?, servings = ?, version = ?,
        updated_at = strftime('%s', 'now')
      WHERE id = ? AND user_id = ?
    `)
    .bind(
      snapshot.name?.trim() || currentRecipe.name,
      snapshot.type ?? currentRecipe.type,
      snapshot.glass_type ?? null,
      snapshot.ice_type ?? null,
      snapshot.method ?? null,
      snapshot.garnish ?? null,
      snapshot.notes ?? null,
      snapshot.difficulty ?? null,
      JSON.stringify(snapshot.tags ?? []),
      snapshot.is_public ? 1 : 0,
      snapshot.want_to_make ? 1 : 0,
      snapshot.placeholder_icon ?? null,
      snapshot.servings ?? 1,
      newVersion,
      version.recipe_id,
      auth.user_id,
    )
    .run();

  await env.dramscript_db.prepare('DELETE FROM ingredients WHERE recipe_id = ?').bind(version.recipe_id).run();
  await env.dramscript_db.prepare('DELETE FROM steps WHERE recipe_id = ?').bind(version.recipe_id).run();

  if (snapshot.ingredients?.length) await insertIngredients(env, version.recipe_id, snapshot.ingredients);
  if (snapshot.steps?.length) await insertSteps(env, version.recipe_id, snapshot.steps);

  return json({ ok: true, version: newVersion });
}

export async function getRiff(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const source = await env.dramscript_db
    .prepare('SELECT * FROM recipes WHERE id = ? AND (user_id = ? OR is_public = 1)')
    .bind(id, auth.user_id)
    .first<DbRow>();

  if (!source) return notFound();

  const [ingredients, steps] = await Promise.all([
    env.dramscript_db.prepare('SELECT * FROM ingredients WHERE recipe_id = ? ORDER BY order_index').bind(id).all(),
    env.dramscript_db.prepare('SELECT * FROM steps WHERE recipe_id = ? ORDER BY order_index').bind(id).all(),
  ]);

  return json({
    prefill: {
      ...source,
      id: undefined,
      source_recipe_id: id,
      version: 1,
      is_public: 0,
      want_to_make: 1,
      placeholder_icon: null,
      tags: source.tags ? JSON.parse(source.tags as string) : [],
      ingredients: ingredients.results,
      steps: steps.results,
    },
  });
}

/**
 * Search public recipes across all users
 * GET /api/recipes/public/search?q=...&type=...&difficulty=...&limit=20
 * Also respects friend visibility if authenticated
 */
export async function searchPublicRecipes(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  const type = url.searchParams.get('type');
  const difficulty = url.searchParams.get('difficulty');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

  // Fetch user's friends to filter visibility
  const friendsResult = await env.dramscript_db
    .prepare(
      `
      SELECT DISTINCT
        CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END AS friend_id
      FROM friendships
      WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
      `
    )
    .bind(auth.user_id, auth.user_id, auth.user_id)
    .all<DbRow>();

  const friendIds = friendsResult.results.map((r) => r.friend_id as string);

  let query = `
    SELECT r.*,
           ri.r2_key AS primary_image,
           u.display_name, u.avatar_url
    FROM recipes r
    LEFT JOIN recipe_images ri ON ri.recipe_id = r.id AND ri.is_primary = 1
    JOIN users u ON u.id = r.user_id
    WHERE 
      (r.visibility = 'public'${friendIds.length > 0
        ? ` OR (r.visibility = 'friends' AND r.user_id IN (${friendIds.map(() => '?').join(',')}))`
        : ''}
      )
      AND r.user_id != ?
  `;
  const params: unknown[] = [...friendIds, auth.user_id];

  if (type) { query += ' AND r.type = ?'; params.push(type); }
  if (difficulty) { query += ' AND r.difficulty = ?'; params.push(difficulty); }

  if (q) {
    const terms = expandSearchTerms(q);
    const termClauses = terms
      .map(() => `(
        ${sqlFold('r.name')} LIKE ?
        OR ${sqlFold('r.notes')} LIKE ?
        OR EXISTS (
          SELECT 1 FROM ingredients i
          WHERE i.recipe_id = r.id
            AND ${sqlFold('i.name')} LIKE ?
        )
      )`)
      .join(' OR ');
    query += ` AND (${termClauses})`;
    for (const term of terms) {
      const like = `%${term}%`;
      params.push(like, like, like);
    }
  }

  query += ' ORDER BY r.updated_at DESC LIMIT ?';
  params.push(limit);

  const result = await env.dramscript_db.prepare(query).bind(...params).all<DbRow>();
  const recipes = result.results.map((r) => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags as string) : [],
  }));

  return json({ recipes });
}
