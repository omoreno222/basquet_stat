-- Migration 019: Light/dark theme support
-- Add theme column to profiles (light/dark, default light, no system option)

-- Add theme column
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light'
  CHECK (theme IN ('light', 'dark'));

-- Add index for theme lookups
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON profiles(theme);

-- Add comment
COMMENT ON COLUMN profiles.theme IS 'User theme preference: light or dark (default light, no system option)';

-- Add i18n keys for theme
INSERT INTO translations (locale, key, value) VALUES
  -- English
  ('en', 'trke_theme', 'Theme'),
  ('en', 'trke_light_theme', 'Light'),
  ('en', 'trke_dark_theme', 'Dark'),
  ('en', 'trke_theme_updated', 'Theme updated successfully'),
  
  -- Spanish
  ('es', 'trke_theme', 'Tema'),
  ('es', 'trke_light_theme', 'Claro'),
  ('es', 'trke_dark_theme', 'Oscuro'),
  ('es', 'trke_theme_updated', 'Tema actualizado exitosamente'),
  
  -- Catalan
  ('ca', 'trke_theme', 'Tema'),
  ('ca', 'trke_light_theme', 'Clar'),
  ('ca', 'trke_dark_theme', 'Fosc'),
  ('ca', 'trke_theme_updated', 'Tema actualitzat exitosament')
ON CONFLICT (locale, key) DO UPDATE
  SET value = EXCLUDED.value;
