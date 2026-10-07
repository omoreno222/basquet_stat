-- Labels for the clock mark on each turnover reason.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_turnover_clock_stops', 'en', 'Stops the clock'),
  ('trke_turnover_clock_stops', 'es', 'Para el reloj'),
  ('trke_turnover_clock_stops', 'ca', 'Atura el rellotge'),

  ('trke_turnover_clock_runs', 'en', 'The clock keeps running'),
  ('trke_turnover_clock_runs', 'es', 'El reloj sigue'),
  ('trke_turnover_clock_runs', 'ca', 'El rellotge segueix')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
