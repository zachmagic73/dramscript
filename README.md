# Dramscript

A cocktail journal app for logging original recipes, building riffs, and starting from classic templates.

## Stack

- React 19 + TypeScript + Vite
- MUI v6 UI theme
- Cloudflare Workers (API + asset serving)
- Cloudflare D1 (SQLite) for app data
- Cloudflare KV for session storage
- Cloudflare R2 for recipe images
- Google OAuth 2.0 authentication

## Features

- Google sign-in with secure HttpOnly session cookies
- Recipe CRUD with ingredients and method steps
- Version history snapshots for edits
- Riff workflow from existing recipes
- Template browser and start-from-template flow
- Image upload, delete, and primary image selection
- User profile settings (display name, default units)

## Repository Layout

- `src/`: React frontend
- `worker/`: Cloudflare Worker API routes and handlers
- `schema.sql`: D1 schema
- `seed-templates.sql`: Classic recipe template seed data
- `wrangler.jsonc`: Cloudflare bindings/config

## Prerequisites

- Node.js 20+
- npm 10+
- Wrangler CLI (via local devDependency: `npx wrangler ...`)
- Cloudflare account with D1/KV/R2 access
- Google Cloud OAuth client (Web application)

## Cloudflare Resources

Configured bindings are in `wrangler.jsonc`:

- D1: `dramscript_db` -> `dramscript-db`
- KV: `SESSIONS`
- R2: `IMAGES` -> `dramscript-images`
- Static assets binding: `ASSETS` -> `dist/client`

## Environment Secrets

Set these Worker secrets before auth flows:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

PowerShell example:

```powershell
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
```

## Google OAuth Setup

Create a Google OAuth 2.0 Client ID of type Web application.

Add authorized redirect URIs for each environment you use:

- Local Worker dev example: `http://127.0.0.1:8787/auth/callback`
- Deployed Worker example: `https://<your-worker-domain>/auth/callback`

The app computes redirect URI from the request origin, so each active origin must be allowed in Google Console.

## Install

```bash
npm install
```

## Database Setup

Apply schema and seed templates locally:

```bash
npm run db:migrate:local
npm run db:seed:local
```

Apply schema and seed templates remotely:

```bash
npm run db:migrate:remote
npm run db:seed:remote
```

## Local Development

Frontend dev server:

```bash
npm run dev
```

Worker dev server:

```bash
npm run wrangler:dev
```

## Build and Deploy

Build frontend + type check:

```bash
npm run build
```

Deploy Worker + assets:

```bash
npm run deploy
```

## Scripts

- `npm run dev`: Start Vite dev server
- `npm run build`: Type-check and build frontend
- `npm run lint`: Run ESLint
- `npm run preview`: Build and preview locally
- `npm run deploy`: Build then deploy with Wrangler
- `npm run cf-typegen`: Regenerate `worker-configuration.d.ts`
- `npm run wrangler:dev`: Run local Worker dev server
- `npm run db:migrate:local`: Apply schema to local D1
- `npm run db:migrate:remote`: Apply schema to remote D1
- `npm run db:seed:local`: Seed templates into local D1
- `npm run db:seed:remote`: Seed templates into remote D1

## Notes

- Sessions are cookie-based (`HttpOnly`, `SameSite=Lax`, `Secure`).
- Images are served through Worker routes (`/api/images/:key`).
- Keep secrets in Wrangler secrets only; do not commit credentials.
