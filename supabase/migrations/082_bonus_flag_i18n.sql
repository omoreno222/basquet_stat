-- Screen-reader label for the period bonus pennant beside the ball.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_bonus_flag', 'en', 'Bonus'),
  ('trke_bonus_flag', 'es', 'Bonus'),
  ('trke_bonus_flag', 'ca', 'Bonus')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
