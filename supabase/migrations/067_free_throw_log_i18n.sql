-- One log pill for a free-throw sequence. Singular when the sequence is one shot.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_ft_log_one', 'en', 'Free throw'),
  ('trke_ft_log_one', 'es', 'Tiro libre'),
  ('trke_ft_log_one', 'ca', 'Tir lliure'),

  ('trke_ft_log_many', 'en', 'Free throws'),
  ('trke_ft_log_many', 'es', 'Tiros libres'),
  ('trke_ft_log_many', 'ca', 'Tirs lliures')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
