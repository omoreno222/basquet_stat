-- Shown in the capture hint bar when FOUL is pressed with nobody on that side.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_foul_hint_roster', 'en', 'Put players on the court before the foul'),
  ('trke_foul_hint_roster', 'es', 'Pon jugadores en la pista antes de la falta'),
  ('trke_foul_hint_roster', 'ca', 'Posa jugadors a la pista abans de la falta')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
