-- The rebound note was written as 083, but that version was already
-- recorded remotely by the board-flow insert. This copy applies the
-- missing text. ON CONFLICT keeps it harmless where 083 already inserted it.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_ft_rebound_go', 'en', 'Rebound. The clock is running.'),
  ('trke_ft_rebound_go', 'es', 'Rebote. El crono está en marcha.'),
  ('trke_ft_rebound_go', 'ca', 'Rebot. El crono està en marxa.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
