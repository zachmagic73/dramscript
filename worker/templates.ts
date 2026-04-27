import type { Env } from './types';
import { requireAuth, json, notFound } from './middleware';

type DbRow = Record<string, unknown>;

export async function listTemplates(_request: Request, env: Env): Promise<Response> {
  const templates = await env.dramscript_db
    .prepare(`
      SELECT
        t.id, t.name, t.description, t.base_type,
        COUNT(r.id) AS riff_count,
        ROUND(AVG(rr.rating), 1) AS avg_rating
      FROM recipe_templates t
      LEFT JOIN recipes r ON r.template_id = t.id AND r.is_public = 1
      LEFT JOIN recipe_ratings rr ON rr.recipe_id = r.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `)
    .all<DbRow>();

  return json({ templates: templates.results });
}

export async function getTemplate(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const template = await env.dramscript_db
    .prepare('SELECT * FROM recipe_templates WHERE id = ?')
    .bind(id)
    .first<DbRow & { canonical_json: string | null }>();

  if (!template) return notFound();

  // Public riffs for this template
  const riffs = await env.dramscript_db
    .prepare(`
      SELECT r.id, r.name, r.user_id, r.tags, r.difficulty,
             u.display_name AS author_name, u.avatar_url AS author_avatar,
             AVG(rr.rating) AS avg_rating, COUNT(rr.id) AS rating_count
      FROM recipes r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN recipe_ratings rr ON rr.recipe_id = r.id
      WHERE r.template_id = ? AND r.is_public = 1
      GROUP BY r.id
      ORDER BY avg_rating DESC, r.updated_at DESC
      LIMIT 50
    `)
    .bind(id)
    .all<DbRow>();

  const canonical = template.canonical_json
    ? JSON.parse(template.canonical_json)
    : null;

  return json({
    template: {
      ...template,
      canonical_json: undefined,
      canonical,
    },
    riffs: riffs.results.map((r) => ({
      ...r,
      tags: r.tags ? JSON.parse(r.tags as string) : [],
    })),
  });
}

export async function startFromTemplate(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const template = await env.dramscript_db
    .prepare('SELECT * FROM recipe_templates WHERE id = ?')
    .bind(id)
    .first<DbRow & { canonical_json: string | null; name: string }>();

  if (!template) return notFound();

  const canonical = template.canonical_json
    ? JSON.parse(template.canonical_json)
    : {};

  return json({
    prefill: {
      name: `My ${template.name}`,
      type: template.base_type ?? 'cocktail',
      template_id: id,
      ...canonical,
      // Always start fresh
      id: undefined,
      source_recipe_id: null,
      is_public: 0,
      want_to_make: 0,
      version: 1,
    },
  });
}
