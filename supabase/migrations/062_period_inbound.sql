-- Who won the opening tip. Possession changes during the game, so the arrow
-- for later periods cannot be read from games.possession.
-- RLS stays the policies in 055_rls_all_tables.sql: club members can read a game,
-- and a platform admin or a manager of that club can update the row.
-- No new policy. The check below is what stops any other value.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS opening_tip_winner TEXT;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_opening_tip_winner;

ALTER TABLE public.games
  ADD CONSTRAINT games_opening_tip_winner
  CHECK (opening_tip_winner IS NULL OR opening_tip_winner IN ('home', 'away'));

COMMENT ON COLUMN public.games.opening_tip_winner IS 'Team that won the opening jump ball. Null until the tip is recorded.';

INSERT INTO translations (key, locale, value) VALUES
  ('trke_attack_change_notice', 'en', 'Change the attacking basket.'),
  ('trke_attack_change_notice', 'es', 'Cambie el campo de ataque.'),
  ('trke_attack_change_notice', 'ca', 'Canvieu el camp d''atac.'),
  ('trke_quinteto', 'en', 'Lineup'),
  ('trke_quinteto', 'es', 'Quinteto'),
  ('trke_quinteto', 'ca', 'Quintet'),
  ('trke_inbound_proposal', 'en', '{team} will inbound.'),
  ('trke_inbound_proposal', 'es', 'Saca {team}.'),
  ('trke_inbound_proposal', 'ca', 'Treu {team}.'),
  ('trke_held_ball_question', 'en', 'Was there a held ball?'),
  ('trke_held_ball_question', 'es', '¿Hubo balón retenido?'),
  ('trke_held_ball_question', 'ca', 'Hi va haver pilota retinguda?'),
  ('trke_inbound_flipped', 'en', 'Possession changes to {team}.'),
  ('trke_inbound_flipped', 'es', 'La posesión pasa a {team}.'),
  ('trke_inbound_flipped', 'ca', 'La possessió passa a {team}.'),
  ('trke_held_ball_yes', 'en', 'Yes'),
  ('trke_held_ball_yes', 'es', 'Sí'),
  ('trke_held_ball_yes', 'ca', 'Sí'),
  ('trke_held_ball_no', 'en', 'No'),
  ('trke_held_ball_no', 'es', 'No'),
  ('trke_held_ball_no', 'ca', 'No')
ON CONFLICT (key, locale) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
