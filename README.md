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
- `R2_ACCESS_KEY_ID` (R2 API token access key)
- `R2_SECRET_ACCESS_KEY` (R2 API token secret)

Set these Worker vars in `wrangler.jsonc` (or equivalent env config):

- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`

PowerShell example:

```powershell
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

For local `wrangler dev`, also create a `.dev.vars` file (not committed) because local mode does not always use deployed Worker secrets.

Example:

```dotenv
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SESSION_SECRET=your-long-random-secret
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_BUCKET_NAME=your-r2-bucket-name
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
```

The image upload flow is presigned: the frontend asks the Worker for a short-lived upload URL, uploads directly to R2, then calls finalize to save metadata in D1.

When using presigned browser uploads, configure R2 CORS to allow your app origin(s) for `PUT` and `Content-Type` headers.

## Google OAuth Setup

Create a Google OAuth 2.0 Client ID of type Web application.

Add authorized redirect URIs for each environment you use:

- Local app example: `http://localhost:5188/auth/callback`
- Local worker example: `http://127.0.0.1:8795/auth/callback`
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
