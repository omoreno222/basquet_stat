-- The capture board names the free throws it is about to mark.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_ft_awarded_1', 'en', '1 free throw'),
  ('trke_ft_awarded_1', 'es', '1 tiro libre'),
  ('trke_ft_awarded_1', 'ca', '1 tir lliure'),
  ('trke_ft_awarded_2', 'en', '2 free throws'),
  ('trke_ft_awarded_2', 'es', '2 tiros libres'),
  ('trke_ft_awarded_2', 'ca', '2 tirs lliures'),
  ('trke_ft_awarded_3', 'en', '3 free throws'),
  ('trke_ft_awarded_3', 'es', '3 tiros libres'),
  ('trke_ft_awarded_3', 'ca', '3 tirs lliures')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
