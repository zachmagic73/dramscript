import type { Env } from './types';
import { requireAuth, json, notFound } from './middleware';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PRESIGNED_URL_TTL_SECONDS = 300;

const encoder = new TextEncoder();

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

type PresignResult = {
  method: 'PUT';
  upload_url: string;
  r2_key: string;
  headers: Record<string, string>;
  expires_in: number;
};

type FinalizeRequest = {
  r2_key?: string;
};

type PresignRequest = {
  content_type?: string;
  size?: number;
};

type R2SigningConfig = {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function getR2SigningConfig(env: Env): R2SigningConfig | null {
  const accountId = env.R2_ACCOUNT_ID;
  const bucketName = env.R2_BUCKET_NAME;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) return null;

  return { accountId, bucketName, accessKeyId, secretAccessKey };
}

function getMissingR2Config(env: Env): string[] {
  const missing: string[] = [];
  if (!env.R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!env.R2_BUCKET_NAME) missing.push('R2_BUCKET_NAME');
  if (!env.R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!env.R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  return missing;
}

function encodeUriSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildCanonicalUri(r2Key: string): string {
  return `/${r2Key.split('/').map((s) => encodeUriSegment(s)).join('/')}`;
}

function toAmzDate(now: Date): { date: string; dateTime: string } {
  const iso = now.toISOString();
  const date = iso.slice(0, 10).replace(/-/g, '');
  const time = iso.slice(11, 19).replace(/:/g, '');
  return {
    date,
    dateTime: `${date}T${time}Z`,
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return toHex(new Uint8Array(digest));
}

async function hmacSha256(key: Uint8Array | string, value: string): Promise<Uint8Array> {
  const rawKey = typeof key === 'string' ? encoder.encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value));
  return new Uint8Array(sig);
}

async function getSigningKey(secretAccessKey: string, date: string): Promise<Uint8Array> {
  const kDate = await hmacSha256(`AWS4${secretAccessKey}`, date);
  const kRegion = await hmacSha256(kDate, 'auto');
  const kService = await hmacSha256(kRegion, 's3');
  return hmacSha256(kService, 'aws4_request');
}

async function buildPresignedPutUrl(
  config: R2SigningConfig,
  r2Key: string,
  expiresIn: number,
): Promise<string> {
  const now = new Date();
  const { date, dateTime } = toAmzDate(now);
  const host = `${config.bucketName}.${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = buildCanonicalUri(r2Key);
  const signedHeaders = 'host';
  const credentialScope = `${date}/auto/s3/aws4_request`;
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': dateTime,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  });

  const canonicalQuery = [...query.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeUriSegment(k)}=${encodeUriSegment(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await getSigningKey(config.secretAccessKey, date);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  query.set('X-Amz-Signature', signature);
  return `https://${host}${canonicalUri}?${query.toString()}`;
}

async function ensureOwnedRecipe(request: Request, env: Env, recipeId: string): Promise<{ user_id: string } | Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const recipe = await env.dramscript_db
    .prepare('SELECT id FROM recipes WHERE id = ? AND user_id = ?')
    .bind(recipeId, auth.user_id)
    .first();

  if (!recipe) return notFound();
  return auth;
}

async function createRecipeImageRecord(env: Env, recipeId: string, r2Key: string) {
  const existingImage = await env.dramscript_db
    .prepare('SELECT id, recipe_id, r2_key, is_primary, created_at FROM recipe_images WHERE r2_key = ?')
    .bind(r2Key)
    .first<{ id: string; recipe_id: string; r2_key: string; is_primary: number; created_at: number }>();

  if (existingImage) {
    return existingImage;
  }

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

  const inserted = await env.dramscript_db
    .prepare('SELECT id, recipe_id, r2_key, is_primary, created_at FROM recipe_images WHERE id = ?')
    .bind(imageId)
    .first<{ id: string; recipe_id: string; r2_key: string; is_primary: number; created_at: number }>();

  if (!inserted) {
    throw new Error('Failed to persist uploaded image metadata');
  }

  return inserted;
}

export async function presignImageUpload(request: Request, env: Env, recipeId: string): Promise<Response> {
  const auth = await ensureOwnedRecipe(request, env, recipeId);
  if (auth instanceof Response) return auth;

  const cfg = getR2SigningConfig(env);
  if (!cfg) {
    const missing = getMissingR2Config(env);
    return json({ error: `R2 presign is not configured. Missing: ${missing.join(', ')}` }, 500);
  }

  let body: PresignRequest;
  try {
    body = await request.json() as PresignRequest;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const mimeType = (body.content_type ?? '').split(';')[0].trim();
  if (!ALLOWED_CONTENT_TYPES.has(mimeType)) {
    return json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' }, 400);
  }

  if (typeof body.size !== 'number' || !Number.isFinite(body.size) || body.size <= 0) {
    return json({ error: 'Image size is required.' }, 400);
  }

  if (body.size > MAX_IMAGE_SIZE) {
    return json({ error: 'Image too large. Maximum size is 10 MB.' }, 400);
  }

  const ext = CONTENT_TYPE_EXTENSIONS[mimeType] ?? 'jpg';
  const r2Key = `recipes/${recipeId}/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await buildPresignedPutUrl(cfg, r2Key, PRESIGNED_URL_TTL_SECONDS);

  const result: PresignResult = {
    method: 'PUT',
    upload_url: uploadUrl,
    r2_key: r2Key,
    headers: { 'Content-Type': mimeType },
    expires_in: PRESIGNED_URL_TTL_SECONDS,
  };

  return json(result, 201);
}

export async function uploadImageViaWorker(request: Request, env: Env, recipeId: string): Promise<Response> {
  const auth = await ensureOwnedRecipe(request, env, recipeId);
  if (auth instanceof Response) return auth;

  const contentType = request.headers.get('Content-Type') ?? '';
  const mimeType = contentType.split(';')[0].trim();
  if (!ALLOWED_CONTENT_TYPES.has(mimeType)) {
    return json({ error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' }, 400);
  }

  const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10);
  if (contentLength > MAX_IMAGE_SIZE) {
    return json({ error: 'Image too large. Maximum size is 10 MB.' }, 400);
  }

  const body = request.body;
  if (!body) return json({ error: 'No image data' }, 400);

  const ext = CONTENT_TYPE_EXTENSIONS[mimeType] ?? 'jpg';
  const r2Key = `recipes/${recipeId}/${crypto.randomUUID()}.${ext}`;

  await env.IMAGES.put(r2Key, body, {
    httpMetadata: { contentType: mimeType },
  });

  const image = await createRecipeImageRecord(env, recipeId, r2Key);
  return json(image, 201);
}

export async function finalizeImageUpload(request: Request, env: Env, recipeId: string): Promise<Response> {
  const auth = await ensureOwnedRecipe(request, env, recipeId);
  if (auth instanceof Response) return auth;

  let body: FinalizeRequest;
  try {
    body = await request.json() as FinalizeRequest;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const r2Key = body.r2_key?.trim();
  if (!r2Key) return json({ error: 'r2_key is required' }, 400);
  if (!r2Key.startsWith(`recipes/${recipeId}/`)) {
    return json({ error: 'Invalid upload key for this recipe' }, 400);
  }

  const object = await env.IMAGES.head(r2Key);
  if (!object) {
    return json({ error: 'Upload not found in storage. Upload must complete before finalize.' }, 400);
  }

  const contentType = object.httpMetadata?.contentType ?? '';
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return json({ error: 'Invalid uploaded image type' }, 400);
  }

  const image = await createRecipeImageRecord(env, recipeId, r2Key);
  return json(image, 201);
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
