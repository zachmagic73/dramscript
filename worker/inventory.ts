import type { Env } from './types';
import { requireAuth, json, notFound, badRequest } from './middleware';

// ── Inventory CRUD ────────────────────────────────────────────────────────────

export async function listInventory(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const rows = await env.dramscript_db
    .prepare(`
      SELECT id, name, category
      FROM user_ingredients
      WHERE user_id = ?
      ORDER BY category ASC, name ASC
    `)
    .bind(auth.user_id)
    .all();

  return json({ ingredients: rows.results });
}

export async function addInventoryItem(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  let body: { name?: string; category?: string } = {};
  try { body = await request.json() as typeof body; } catch { return badRequest('Invalid JSON'); }

  const name = (body.name ?? '').trim();
  if (!name) return badRequest('name is required');

  // Normalize to lowercase for consistent matching
  const normalizedName = name.toLowerCase();
  const category = (body.category ?? '').trim() || null;

  // Check for duplicate (case-insensitive, unique constraint is on exact match)
  const existing = await env.dramscript_db
    .prepare('SELECT id FROM user_ingredients WHERE user_id = ? AND LOWER(name) = ?')
    .bind(auth.user_id, normalizedName)
    .first<{ id: string }>();

  if (existing) {
    return json({ error: 'Ingredient already in inventory' }, 409);
  }

  const id = crypto.randomUUID();
  await env.dramscript_db
    .prepare('INSERT INTO user_ingredients (id, user_id, name, category) VALUES (?, ?, ?, ?)')
    .bind(id, auth.user_id, name, category)
    .run();

  return json({ ingredient: { id, name, category } }, 201);
}

export async function deleteInventoryItem(request: Request, env: Env, itemId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const row = await env.dramscript_db
    .prepare('SELECT id FROM user_ingredients WHERE id = ? AND user_id = ?')
    .bind(itemId, auth.user_id)
    .first<{ id: string }>();

  if (!row) return notFound();

  await env.dramscript_db
    .prepare('DELETE FROM user_ingredients WHERE id = ?')
    .bind(itemId)
    .run();

  return json({ ok: true });
}

// ── Ingredient Reference Search (autocomplete) ────────────────────────────────

export async function searchIngredientReference(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '15', 10), 50);

  if (!q) return json({ results: [] });

  const pattern = `%${q}%`;

  // Match on name, subcategory, or brand — order by exact prefix match first
  const rows = await env.dramscript_db
    .prepare(`
      SELECT id, name, category, subcategory, brand, region, flavor_notes, abv
      FROM ingredient_reference
      WHERE name LIKE ? OR subcategory LIKE ? OR brand LIKE ?
      ORDER BY
        CASE WHEN LOWER(name) LIKE LOWER(?) THEN 0 ELSE 1 END,
        name ASC
      LIMIT ?
    `)
    .bind(pattern, pattern, pattern, `${q.toLowerCase()}%`, limit)
    .all();

  return json({ results: rows.results });
}
