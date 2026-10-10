-- Period partials beside the quarter number on the evaluation page. No schema change.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_partials', 'en', 'Partials'),
  ('trke_eval_partials', 'es', 'Parciales'),
  ('trke_eval_partials', 'ca', 'Parcials')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
