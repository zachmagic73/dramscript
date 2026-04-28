import type { Env } from './types';
import { requireAuth, json, badRequest } from './middleware';

type DbRow = Record<string, unknown>;

/**
 * Search users by display_name or email (case-insensitive)
 * GET /api/users/search?q=...&limit=10
 */
export async function searchUsers(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);

  if (!q || q.length < 2) {
    return badRequest('Search query must be at least 2 characters');
  }

  const result = await env.dramscript_db
    .prepare(
      `
      SELECT id, display_name, email, avatar_url
      FROM users
      WHERE (LOWER(display_name) LIKE ? OR LOWER(email) LIKE ?)
        AND id != ?
      LIMIT ?
      `,
    )
    .bind(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`, auth.user_id, limit)
    .all<DbRow>();

  return json({ users: result.results });
}

/**
 * Send a friend request
 * POST /api/friendships
 * { "addressee_id": "user_id" }
 */
export async function sendFriendRequest(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = (await request.json()) as { addressee_id?: string };
  const { addressee_id } = body;

  if (!addressee_id) {
    return badRequest('addressee_id is required');
  }

  if (addressee_id === auth.user_id) {
    return badRequest('Cannot send friend request to yourself');
  }

  // Check if addressee exists
  const addresseeResult = await env.dramscript_db
    .prepare('SELECT id FROM users WHERE id = ?')
    .bind(addressee_id)
    .first<DbRow>();

  if (!addresseeResult) {
    return badRequest('User not found');
  }

  // Check if friendship or request already exists
  const existingResult = await env.dramscript_db
    .prepare(
      `
      SELECT id, status
      FROM friendships
      WHERE (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)
      `,
    )
    .bind(auth.user_id, addressee_id, addressee_id, auth.user_id)
    .first<DbRow>();

  if (existingResult) {
    const status = existingResult.status as string;
    if (status === 'accepted') {
      return badRequest('You are already friends');
    }
    if (status === 'pending') {
      return badRequest('Friend request already pending');
    }
  }

  const friendshipId = crypto.randomUUID();
  await env.dramscript_db
    .prepare(
      `
      INSERT INTO friendships (id, requester_id, addressee_id, status, created_at)
      VALUES (?, ?, ?, 'pending', ?)
      `,
    )
    .bind(friendshipId, auth.user_id, addressee_id, Math.floor(Date.now() / 1000))
    .run();

  return json({ id: friendshipId, status: 'pending' }, 201);
}

/**
 * Accept a friend request
 * PATCH /api/friendships/:id/accept
 */
export async function acceptFriendRequest(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const friendship = await env.dramscript_db
    .prepare('SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?')
    .bind(id)
    .first<DbRow>();

  if (!friendship) {
    return badRequest('Friendship not found');
  }

  if (friendship.addressee_id !== auth.user_id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (friendship.status !== 'pending') {
    return badRequest(`Cannot accept friendship with status: ${friendship.status}`);
  }

  await env.dramscript_db
    .prepare('UPDATE friendships SET status = ? WHERE id = ?')
    .bind('accepted', id)
    .run();

  return json({ id, status: 'accepted' });
}

/**
 * Reject a friend request
 * PATCH /api/friendships/:id/reject
 */
export async function rejectFriendRequest(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const friendship = await env.dramscript_db
    .prepare('SELECT id, requester_id, addressee_id, status FROM friendships WHERE id = ?')
    .bind(id)
    .first<DbRow>();

  if (!friendship) {
    return badRequest('Friendship not found');
  }

  if (friendship.addressee_id !== auth.user_id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (friendship.status !== 'pending') {
    return badRequest(`Cannot reject friendship with status: ${friendship.status}`);
  }

  await env.dramscript_db
    .prepare('UPDATE friendships SET status = ? WHERE id = ?')
    .bind('rejected', id)
    .run();

  return json({ id, status: 'rejected' });
}

/**
 * List pending friend requests for the current user
 * GET /api/friendships/pending
 */
export async function listPendingFriendRequests(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const result = await env.dramscript_db
    .prepare(
      `
      SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
             u.display_name, u.avatar_url
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `,
    )
    .bind(auth.user_id)
    .all<DbRow>();

  return json({ friendRequests: result.results });
}

/**
 * List pending invites sent by the current user
 * GET /api/friendships/pending-sent
 */
export async function listPendingSentInvites(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const result = await env.dramscript_db
    .prepare(
      `
      SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
             u.display_name, u.avatar_url, u.email
      FROM friendships f
      JOIN users u ON u.id = f.addressee_id
      WHERE f.requester_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
      `,
    )
    .bind(auth.user_id)
    .all<DbRow>();

  return json({ invites: result.results });
}

/**
 * List accepted friendships for the current user
 * GET /api/friendships/accepted
 */
export async function listAcceptedFriendships(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const result = await env.dramscript_db
    .prepare(
      `
      SELECT f.id, f.requester_id, f.addressee_id, f.created_at,
             CASE
               WHEN f.requester_id = ? THEN f.addressee_id
               ELSE f.requester_id
             END AS friend_user_id,
             u.display_name, u.avatar_url, u.email
      FROM friendships f
      JOIN users u ON u.id = CASE
        WHEN f.requester_id = ? THEN f.addressee_id
        ELSE f.requester_id
      END
      WHERE (f.requester_id = ? OR f.addressee_id = ?)
        AND f.status = 'accepted'
      ORDER BY f.created_at DESC
      `,
    )
    .bind(auth.user_id, auth.user_id, auth.user_id, auth.user_id)
    .all<DbRow>();

  return json({ friends: result.results });
}

/**
 * Delete/unfriend a friendship
 * DELETE /api/friendships/:id
 */
export async function deleteFriendship(request: Request, env: Env, id: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const friendship = await env.dramscript_db
    .prepare('SELECT id, requester_id, addressee_id FROM friendships WHERE id = ?')
    .bind(id)
    .first<DbRow>();

  if (!friendship) {
    return badRequest('Friendship not found');
  }

  // Only requester or addressee can delete
  if (friendship.requester_id !== auth.user_id && friendship.addressee_id !== auth.user_id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.dramscript_db.prepare('DELETE FROM friendships WHERE id = ?').bind(id).run();

  return json({ deleted: true });
}
