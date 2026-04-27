import type { Env } from './types';
import { requireAuth, json, notFound } from './middleware';

interface UpdateUserBody {
  display_name?: string;
  default_units?: 'oz' | 'ml';
}

export async function updateUser(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json() as UpdateUserBody;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (body.display_name !== undefined) {
    if (!body.display_name.trim()) return json({ error: 'Display name cannot be empty' }, 400);
    fields.push('display_name = ?');
    params.push(body.display_name.trim());
  }

  if (body.default_units !== undefined) {
    if (!['oz', 'ml'].includes(body.default_units)) return json({ error: 'Invalid unit' }, 400);
    fields.push('default_units = ?');
    params.push(body.default_units);
  }

  if (!fields.length) return json({ error: 'Nothing to update' }, 400);

  fields.push("updated_at = strftime('%s', 'now')");
  params.push(auth.user_id);

  await env.dramscript_db
    .prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...params)
    .run();

  const user = await env.dramscript_db
    .prepare('SELECT id, email, display_name, avatar_url, default_units, created_at FROM users WHERE id = ?')
    .bind(auth.user_id)
    .first();

  if (!user) return notFound();
  return json({ user });
}
