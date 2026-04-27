-- Dramscript Database Schema
-- Run: npm run db:migrate:local  (local dev)
-- Run: npm run db:migrate:remote (production)

-- Users (created/upserted on first Google login)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  google_id     TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  default_units TEXT NOT NULL DEFAULT 'oz',
  created_at    INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at    INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Sessions (backup; primary lookup in KV)
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Canonical Recipe Templates (e.g., "Negroni", "Old Fashioned")
CREATE TABLE IF NOT EXISTS recipe_templates (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  description    TEXT,
  base_type      TEXT,
  canonical_json TEXT,
  created_at     INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Recipes
CREATE TABLE IF NOT EXISTS recipes (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'cocktail',
  glass_type       TEXT,
  ice_type         TEXT,
  method           TEXT,
  garnish          TEXT,
  notes            TEXT,
  difficulty       TEXT,
  tags             TEXT DEFAULT '[]',
  version          INTEGER DEFAULT 1,
  is_public        INTEGER DEFAULT 0,
  want_to_make     INTEGER DEFAULT 0,
  template_id      TEXT,
  source_recipe_id TEXT,
  servings         INTEGER DEFAULT 1,
  created_at       INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at       INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES recipe_templates(id),
  FOREIGN KEY (source_recipe_id) REFERENCES recipes(id)
);

CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_updated_at ON recipes(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_is_public ON recipes(is_public);

-- Recipe Ingredients
CREATE TABLE IF NOT EXISTS ingredients (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  amount      REAL,
  unit        TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id);

-- Recipe Steps
CREATE TABLE IF NOT EXISTS steps (
  id          TEXT PRIMARY KEY,
  recipe_id   TEXT NOT NULL,
  description TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_steps_recipe_id ON steps(recipe_id);

-- Recipe Images (stored in R2)
CREATE TABLE IF NOT EXISTS recipe_images (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL,
  r2_key     TEXT NOT NULL UNIQUE,
  is_primary INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipe_images_recipe_id ON recipe_images(recipe_id);

-- Recipe Version Snapshots
CREATE TABLE IF NOT EXISTS recipe_versions (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL,
  version    INTEGER NOT NULL,
  snapshot   TEXT NOT NULL,
  changed_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);

-- Friends System
CREATE TABLE IF NOT EXISTS friendships (
  id           TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  addressee_id TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Recipe Ratings
CREATE TABLE IF NOT EXISTS recipe_ratings (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (recipe_id, user_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User Ingredient Inventory
CREATE TABLE IF NOT EXISTS user_ingredients (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  category   TEXT,
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved Recipes
CREATE TABLE IF NOT EXISTS saved_recipes (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  saved_at  INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE (user_id, recipe_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Bar Menus
CREATE TABLE IF NOT EXISTS bar_menus (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_public   INTEGER DEFAULT 0,
  created_at  INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bar_menu_items (
  id          TEXT PRIMARY KEY,
  menu_id     TEXT NOT NULL,
  recipe_id   TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (menu_id) REFERENCES bar_menus(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
);

-- Ingredient Reference Database
CREATE TABLE IF NOT EXISTS ingredient_reference (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  category     TEXT NOT NULL,
  subcategory  TEXT,
  abv          REAL,
  flavor_notes TEXT,
  description  TEXT,
  brand        TEXT,
  region       TEXT,
  created_at   INTEGER DEFAULT (strftime('%s', 'now'))
);
