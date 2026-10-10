-- Label for the personal button when the fouling team has the ball.
-- The stored foul stays personal with context offensive.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_foul_offensive', 'en', 'Offensive foul'),
  ('trke_foul_offensive', 'es', 'Falta en ataque'),
  ('trke_foul_offensive', 'ca', 'Falta en atac')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
