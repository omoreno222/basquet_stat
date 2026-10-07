-- Accessible name for the attack-direction marks on the capture hint bar.

INSERT INTO translations (key, locale, value) VALUES
  ('trke_attack_mark', 'en', '{team} attacks this basket'),
  ('trke_attack_mark', 'es', '{team} ataca esta canasta'),
  ('trke_attack_mark', 'ca', '{team} ataca aquesta cistella')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
