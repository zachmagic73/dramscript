-- One-time migration: add manual placeholder icon selection per recipe
ALTER TABLE recipes ADD COLUMN placeholder_icon INTEGER;
