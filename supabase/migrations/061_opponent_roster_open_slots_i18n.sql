-- The roster popup shows all 12 jerseys and the coach at once.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_opponent_roster_hint', 'en', 'Fill in the jerseys you see. Leave the rest blank. The coach has no jersey.'),
  ('trke_opponent_roster_hint', 'es', 'Rellena los dorsales que veas. El resto puede quedar vacío. El entrenador no tiene dorsal.'),
  ('trke_opponent_roster_hint', 'ca', 'Omple els dorsals que vegis. La resta pot quedar buida. L''entrenador no té dorsal.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
