import type { Env } from './types';
import { requireAuth, json, badRequest } from './middleware';

type DbRow = Record<string, unknown>;

// ─── Web Push / VAPID helpers ─────────────────────────────────────────────────

/** base64url → Uint8Array */
function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** Uint8Array | ArrayBuffer → base64url */
function b64urlEncode(input: ArrayBuffer | Uint8Array): string {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Concat multiple ArrayBuffers into one */
function concat(...bufs: Uint8Array[]): Uint8Array {
  const len = bufs.reduce((n, b) => n + b.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  for (const b of bufs) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

/**
 * Build a minimal VAPID JWT (ES256) for Web Push authorization.
 * The VAPID private key is a raw 32-byte P-256 scalar in base64url.
 * We need to import it as JWK (d + x + y from the public key).
 */
async function buildVapidJwt(
  audience: string,
  vapidPublicKeyB64url: string,
  vapidPrivateKeyB64url: string,
  subject: string,
): Promise<string> {
  // Header + Claims
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })) as unknown as ArrayBuffer);
  const now = Math.floor(Date.now() / 1000);
  const claims = b64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + 12 * 3600, sub: subject }),
    ) as unknown as ArrayBuffer,
  );
  const sigInput = new TextEncoder().encode(`${header}.${claims}`);

  // Import private key via JWK — derive x,y from the public key raw bytes
  const pubBytes = b64urlDecode(vapidPublicKeyB64url);
  // pubBytes[0] = 0x04 (uncompressed), x = [1..32], y = [33..64]
  const x = b64urlEncode(pubBytes.slice(1, 33).buffer);
  const y = b64urlEncode(pubBytes.slice(33, 65).buffer);

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: vapidPrivateKeyB64url,
      x,
      y,
      key_ops: ['sign'],
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const sigBuf = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, sigInput);
  return `${header}.${claims}.${b64urlEncode(sigBuf)}`;
}

/**
 * Encrypt a push message payload using the Web Push encryption scheme
 * (RFC 8291 / draft-ietf-httpbis-encryption-encoding-09 "aes128gcm").
 */
async function encryptPayload(
  payload: string,
  clientPublicKeyB64url: string,   // subscriber p256dh
  authB64url: string,               // subscriber auth
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const enc = new TextEncoder();

  // 1. Generate a new ECDH key pair (server ephemeral)
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  ) as CryptoKeyPair;
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey) as ArrayBuffer,
  );

  // 2. Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    'raw',
    b64urlDecode(clientPublicKeyB64url),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // 3. Derive shared ECDH secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      // CF workers-types uses $public (reserved keyword workaround)
      { name: 'ECDH', $public: clientPublicKey } as { name: string; $public: CryptoKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  // 4. Generate random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. Derive pseudo-random key (PRK) using HKDF-SHA-256
  const authSecret = b64urlDecode(authB64url);

  const prkKeyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
    'deriveBits',
  ]);
  const authInfo = concat(enc.encode('WebPush: info\0'), b64urlDecode(clientPublicKeyB64url), serverPublicKeyRaw);
  const ikm = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo } as { name: string; hash: string; salt: Uint8Array; info: Uint8Array },
      prkKeyMaterial,
      256,
    ),
  );

  // 6. Derive content encryption key (CEK) and nonce
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const keyInfo = enc.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = enc.encode('Content-Encoding: nonce\0');

  const cek = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: keyInfo } as { name: string; hash: string; salt: Uint8Array; info: Uint8Array }, ikmKey, 128),
  );
  const nonce = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo } as { name: string; hash: string; salt: Uint8Array; info: Uint8Array }, ikmKey, 96),
  );

  // 7. AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const payloadBytes = enc.encode(payload);
  // Padding: 2-byte big-endian padding length + 0x02 record delimiter
  const paddedPayload = concat(payloadBytes, new Uint8Array([2]));

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload),
  );

  return { ciphertext: encrypted, salt, serverPublicKey: serverPublicKeyRaw };
}

/**
 * Send a Web Push message to a subscription using VAPID authentication.
 * Returns true on success, false if the subscription is gone (410/404).
 * Throws on unexpected errors.
 */
async function sendWebPush(
  endpoint: string,
  p256dhB64url: string,
  authB64url: string,
  payload: Record<string, unknown>,
  vapidPublicKeyB64url: string,
  vapidPrivateKeyB64url: string,
): Promise<boolean> {
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const jwt = await buildVapidJwt(audience, vapidPublicKeyB64url, vapidPrivateKeyB64url, 'mailto:admin@dramscript.app');
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    JSON.stringify(payload),
    p256dhB64url,
    authB64url,
  );

  // Build aes128gcm content-encoding header (RFC 8291 §2)
  // salt (16) + rs (4, big-endian, 4096) + keylen (1) + serverPublicKey (65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const header = concat(salt, rs, new Uint8Array([serverPublicKey.length]), serverPublicKey);
  const body = concat(header, ciphertext);

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      Authorization: `vapid t=${jwt},k=${vapidPublicKeyB64url}`,
    },
    body,
  });

  if (resp.status === 201 || resp.status === 200) return true;
  if (resp.status === 404 || resp.status === 410) return false; // subscription expired

  const text = await resp.text().catch(() => resp.statusText);
  throw new Error(`Push delivery failed: HTTP ${resp.status} — ${text}`);
}

/**
 * Subscribe a device to push notifications
 * POST /api/notifications/subscribe
 * {
 *   "endpoint": "https://...",
 *   "auth_key": "...",
 *   "p256dh_key": "...",
 *   "userAgent": "..."
 * }
 */
export async function subscribeToPushNotifications(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as {
    endpoint?: string;
    auth_key?: string;
    p256dh_key?: string;
    userAgent?: string;
  };

  const { endpoint, auth_key, p256dh_key, userAgent } = body;

  if (!endpoint || !auth_key || !p256dh_key) {
    return badRequest('endpoint, auth_key, and p256dh_key are required');
  }

  const subscriptionId = crypto.randomUUID();

  try {
    await env.dramscript_db
      .prepare(
        `
        INSERT INTO push_subscriptions (id, user_id, endpoint, auth_key, p256dh_key, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (endpoint) DO UPDATE SET
          auth_key = excluded.auth_key,
          p256dh_key = excluded.p256dh_key,
          user_agent = excluded.user_agent,
          subscribed_at = strftime('%s', 'now')
        `,
      )
      .bind(subscriptionId, auth.user_id, endpoint, auth_key, p256dh_key, userAgent || null)
      .run();

    return json({ id: subscriptionId, subscribed: true }, 201);
  } catch (err) {
    console.error('Failed to subscribe to push notifications:', err);
    return badRequest('Failed to subscribe to push notifications');
  }
}

/**
 * Unsubscribe from push notifications
 * POST /api/notifications/unsubscribe
 * { "endpoint": "https://..." }
 */
export async function unsubscribeFromPushNotifications(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as { endpoint?: string };
  const { endpoint } = body;

  if (!endpoint) {
    return badRequest('endpoint is required');
  }

  const result = await env.dramscript_db
    .prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
    .bind(auth.user_id, endpoint)
    .run();

  return json({ deleted: result.meta.changes > 0 });
}

/**
 * Get list of current push subscriptions for authenticated user
 * GET /api/notifications/subscriptions
 */
export async function getPushSubscriptions(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const result = await env.dramscript_db
    .prepare('SELECT id, endpoint, user_agent, subscribed_at FROM push_subscriptions WHERE user_id = ?')
    .bind(auth.user_id)
    .all<DbRow>();

  return json({ subscriptions: result.results });
}

/**
 * Get notifications for authenticated user
 * GET /api/notifications?limit=20&unread_only=false
 */
export async function getUserNotifications(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
  const unreadOnly = url.searchParams.get('unread_only') === 'true';

  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const params: unknown[] = [auth.user_id];

  if (unreadOnly) {
    query += ' AND read_at IS NULL';
  }

  query += ' ORDER BY sent_at DESC LIMIT ?';
  params.push(limit);

  const result = await env.dramscript_db
    .prepare(query)
    .bind(...params)
    .all<DbRow>();

  return json({ notifications: result.results });
}

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
export async function markNotificationAsRead(
  request: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // Verify the notification belongs to the user
  const notif = await env.dramscript_db
    .prepare('SELECT id, user_id FROM notifications WHERE id = ?')
    .bind(id)
    .first<DbRow>();

  if (!notif || notif.user_id !== auth.user_id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.dramscript_db
    .prepare('UPDATE notifications SET read_at = strftime("%s", "now") WHERE id = ?')
    .bind(id)
    .run();

  return json({ id, read: true });
}

/**
 * Internal function: Send a push notification to a user's devices
 * Called by other endpoints (e.g., when a friend request is created)
 */
export async function sendPushNotificationToUser(
  env: Env,
  userId: string,
  options: {
    type: string;
    title: string;
    body: string;
    tag?: string;
    icon?: string;
    badge?: string;
    data?: Record<string, string>;
    relatedUserId?: string;
  },
): Promise<void> {
  // 1. Save notification to DB (audit trail)
  const notificationId = crypto.randomUUID();
  await env.dramscript_db
    .prepare(
      `
      INSERT INTO notifications 
      (id, user_id, type, title, body, tag, icon_url, badge_url, related_user_id, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      notificationId,
      userId,
      options.type,
      options.title,
      options.body,
      options.tag || null,
      options.icon || null,
      options.badge || null,
      options.relatedUserId || null,
      options.data ? JSON.stringify(options.data) : null,
    )
    .run();

  // 2. Get all subscriptions for this user
  const subscriptions = await env.dramscript_db
    .prepare('SELECT endpoint, auth_key, p256dh_key FROM push_subscriptions WHERE user_id = ?')
    .bind(userId)
    .all<DbRow>();

  if (subscriptions.results.length === 0) {
    console.log(`No push subscriptions found for user ${userId}`);
    return;
  }

  // 3. Send to each subscription
  const payload = {
    title: options.title,
    body: options.body,
    tag: options.tag || options.type,
    icon: options.icon || '/favicon.svg',
    badge: options.badge || '/favicon.svg',
    data: options.data || {},
  };

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured — push notification delivery skipped');
    return;
  }

  const expiredEndpoints: string[] = [];

  for (const sub of subscriptions.results) {
    try {
      const delivered = await sendWebPush(
        sub.endpoint as string,
        sub.p256dh_key as string,
        sub.auth_key as string,
        payload,
        env.VAPID_PUBLIC_KEY,
        env.VAPID_PRIVATE_KEY,
      );
      if (!delivered) {
        expiredEndpoints.push(sub.endpoint as string);
      }
    } catch (err) {
      console.error(`Failed to send push to ${sub.endpoint}:`, err);
    }
  }

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    for (const endpoint of expiredEndpoints) {
      await env.dramscript_db
        .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
        .bind(endpoint)
        .run();
    }
    console.log(`Removed ${expiredEndpoints.length} expired push subscription(s)`);
  }
}
