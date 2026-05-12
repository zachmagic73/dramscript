# dramscript - AI Coding Guidelines

## What This Is
A cocktail journal app for logging original recipes, creating riffs, and managing template-driven workflows.

## Tech Stack
- React 19 + TypeScript + Vite frontend
- Cloudflare Workers backend
- Cloudflare D1 for relational data
- Cloudflare KV for sessions
- Cloudflare R2 for image storage
- Material UI + Emotion for UI
- Tesseract.js for OCR-assisted import workflows

## Architecture Rules
- Frontend code lives in `src/`; API and auth logic lives in `worker/`.
- Never move secrets or token exchange logic into frontend code.
- Keep Worker routes as the source of truth for auth, data access, and image operations.
- Preserve typed boundaries between UI models and API payloads.

## Security Requirements
- Never commit `.env`, `.dev.vars`, OAuth secrets, or API tokens.
- Keep Google OAuth secrets in Wrangler secrets only.
- Use HttpOnly, Secure, SameSite cookies for sessions.
- Validate user input at API boundaries before database writes.
- Enforce ownership checks for recipe/image read-write operations.

## Data and Storage Guidance
- D1 schema files are contracts; update migrations and docs together.
- Keep seed data deterministic and idempotent where possible.
- R2 object keys should be stable and scoped per user/resource.
- Do not bypass Worker image endpoints with direct public bucket exposure.

## Clean Code Guidance
- Keep business logic out of React view components.
- Prefer small reusable hooks/components over large multi-purpose files.
- Use descriptive TypeScript types and narrow unions for state transitions.
- Keep drag-and-drop and OCR flows isolated behind helper modules.

## Performance Guidance
- Avoid unnecessary re-renders in large recipe editors.
- Lazy-load expensive features (OCR/import flows) where practical.
- Minimize over-fetching from Worker endpoints.
- Use pagination or chunking for large user datasets.

## Validation and Tooling
- Run `npm run lint` before finalizing changes.
- Run `npm run build` for type-check and production build validation.
- Regenerate Worker types with `npm run cf-typegen` when bindings change.
- For remote D1 migrations, use non-interactive commands with `--yes`.

## Domain Notes
- Keep recipe version history behavior intact.
- Preserve riff creation workflows and template integrity.
- When editing upload logic, verify create, replace, and delete paths together.
