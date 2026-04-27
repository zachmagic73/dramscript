import type { Env, SessionData } from './types';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
}

export function parseCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [key, value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value ?? '');
  }
  return null;
}

function getRedirectUri(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/auth/callback`;
}

export async function handleGoogleLogin(request: Request): Promise<Response> {
  const authUrl = new URL(GOOGLE_OAUTH_URL);
  authUrl.searchParams.set('client_id', (request as Request & { _env: Env })._env?.GOOGLE_CLIENT_ID ?? '');
  return Response.redirect(authUrl.toString(), 302);
}

export async function initiateGoogleLogin(request: Request, env: Env): Promise<Response> {
  const redirectUri = getRedirectUri(request);
  const state = crypto.randomUUID();

  const authUrl = new URL(GOOGLE_OAUTH_URL);
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('access_type', 'online');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  return Response.redirect(authUrl.toString(), 302);
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return Response.redirect('/?auth_error=1', 302);
  }

  const redirectUri = getRedirectUri(request);

  // Exchange code for access token
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    console.error('[Auth] Token exchange failed:', await tokenRes.text());
    return Response.redirect('/?auth_error=1', 302);
  }

  const { access_token } = await tokenRes.json() as GoogleTokenResponse;

  // Fetch user info from Google
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return Response.redirect('/?auth_error=1', 302);
  }

  const googleUser = await userRes.json() as GoogleUserInfo;

  // Upsert user in D1
  const newId = crypto.randomUUID();
  await env.dramscript_db
    .prepare(`
      INSERT INTO users (id, google_id, email, display_name, avatar_url)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (google_id) DO UPDATE SET
        email        = excluded.email,
        display_name = excluded.display_name,
        avatar_url   = excluded.avatar_url,
        updated_at   = strftime('%s', 'now')
    `)
    .bind(newId, googleUser.sub, googleUser.email, googleUser.name, googleUser.picture)
    .run();

  // Resolve the actual user id (handles conflict case)
  const user = await env.dramscript_db
    .prepare('SELECT id FROM users WHERE google_id = ?')
    .bind(googleUser.sub)
    .first<{ id: string }>();

  if (!user) {
    return Response.redirect('/?auth_error=1', 302);
  }

  // Issue session token
  const token = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL;

  const sessionData: SessionData = {
    user_id: user.id,
    email: googleUser.email,
    expires_at: expiresAt,
  };

  await env.SESSIONS.put(`session:${token}`, JSON.stringify(sessionData), {
    expirationTtl: SESSION_TTL,
  });

  // Backup session in D1
  await env.dramscript_db
    .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, user.id, expiresAt)
    .run();

  const cookie = [
    `session=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${SESSION_TTL}`,
    'Path=/',
  ].join('; ');

  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': cookie },
  });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie') ?? '';
  const token = parseCookie(cookie, 'session');

  if (token) {
    await env.SESSIONS.delete(`session:${token}`);
    await env.dramscript_db
      .prepare('DELETE FROM sessions WHERE token = ?')
      .bind(token)
      .run();
  }

  const clearCookie = 'session=; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Path=/';
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearCookie,
    },
  });
}

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const cookie = request.headers.get('Cookie') ?? '';
  const token = parseCookie(cookie, 'session');

  if (!token) {
    return Response.json({ user: null });
  }

  const sessionJson = await env.SESSIONS.get(`session:${token}`);
  if (!sessionJson) {
    return Response.json({ user: null });
  }

  const session = JSON.parse(sessionJson) as SessionData;
  if (session.expires_at < Math.floor(Date.now() / 1000)) {
    return Response.json({ user: null });
  }

  const user = await env.dramscript_db
    .prepare('SELECT id, email, display_name, avatar_url, default_units, created_at FROM users WHERE id = ?')
    .bind(session.user_id)
    .first();

  return Response.json({ user: user ?? null });
}
