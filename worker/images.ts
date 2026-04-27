import type { Env } from './types';
import { requireAuth, json, notFound } from './middleware';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function uploadImage(request: Request, env: Env, recipeId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // Verify recipe ownership
  const recipe = await env.dramscript_db
    .prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
    .bind(recipeId, auth.user_id)
    .first();

  if (!recipe) return notFound();

  // Validate content type
  const contentType = request.headers.get('Content-Type') ?? '';
  const mimeType = contentType.split(';')[0].trim();
  if (!ALLOWED_CONTENT_TYPES.has(mimeType)) {
    return json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' }, 400);
  }

  // Check content length
  const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10);
  if (contentLength > MAX_IMAGE_SIZE) {
    return json({ error: 'Image too large. Maximum size is 10 MB.' }, 400);
  }

  const ext = mimeType.split('/')[1] ?? 'jpg';
  const r2Key = `recipes/${recipeId}/${crypto.randomUUID()}.${ext}`;

  // Stream body to R2
  const body = request.body;
  if (!body) return json({ error: 'No image data' }, 400);

  await env.IMAGES.put(r2Key, body, {
    httpMetadata: { contentType: mimeType },
  });

  // Check if this should be the primary image
  const existing = await env.dramscript_db
    .prepare('SELECT COUNT(*) as count FROM recipe_images WHERE recipe_id = ?')
    .bind(recipeId)
    .first<{ count: number }>();

  const isPrimary = !existing || existing.count === 0 ? 1 : 0;
  const imageId = crypto.randomUUID();

  await env.dramscript_db
    .prepare('INSERT INTO recipe_images (id, recipe_id, r2_key, is_primary) VALUES (?, ?, ?, ?)')
    .bind(imageId, recipeId, r2Key, isPrimary)
    .run();

  return json({ id: imageId, r2_key: r2Key, is_primary: isPrimary }, 201);
}

export async function serveImage(_request: Request, env: Env, r2Key: string): Promise<Response> {
  const obj = await env.IMAGES.get(r2Key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(obj.body, { headers });
}

export async function deleteImage(request: Request, env: Env, recipeId: string, imageId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const image = await env.dramscript_db
    .prepare(`
      SELECT ri.* FROM recipe_images ri
      JOIN recipes r ON r.id = ri.recipe_id
      WHERE ri.id = ? AND ri.recipe_id = ? AND r.user_id = ?
    `)
    .bind(imageId, recipeId, auth.user_id)
    .first<{ r2_key: string; is_primary: number }>();

  if (!image) return notFound();

  // Delete from R2
  await env.IMAGES.delete(image.r2_key);

  // Delete from D1
  await env.dramscript_db
    .prepare('DELETE FROM recipe_images WHERE id = ?')
    .bind(imageId)
    .run();

  // If this was primary, promote the next image
  if (image.is_primary) {
    const next = await env.dramscript_db
      .prepare('SELECT id FROM recipe_images WHERE recipe_id = ? ORDER BY created_at ASC LIMIT 1')
      .bind(recipeId)
      .first<{ id: string }>();

    if (next) {
      await env.dramscript_db
        .prepare('UPDATE recipe_images SET is_primary = 1 WHERE id = ?')
        .bind(next.id)
        .run();
    }
  }

  return json({ ok: true });
}

export async function setPrimaryImage(request: Request, env: Env, recipeId: string, imageId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // Verify ownership
  const image = await env.dramscript_db
    .prepare(`
      SELECT ri.id FROM recipe_images ri
      JOIN recipes r ON r.id = ri.recipe_id
      WHERE ri.id = ? AND ri.recipe_id = ? AND r.user_id = ?
    `)
    .bind(imageId, recipeId, auth.user_id)
    .first();

  if (!image) return notFound();

  // Clear existing primary, set new one
  await env.dramscript_db
    .prepare('UPDATE recipe_images SET is_primary = 0 WHERE recipe_id = ?')
    .bind(recipeId)
    .run();

  await env.dramscript_db
    .prepare('UPDATE recipe_images SET is_primary = 1 WHERE id = ?')
    .bind(imageId)
    .run();

  return json({ ok: true });
}
