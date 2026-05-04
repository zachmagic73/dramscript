-- Add source_credit field to recipes
-- Allows attributing a recipe to its original source (book, bartender, website, etc.)
-- Recipes with a source credit are forced private and cannot be made public.
ALTER TABLE recipes ADD COLUMN source_credit TEXT;
