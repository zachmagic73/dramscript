import type { Env } from './types';
import { initiateGoogleLogin, handleCallback, handleLogout, handleMe } from './auth';
import { updateUser } from './users';
import {
  listRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe,
  getRecipeVersions, getVersionSnapshot, getRiff, restoreVersion,
} from './recipes';
import { uploadImage, serveImage, deleteImage, setPrimaryImage } from './images';
import { listTemplates, getTemplate, startFromTemplate } from './templates';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // ── Auth ──────────────────────────────────────────────────────────────────
    if (pathname === '/auth/google'   && method === 'GET')  return initiateGoogleLogin(request, env);
    if (pathname === '/auth/callback' && method === 'GET')  return handleCallback(request, env);
    if (pathname === '/auth/logout'   && method === 'POST') return handleLogout(request, env);
    if (pathname === '/auth/me'       && method === 'GET')  return handleMe(request, env);

    // ── Users ─────────────────────────────────────────────────────────────────
    if (pathname === '/api/users/me' && method === 'PATCH') return updateUser(request, env);

    // ── Recipes ───────────────────────────────────────────────────────────────
    if (pathname === '/api/recipes' && method === 'GET')  return listRecipes(request, env);
    if (pathname === '/api/recipes' && method === 'POST') return createRecipe(request, env);

    // /api/recipes/:id
    const recipeMatch = pathname.match(/^\/api\/recipes\/([^/]+)$/);
    if (recipeMatch) {
      const [, id] = recipeMatch;
      if (method === 'GET')    return getRecipe(request, env, id);
      if (method === 'PATCH')  return updateRecipe(request, env, id);
      if (method === 'DELETE') return deleteRecipe(request, env, id);
    }

    // /api/recipes/:id/versions
    const versionsMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/versions$/);
    if (versionsMatch && method === 'GET') return getRecipeVersions(request, env, versionsMatch[1]);

    // /api/recipes/:id/riff
    const riffMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/riff$/);
    if (riffMatch && method === 'GET') return getRiff(request, env, riffMatch[1]);

    // /api/versions/:versionId (snapshot detail)
    const snapshotMatch = pathname.match(/^\/api\/versions\/([^/]+)$/);
    if (snapshotMatch && method === 'GET') return getVersionSnapshot(request, env, snapshotMatch[1]);
    if (snapshotMatch && method === 'POST') return restoreVersion(request, env, snapshotMatch[1]);

    // ── Images ────────────────────────────────────────────────────────────────
    // POST /api/recipes/:id/images  — upload (body is raw image)
    const uploadMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/images$/);
    if (uploadMatch && method === 'POST') return uploadImage(request, env, uploadMatch[1]);

    // /api/images/:r2key*  — serve image (key may contain slashes)
    if (pathname.startsWith('/api/images/') && method === 'GET') {
      const r2Key = decodeURIComponent(pathname.slice('/api/images/'.length));
      return serveImage(request, env, r2Key);
    }

    // DELETE /api/recipes/:recipeId/images/:imageId
    const deleteImageMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/images\/([^/]+)$/);
    if (deleteImageMatch && method === 'DELETE') {
      return deleteImage(request, env, deleteImageMatch[1], deleteImageMatch[2]);
    }

    // PATCH /api/recipes/:recipeId/images/:imageId/primary
    const primaryMatch = pathname.match(/^\/api\/recipes\/([^/]+)\/images\/([^/]+)\/primary$/);
    if (primaryMatch && method === 'PATCH') {
      return setPrimaryImage(request, env, primaryMatch[1], primaryMatch[2]);
    }

    // ── Templates ─────────────────────────────────────────────────────────────
    if (pathname === '/api/templates' && method === 'GET') return listTemplates(request, env);

    const templateMatch = pathname.match(/^\/api\/templates\/([^/]+)$/);
    if (templateMatch && method === 'GET') return getTemplate(request, env, templateMatch[1]);

    // /api/templates/:id/start
    const templateStartMatch = pathname.match(/^\/api\/templates\/([^/]+)\/start$/);
    if (templateStartMatch && method === 'GET') return startFromTemplate(request, env, templateStartMatch[1]);

    // ── SPA Fallback ──────────────────────────────────────────────────────────
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
