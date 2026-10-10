-- Heading above eliminated players on the capture bench. Hidden when nobody is out.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_bench_out', 'en', 'Out'),
  ('trke_bench_out', 'es', 'Fuera'),
  ('trke_bench_out', 'ca', 'Fora')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
