-- Labels for typing the minute and second of a deferred turnover.
-- No schema change. game_events already stores clock_remaining_ms and turnover_type.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_deferred_second', 'en', 'Second'),
  ('trke_deferred_second', 'es', 'Segundo'),
  ('trke_deferred_second', 'ca', 'Segon'),

  ('trke_deferred_clock_invalid', 'en', 'Enter a time from 0:00 to 10:00'),
  ('trke_deferred_clock_invalid', 'es', 'Escribe un tiempo de 0:00 a 10:00'),
  ('trke_deferred_clock_invalid', 'ca', 'Escriu un temps de 0:00 a 10:00')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
