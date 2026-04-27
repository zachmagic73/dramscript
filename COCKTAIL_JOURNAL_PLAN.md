# Draft And Drink — Project Plan

## Overview

**Draft And Drink** is a React/Vite web and mobile-friendly app for building a personal digital cocktail journal. Users log in via Google, create and manage cocktail recipes, and eventually discover and share recipes with a community.

Hosted entirely on Cloudflare's free tier, following the same architecture as **Toodoo** and **Mnemonica**.

---

## Tech Stack

### Core (same pattern as Toodoo/Mnemonica)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | SPA, mobile-responsive |
| UI Library | MUI v6 (Material UI) + custom theme | "The Speakeasy" dark theme |
| Hosting | Cloudflare Pages | Free tier, CDN-distributed |
| API | Cloudflare Workers | Serverless, free tier (100K req/day) |
| Database | Cloudflare D1 (SQLite) | Free tier (5 GB, 25M row reads/day) |
| Session Storage | Cloudflare KV | Fast session token lookups |
| Auth | Google OAuth 2.0 via Workers | No third-party auth vendor |
| Deployment | Wrangler CLI | Same workflow as existing projects |

### Additional Resources Needed

| Service | Use Case | Cost |
|---|---|---|
| **Cloudflare R2** | Recipe image uploads and storage | Free tier: 10 GB storage, 1M writes/mo |
| **Cloudflare Workers AI** | AI image-to-recipe parsing (Phase 11) | Free tier: 10K neurons/day |

Both are Cloudflare-native and fit within the free tier for an early-stage app. **No paid services are required through the first several phases.** The only potential cost trigger is R2 egress if image traffic becomes very high, which is unlikely early on. R2 also has no egress fees to the internet (unlike S3).

MUI adds minimal bundle overhead and gives consistent mobile-friendly components out of the box. The custom theme is defined once and applied globally — no inline styles.

### Auth Strategy

Google OAuth 2.0 implemented directly in a Cloudflare Worker:
1. Worker redirects user to Google's OAuth consent screen
2. Google redirects back with an auth code
3. Worker exchanges the code for an ID token (server-side, secret stays in Worker)
4. Worker verifies the JWT, creates/upserts a user row in D1
5. Worker issues a signed session token, stores it in KV with a TTL
6. Frontend stores the session token in an `httpOnly` cookie or `localStorage`

This keeps Google secrets out of the frontend. No third-party auth SDK required.

---

## Design System — The Speakeasy

Dark-mode-first. Evokes low-light cocktail lounges, leather seating, and amber spirits. All colors defined as MUI theme tokens — no magic strings in components.

### Color Palette

| Role | Name | Hex | Usage |
|---|---|---|---|
| **Background / default** | Midnight Obsidian | `#121212` | App background, page canvas |
| **Background / paper** | Dark Mahogany | `#1C1410` | Cards, modals, drawers |
| **Background / elevated** | Aged Mahogany | `#2A1A12` | Elevated cards, hover states, input fills |
| **Primary** | Burnished Gold | `#D4AF37` | CTAs (Save Recipe, Calculate Batch), active nav, links |
| **Primary dark** | Deep Amber | `#A8891A` | Pressed/hover state of primary buttons |
| **Primary light** | Pale Gold | `#E8CE6A` | Focus rings, chips, highlights |
| **Secondary** | Aged Mahogany | `#4B2C20` | Card borders, section dividers, subtle accents |
| **Secondary light** | Warm Cedar | `#6B3E2C` | Hover on secondary elements |
| **Text / primary** | Warm Parchment | `#F5E6CC` | Body text, headings |
| **Text / secondary** | Faded Linen | `#B8A48A` | Secondary labels, metadata, captions |
| **Text / disabled** | Dimmed Slate | `#6B5E52` | Disabled inputs, placeholder text |
| **Success** | Botanical Green | `#4A7C59` | Saved confirmation, ingredient match, form success |
| **Success light** | Spearmint | `#6AAF80` | Success text on dark backgrounds |
| **Error** | Bitter Crimson | `#C0392B` | Validation errors, delete confirmations, alerts |
| **Error light** | Rose Fade | `#E57373` | Error text on dark backgrounds |
| **Warning** | Charred Orange | `#D4622A` | Warnings, "missing ingredients" callouts |
| **Warning light** | Peach Smoke | `#E8925A` | Warning text on dark backgrounds |
| **Info** | Barrel Blue | `#3A6B8A` | Tips, informational banners, tooltips |
| **Info light** | Sky Rinse | `#64A8CC` | Info text on dark backgrounds |
| **Divider** | Worn Copper | `#3D2B1F` | `<Divider>` lines, table borders |
| **Surface overlay** | Smoke Glass | `rgba(212,175,55,0.08)` | Hover overlays, focus backgrounds |

### Typography

| Role | Font | Notes |
|---|---|---|
| **Display / headings** | `Playfair Display` | Serif — evokes vintage cocktail menus; use for H1–H3 |
| **Body / UI** | `Inter` | Clean, legible at small sizes; use for body, labels, buttons |
| **Monospace / amounts** | `JetBrains Mono` | Recipe amounts and measurements for clear reading |

All three are available free from Google Fonts.

### MUI Theme Definition

```tsx
// src/theme.ts
import { createTheme } from '@mui/material/styles';

const speakeasy = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',   // Midnight Obsidian
      paper: '#1C1410',     // Dark Mahogany (cards, modals)
    },
    primary: {
      main: '#D4AF37',      // Burnished Gold
      dark: '#A8891A',      // Deep Amber
      light: '#E8CE6A',     // Pale Gold
      contrastText: '#121212',
    },
    secondary: {
      main: '#4B2C20',      // Aged Mahogany
      light: '#6B3E2C',     // Warm Cedar
      contrastText: '#F5E6CC',
    },
    error: {
      main: '#C0392B',      // Bitter Crimson
      light: '#E57373',     // Rose Fade
      contrastText: '#F5E6CC',
    },
    warning: {
      main: '#D4622A',      // Charred Orange
      light: '#E8925A',     // Peach Smoke
      contrastText: '#121212',
    },
    info: {
      main: '#3A6B8A',      // Barrel Blue
      light: '#64A8CC',     // Sky Rinse
      contrastText: '#F5E6CC',
    },
    success: {
      main: '#4A7C59',      // Botanical Green
      light: '#6AAF80',     // Spearmint
      contrastText: '#F5E6CC',
    },
    text: {
      primary: '#F5E6CC',   // Warm Parchment
      secondary: '#B8A48A', // Faded Linen
      disabled: '#6B5E52',  // Dimmed Slate
    },
    divider: '#3D2B1F',     // Worn Copper
  },

  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    h1: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h2: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h3: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h5: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.02em' },
  },

  shape: {
    borderRadius: 8, // Slightly rounded; not pill-shaped, not sharp
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: '#121212' },
        // Ingredient amounts use monospace
        '.amount': { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875rem' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#1C1410',          // Dark Mahogany
          border: '1px solid #3D2B1F',         // Worn Copper border
          backgroundImage: 'none',
          '&:hover': {
            borderColor: '#D4AF37',             // Gold border on hover
            boxShadow: '0 0 0 1px #D4AF37',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          '&:hover': { backgroundColor: '#A8891A' },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          backgroundColor: '#2A1A12',           // Aged Mahogany fill
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
        colorPrimary: {
          backgroundColor: 'rgba(212,175,55,0.15)',
          color: '#E8CE6A',
          border: '1px solid rgba(212,175,55,0.3)',
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#3D2B1F' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1C1410',
          borderBottom: '1px solid #3D2B1F',
          backgroundImage: 'none',
          boxShadow: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#1C1410', borderRight: '1px solid #3D2B1F' },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#2A1A12',
          border: '1px solid #3D2B1F',
          color: '#F5E6CC',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
  },
});

export default speakeasy;
```

```tsx
// src/main.tsx — wrap app in ThemeProvider
import { ThemeProvider, CssBaseline } from '@mui/material';
import speakeasy from './theme';

root.render(
  <ThemeProvider theme={speakeasy}>
    <CssBaseline />
    <App />
  </ThemeProvider>
);
```

### Design Tokens Quick Reference

| Token | Value | When to use |
|---|---|---|
| `theme.palette.primary.main` | `#D4AF37` | Gold — buttons, links, active states |
| `theme.palette.background.default` | `#121212` | Page background |
| `theme.palette.background.paper` | `#1C1410` | Cards, modals |
| `theme.palette.text.primary` | `#F5E6CC` | All readable body text |
| `theme.palette.text.secondary` | `#B8A48A` | Metadata, timestamps, secondary labels |
| `theme.palette.divider` | `#3D2B1F` | Lines, borders |
| `theme.palette.success.main` | `#4A7C59` | Saved, available ingredient |
| `theme.palette.error.main` | `#C0392B` | Delete, validation error |
| `theme.palette.warning.main` | `#D4622A` | Missing ingredient, caution |
| `theme.palette.info.main` | `#3A6B8A` | Tips, help text |

---

## Development Commands (projected)

```sh
npm run dev              # Vite dev server (frontend)
npm run wrangler:dev     # Cloudflare Worker local dev
npm run build            # TypeScript + Vite production build
npm run deploy           # Build + wrangler deploy to Cloudflare Pages
npm run db:migrate:local # Apply schema to local D1
npm run db:migrate:remote # Apply schema to production D1
```

---

## Database Schema (D1 / SQLite)

```sql
-- Users (created/upserted on first Google login)
CREATE TABLE users (
  id            TEXT PRIMARY KEY,        -- UUID v4
  google_id     TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  default_units TEXT NOT NULL DEFAULT 'oz', -- 'oz' | 'ml' — user profile preference
  created_at    INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at    INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Sessions (stored here as backup; primary lookup in KV)
CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Recipes
CREATE TABLE recipes (
  id               TEXT PRIMARY KEY,   -- UUID v4
  user_id          TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,      -- 'cocktail' | 'syrup' | 'bitter' | 'tincture' | 'shrub' | 'batch' | 'other'
  glass_type       TEXT,
  ice_type         TEXT,               -- 'none' | 'cubed' | 'large_cube' | 'crushed' | 'cracked' | 'sphere'
  method           TEXT,               -- 'stirred' | 'shaken' | 'built' | 'blended' | 'batch' | 'thrown'
  garnish          TEXT,
  notes            TEXT,
  difficulty       TEXT,               -- 'easy' | 'medium' | 'hard'
  tags             TEXT,               -- JSON array e.g. ["citrusy","herbal","brunch","summer"]
  version          INTEGER DEFAULT 1,  -- increments on each save
  is_public        INTEGER DEFAULT 0,  -- 0 = private, 1 = public
  want_to_make     INTEGER DEFAULT 0,  -- flagged for shopping list generation
  template_id      TEXT,               -- riffed from a canonical recipe template
  source_recipe_id TEXT,               -- riffed from / duplicated from another user recipe
  servings         INTEGER DEFAULT 1,  -- for batch calculator
  created_at       INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at       INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (template_id) REFERENCES recipe_templates(id),
  FOREIGN KEY (source_recipe_id) REFERENCES recipes(id)
);

-- Recipe Ingredients
CREATE TABLE ingredients (
  id           TEXT PRIMARY KEY,
  recipe_id    TEXT NOT NULL,
  name         TEXT NOT NULL,
  amount       REAL,                   -- null = "to taste"
  unit         TEXT,                   -- 'oz' | 'ml' | 'dash' | 'barspoon' | 'tsp' | 'tbsp' | 'cup' | null
  order_index  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Recipe Steps
CREATE TABLE steps (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL,
  description TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Recipe Images (stored in R2)
CREATE TABLE recipe_images (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL,
  r2_key      TEXT NOT NULL UNIQUE,   -- R2 object key
  is_primary  INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Recipe Version Snapshots (written on every save after v1)
CREATE TABLE recipe_versions (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL,
  version     INTEGER NOT NULL,       -- matches recipes.version at time of snapshot
  snapshot    TEXT NOT NULL,          -- full recipe JSON (name, ingredients, steps, etc.)
  changed_at  INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Canonical Recipe Templates (e.g., "Negroni", "Old Fashioned")
CREATE TABLE recipe_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  base_type   TEXT                    -- same values as recipes.type
);

-- Friends System
CREATE TABLE friendships (
  id           TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'rejected' | 'blocked'
  created_at   INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (addressee_id) REFERENCES users(id)
);

-- Recipe Ratings
CREATE TABLE recipe_ratings (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (recipe_id, user_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Comments
CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User Ingredient Inventory (for "what can I make" feature)
CREATE TABLE user_ingredients (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,           -- normalize to lowercase
  category   TEXT,                    -- 'spirit' | 'liqueur' | 'wine' | 'mixer' | 'syrup' | 'bitter' | 'fresh' | 'other'
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Saved Recipes (adding others' recipes to your journal)
CREATE TABLE saved_recipes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  recipe_id  TEXT NOT NULL,
  saved_at   INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (user_id, recipe_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Bar Menus
CREATE TABLE bar_menus (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_public   INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE bar_menu_items (
  id          TEXT PRIMARY KEY,
  menu_id     TEXT NOT NULL,
  recipe_id   TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (menu_id) REFERENCES bar_menus(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Ingredient Reference Database (seeded curated list; powers autocomplete in recipe forms)
CREATE TABLE ingredient_reference (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  category     TEXT NOT NULL,         -- 'spirit' | 'liqueur' | 'wine' | 'beer' | 'mixer' | 'syrup' | 'bitter' | 'fresh' | 'spice' | 'other'
  subcategory  TEXT,                  -- e.g., 'bourbon', 'rye', 'scotch', 'mezcal', 'amaro'
  abv          REAL,                  -- e.g., 40.0
  flavor_notes TEXT,                  -- JSON array: ["vanilla","caramel","oak"]
  description  TEXT,
  brand        TEXT,                  -- e.g., "Angostura", "Campari"
  region       TEXT,                  -- e.g., "Kentucky", "Oaxaca", "Scotland"
  created_at   INTEGER DEFAULT (strftime('%s', 'now'))
);
```

---

## Feature Phases

### Phase 1 — Foundation & Auth
**Goal:** Working app shell with Google login and a real user identity.

- [x] Project scaffolding (React 19 + TypeScript + Vite + Cloudflare plugin)
- [x] Cloudflare Pages + Workers + D1 + KV wired up
- [x] Google OAuth 2.0 flow in a Worker (`/auth/google`, `/auth/callback`, `/auth/logout`)
- [x] User created/upserted in D1 on first login
- [x] Signed session token issued and stored in KV
- [x] Frontend auth context (logged in state, user profile)
- [x] Protected routes (redirect to login if unauthenticated)
- [x] Basic profile page (avatar, display name from Google)
- [x] Default units setting on profile page (oz or ml) — stored in `users.default_units`, applied globally to all ingredient amounts

---

### Phase 2 — Core Recipe Journal
**Goal:** Full CRUD for personal cocktail recipes. The main feature.

**Recipe Fields:**
- Name
- Type (cocktail, syrup, bitter, tincture, shrub, batch, other)
- Glass type (coupe, rocks, highball, martini, nick & nora, mule, etc.)
- Ice type (none, cubed, large cube, crushed, cracked, sphere)
- Method (stirred, shaken, built, blended, thrown, batch)
- Garnish
- Ingredients (name, amount, unit — ordered list; amounts stored in ml internally, displayed in user's preferred unit)
- Steps (ordered list)
- Notes
- **Difficulty** (easy / medium / hard)
- **Tags** — free-form multi-tag field covering flavor profiles (citrusy, herbal, boozy, bitter, sweet, smoky, tropical, etc.), occasion/season (brunch, holiday, poolside, date night, etc.), and any custom tags

**UI:**
- [x] Recipe list / dashboard (card grid)
- [x] Recipe detail view
- [x] Add/edit recipe form with dynamic ingredient and step rows (drag to reorder)
- [x] Delete recipe with confirmation
- [x] Tag recipes as private (default) or public
- [x] Filter and search by type, difficulty, and tags on dashboard
- [x] Ingredient amount display respects user's `default_units` preference

**Version History:**
- [x] On first save: `version = 1`, no snapshot written
- [x] On each subsequent save: increment `version`, write a full JSON snapshot to `recipe_versions`
- [x] Version history panel on recipe detail: list of past versions with timestamps, tap to preview any snapshot
- [x] Restore a previous version (writes current state as a snapshot first, then restores)

**Create Riff Of / Duplicate:**
- [x] "Create riff of" button on any recipe (your own, saved, or public) — opens a new recipe form pre-filled with all fields from that recipe
- [x] New recipe starts at version 1 and stores `source_recipe_id` pointing to the original
- [x] User modifies freely; saved as a fully independent recipe

---

### Phase 3 — Image Uploads
**Goal:** Attach photos to recipes, stored in R2.

- [x] R2 bucket creation and binding to Worker
- [ ] Presigned URL upload flow (Worker generates a presigned R2 URL → frontend uploads directly to R2)
- [x] Store R2 key in `recipe_images` table
- [x] Display primary image on recipe cards and detail view
- [x] Support multiple images per recipe
- [x] Set/change primary image
- [x] Delete image (remove from R2 + D1)

---

### Phase 4 — Recipe Templates & Riffs
**Goal:** Seed canonical cocktail templates and let users mark recipes as riffs.

- [ ] Seed `recipe_templates` table with ~50–100 common cocktail bases (Negroni, Old Fashioned, Martini, Daiquiri, Sour, Collins, Spritz, etc.)
- [ ] Dropdown on recipe form: "This is a riff on…" → links `template_id` to a canonical template
- [x] Template detail page showing the canonical recipe and all public riffs from the community
- [x] "Start from template" flow: pre-fills recipe form from the canonical values (same UX as "Create riff of" in Phase 2, but sourced from `recipe_templates` rather than a user recipe)
- [x] Canonical templates also display community stats: number of riffs, average rating across all riffs

---

### Phase 5 — Friends & Social Discovery
**Goal:** Friends system and recipe sharing between users.

- [ ] Search users by display name or email
- [ ] Send / accept / reject friend requests
- [ ] Friends list page
- [ ] Friend recipes feed (public recipes from friends)
- [ ] Recipe visibility: private / friends-only / public (update DB column)
- [ ] Search public recipes across all users (full-text search via D1 FTS5)

---

### Phase 6 — Ratings & Comments
**Goal:** Community engagement on recipes.

- [ ] 1–5 star rating on any public recipe
- [ ] Average rating displayed on recipe cards and detail view
- [ ] Comment thread on recipe detail
- [ ] Edit/delete your own comments
- [ ] Notification when someone rates or comments on your recipe (in-app notification dot)

---

### Phase 7 — Ingredient Inventory & "What Can I Make"
**Goal:** Users maintain a home bar ingredient list and discover makeable recipes.

- [ ] **Ingredient reference DB**: seed `ingredient_reference` with a curated list of common spirits, liqueurs, mixers, bitters, syrups, etc. — each with ABV, flavor notes, category, and description
- [ ] Autocomplete in recipe ingredient forms backed by `ingredient_reference` (fuzzy search)
- [ ] Ingredient inventory management (add/remove/categorize ingredients from your home bar)
- [ ] Inventory UI suggests from `ingredient_reference` with full details on hover/tap
- [ ] "What can I make?" page: queries your own + saved + friends' recipes, filters by ingredients you have
- [ ] Show recipes where you have all ingredients (exact match) and recipes where you're missing 1–2 ingredients
- [ ] "Missing ingredient" list: what to buy to unlock the most new recipes
- [x] **Want to make**: flag any recipe as "want to make" (`want_to_make = 1`)
- [ ] **Shopping list**: generate a consolidated shopping list of all ingredients you're missing across all "want to make" flagged recipes (deduped, sorted by how many recipes they unblock)

---

### Phase 8 — Calculators
**Goal:** Utility tools for making cocktails.

- [ ] **Batch calculator**: input a recipe's single-serving quantities + number of servings → scaled output with dilution adjustment guidance
- [ ] **ABV calculator**: input ingredients with their ABV and volumes → estimated final ABV (accounting for dilution)
- [ ] **Cost calculator**: tag ingredients with a price (cost per bottle + bottle size) → cost per cocktail and cost per batch

---

### Phase 9 — Sharing & Saving
**Goal:** Get recipes out of the app and let users collect from others.

- [ ] Save a public recipe to your own journal (persists a copy in `saved_recipes`)
- [ ] **Share recipe link**: public recipes get a shareable URL that works even for logged-out users
- [ ] **Share image card**: generate a styled recipe card (HTML/CSS → Canvas or a Worker-rendered image) shareable to Instagram/socials or via text
- [ ] **QR code**: generate a QR code for any shareable recipe URL

---

### Phase 10 — Bar Menus
**Goal:** Build and publish a curated cocktail menu from your journal.

- [ ] Create named bar menus
- [ ] Add recipes to a menu and reorder (drag and drop)
- [ ] Printable menu view (clean print CSS)
- [ ] Public menu URL (shareable, no login required to view)
- [ ] Menu section headers/categories (e.g., "Aperitivo", "After Dinner")

---

### Phase 11 — AI Recipe Parsing
**Goal:** Point your camera at a recipe card or handwritten recipe, get a structured entry.

- [ ] Image upload UI ("Import from photo")
- [ ] Worker sends image to Cloudflare Workers AI (vision model, e.g., `@cf/llava-1.5-7b-hf` or similar)
- [ ] Prompt instructs the model to extract name, ingredients, steps, and return structured JSON
- [ ] Pre-fill recipe form from parsed JSON; user reviews and confirms
- [ ] Fallback gracefully if AI confidence is low

---

## Additional Feature Ideas

Features planned for later phases, after the core app is stable:

| Feature | Status | Description |
|---|---|---|
| **Cocktail log / attempt history** | Later | Each time you make a recipe, log the date, rate that specific attempt, add notes. Tracks your iterations over time. |
| **Technique library** | Later | Short educational pages on shaking, stirring, fat-washing, clarifying, etc. Linkable from recipe steps. |
| **Glassware tracker** | Later | Catalog what glassware you own; recipes flag if you have the right glass. |
| **Food pairing suggestions** | Later | Free-text or curated list of food pairings on a recipe. |
| **Collections / flights** | Later | Group recipes into themed sets ("Negroni variations I love", "Summer 2025"). |
| **Recipe card PDF export** | Later | Generate a clean printable/downloadable recipe card. |
| **Push notifications** | Later | Browser push (Web Push API) for friend activity: ratings, comments, friend requests. |
| **Weekly digest** | Later | Email or in-app summary of top-rated community recipes this week. |
| **Private vs. public batch printing** | Later | Print-optimized batch sheet for an event (scaled recipe + cost per drink). |
| **Community challenges** | Later | Time-limited themes: "best aperitivo riff this month". Voting, winner badge. |

> **Decisions incorporated into phases above:** Version history (Phase 2), flavor profile tags (Phase 2), difficulty rating (Phase 2), occasion/season tags (merged into unified tags field, Phase 2), spirits/ingredient reference database (Phase 7), shopping list via "want to make" flag (Phase 7), default units as user profile setting (Phase 1), duplicate recipe merged into "Create riff of" (Phase 2).

---

## Project Structure (projected)

```
cocktail-journal/
  wrangler.jsonc             — Worker + D1 + KV + R2 bindings
  schema.sql                 — D1 migrations
  tsconfig.app.json          — Frontend TypeScript config
  tsconfig.worker.json       — Worker TypeScript config
  vite.config.ts             — Vite + Cloudflare plugin
  package.json

  src/                       — React frontend
    main.tsx
    App.tsx
    theme.ts                   — MUI "The Speakeasy" custom theme
    index.css                  — Google Fonts imports (Playfair Display, Inter, JetBrains Mono)
    context/
      AuthContext.tsx          — Logged-in user + session
    pages/
      Login.tsx
      Dashboard.tsx            — Recipe cards grid
      RecipeDetail.tsx
      RecipeForm.tsx           — Add / edit
      Profile.tsx
      Friends.tsx
      Discover.tsx
      WhatCanIMake.tsx
      BarMenus.tsx
    components/
      RecipeCard.tsx
      IngredientRow.tsx
      StepRow.tsx
      RatingStars.tsx
      CommentThread.tsx
      ImageUpload.tsx
    hooks/
      useAuth.ts
      useRecipes.ts
      useIngredientInventory.ts

  worker/
    index.ts                   — Router (same pattern as toodoo)
    auth.ts                    — Google OAuth handlers
    middleware.ts              — Session validation
    recipes.ts                 — Recipe CRUD handlers
    users.ts                   — User/profile handlers
    friends.ts                 — Friends system handlers
    images.ts                  — R2 presign + image management
    search.ts                  — Full-text search
    ai.ts                      — Workers AI recipe parsing

  public/
    manifest.json              — PWA manifest
    sw.js                      — Service worker (offline support)
```

---

## Cloudflare Free Tier Limits (Reference)

| Service | Free Limit | Concern Level |
|---|---|---|
| Pages | Unlimited requests, 500 builds/month | None |
| Workers | 100K requests/day | Low — only API calls hit Workers |
| D1 | 5 GB storage, 25M row reads/day, 50K writes/day | None for early stage |
| KV | 100K reads/day, 1K writes/day, 1 GB storage | Low — writes only on login |
| R2 | 10 GB storage, 1M Class A ops/month | Fine until significant image volume |
| Workers AI | 10K "neurons"/day (varies by model) | Only relevant in Phase 11 |

The app can realistically grow to hundreds of users before hitting any free tier limits.

---

## What Google Cloud Console Setup Is Needed

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google+ API** (or People API)
3. Create **OAuth 2.0 credentials** (Web application type)
4. Set authorized redirect URI to your Worker's callback URL: `https://your-worker.workers.dev/auth/callback`
5. Store `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as Wrangler secrets (never commit them)

```sh
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SESSION_SECRET    # for signing session tokens
```

---

## Implementation Order Summary

| Phase | Key Deliverable | New Cloudflare Service |
|---|---|---|
| 1 | Auth + user accounts | Workers, D1, KV |
| 2 | Recipe CRUD (core journal) | — |
| 3 | Photo uploads | R2 |
| 4 | Templates & riffs | — |
| 5 | Friends + discovery | — |
| 6 | Ratings + comments | — |
| 7 | Ingredient inventory + makeable | — |
| 8 | Batch / ABV / cost calculators | — |
| 9 | Sharing + save others' recipes | — |
| 10 | Bar menus | — |
| 11 | AI image parsing | Workers AI |
