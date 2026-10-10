-- Note after a missed last free throw once the rebound is recorded and the clock is already running.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_ft_rebound_go', 'en', 'Rebound. The clock is running.'),
  ('trke_ft_rebound_go', 'es', 'Rebote. El crono está en marcha.'),
  ('trke_ft_rebound_go', 'ca', 'Rebot. El crono està en marxa.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
