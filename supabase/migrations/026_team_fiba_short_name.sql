-- Optional FIBA team code: exactly 3 uppercase letters or digits.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS fiba_short_name TEXT;

ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_fiba_short_name_format;
ALTER TABLE teams ADD CONSTRAINT teams_fiba_short_name_format
  CHECK (fiba_short_name IS NULL OR fiba_short_name ~ '^[A-Z0-9]{3}$');

COMMENT ON COLUMN teams.fiba_short_name IS 'Optional FIBA short name: 3 uppercase letters or digits.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_team_fiba_short_name', 'en', 'FIBA short name'),
  ('trke_team_fiba_short_name', 'es', 'Nombre corto FIBA'),
  ('trke_team_fiba_short_name', 'ca', 'Nom curt FIBA'),

  ('trke_team_fiba_short_name_hint', 'en', 'Optional. 3 letters or numbers.'),
  ('trke_team_fiba_short_name_hint', 'es', 'Opcional. 3 letras o números.'),
  ('trke_team_fiba_short_name_hint', 'ca', 'Opcional. 3 lletres o números.')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
