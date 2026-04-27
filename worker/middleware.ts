import type { Env, SessionData } from './types';
import { parseCookie } from './auth';

export type AuthResult = { user_id: string; email: string };

export async function requireAuth(
  request: Request,
  env: Env,
): Promise<AuthResult | Response> {
  const cookie = request.headers.get('Cookie') ?? '';
  const token = parseCookie(cookie, 'session');

  if (!token) return unauthorized();

  const sessionJson = await env.SESSIONS.get(`session:${token}`);
  if (!sessionJson) return unauthorized();

  const session = JSON.parse(sessionJson) as SessionData;
  if (session.expires_at < Math.floor(Date.now() / 1000)) return unauthorized();

  return { user_id: session.user_id, email: session.email };
}

function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401);
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function notFound(): Response {
  return json({ error: 'Not found' }, 404);
}
