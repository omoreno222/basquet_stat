-- Migration 019: Footer translations
-- Add translation keys for the site footer

INSERT INTO translations (key, locale, value) VALUES
  -- Footer copyright
  ('trke_footer_copyright', 'en', '© 2026 SeasonMath'),
  ('trke_footer_copyright', 'es', '© 2026 SeasonMath'),
  ('trke_footer_copyright', 'ca', '© 2026 SeasonMath'),
  
  -- Footer support email
  ('trke_footer_support', 'en', 'support@seasonmath.com'),
  ('trke_footer_support', 'es', 'support@seasonmath.com'),
  ('trke_footer_support', 'ca', 'support@seasonmath.com'),
  
  -- Footer version prefix
  ('trke_footer_version', 'en', 'v'),
  ('trke_footer_version', 'es', 'v'),
  ('trke_footer_version', 'ca', 'v')

ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
