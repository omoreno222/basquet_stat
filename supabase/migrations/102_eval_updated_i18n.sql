-- "Updated at HH:MM" and the reload button next to it.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_eval_updated', 'en', 'Updated at {time}'),
  ('trke_eval_updated', 'es', 'Actualizado a las {time}'),
  ('trke_eval_updated', 'ca', 'Actualitzat a les {time}'),
  ('trke_eval_reload_button', 'en', 'Reload'),
  ('trke_eval_reload_button', 'es', 'Recargar'),
  ('trke_eval_reload_button', 'ca', 'Recarregar')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
