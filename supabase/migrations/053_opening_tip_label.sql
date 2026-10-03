-- Label for the opening-tip button that replaces start clock before the game begins.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_salto_inicial', 'en', 'Jump'),
  ('trke_salto_inicial', 'es', 'Salto inicial'),
  ('trke_salto_inicial', 'ca', 'Salt inicial')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
