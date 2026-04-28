-- Add per-user Discover journal metadata to saved_recipes
ALTER TABLE saved_recipes ADD COLUMN status TEXT NOT NULL DEFAULT 'want_to_make';
ALTER TABLE saved_recipes ADD COLUMN personal_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id ON saved_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_recipes_recipe_id ON saved_recipes(recipe_id);
