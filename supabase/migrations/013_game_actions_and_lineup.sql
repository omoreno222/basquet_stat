-- Migration 013: Game Actions (Fouls, Free Throws) and Lineup Tracking
-- Description: Add support for foul types, substitutions, and lineup tracking

-- Add foul_type enum
DO $$ BEGIN
  CREATE TYPE foul_type AS ENUM ('personal', 'technical', 'unsportsmanlike');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add substitution fields to game_events
ALTER TABLE game_events 
  ADD COLUMN IF NOT EXISTS foul_type foul_type,
  ADD COLUMN IF NOT EXISTS player_out_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS free_throws_awarded INTEGER CHECK (free_throws_awarded BETWEEN 0 AND 3);

-- Create starting_lineups table to track initial 5 players
CREATE TABLE IF NOT EXISTS starting_lineups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position_index INTEGER NOT NULL CHECK (position_index BETWEEN 0 AND 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id),
  UNIQUE(game_id, position_index)
);

-- Add index for starting lineup queries
CREATE INDEX IF NOT EXISTS idx_starting_lineups_game ON starting_lineups(game_id);

-- Enable RLS on starting_lineups
ALTER TABLE starting_lineups ENABLE ROW LEVEL SECURITY;

-- RLS policy for starting_lineups (same pattern as game_events)
-- SELECT: Anyone can view (for stats, reports, etc.)
DROP POLICY IF EXISTS "Anyone can view starting lineups" ON starting_lineups;
CREATE POLICY "Anyone can view starting lineups"
  ON starting_lineups FOR SELECT
  USING (true);

-- Write operations: Only admin or team_manager (uses function from migration 002/005)
DROP POLICY IF EXISTS "Team managers can manage starting lineups" ON starting_lineups;
CREATE POLICY "Team managers can manage starting lineups"
  ON starting_lineups FOR ALL
  USING (is_admin_or_team_manager())
  WITH CHECK (is_admin_or_team_manager());

-- Add translations for new UI strings
INSERT INTO translations (key, locale, value) VALUES
  -- Free Throws
  ('trke_ft_title', 'en', 'Free Throws'),
  ('trke_ft_title', 'es', 'Tiros Libres'),
  ('trke_ft_title', 'ca', 'Tirs Lliures'),
  ('trke_ft_select_player', 'en', 'Select Player'),
  ('trke_ft_select_player', 'es', 'Seleccionar Jugador'),
  ('trke_ft_select_player', 'ca', 'Seleccionar Jugador'),
  ('trke_ft_how_many', 'en', 'How many free throws?'),
  ('trke_ft_how_many', 'es', '¿Cuántos tiros libres?'),
  ('trke_ft_how_many', 'ca', 'Quants tirs lliures?'),
  ('trke_ft_made', 'en', 'Made'),
  ('trke_ft_made', 'es', 'Anotado'),
  ('trke_ft_made', 'ca', 'Anotat'),
  ('trke_ft_missed', 'en', 'Missed'),
  ('trke_ft_missed', 'es', 'Fallado'),
  ('trke_ft_missed', 'ca', 'Fallat'),
  
  -- Fouls
  ('trke_foul_title', 'en', 'Foul'),
  ('trke_foul_title', 'es', 'Falta'),
  ('trke_foul_title', 'ca', 'Falta'),
  ('trke_foul_type', 'en', 'Foul Type'),
  ('trke_foul_type', 'es', 'Tipo de Falta'),
  ('trke_foul_type', 'ca', 'Tipus de Falta'),
  ('trke_foul_personal', 'en', 'Personal'),
  ('trke_foul_personal', 'es', 'Personal'),
  ('trke_foul_personal', 'ca', 'Personal'),
  ('trke_foul_technical', 'en', 'Technical'),
  ('trke_foul_technical', 'es', 'Técnica'),
  ('trke_foul_technical', 'ca', 'Tècnica'),
  ('trke_foul_unsportsmanlike', 'en', 'Unsportsmanlike'),
  ('trke_foul_unsportsmanlike', 'es', 'Antideportiva'),
  ('trke_foul_unsportsmanlike', 'ca', 'Antiesportiva'),
  ('trke_foul_ft_awarded', 'en', 'Free throws awarded?'),
  ('trke_foul_ft_awarded', 'es', '¿Tiros libres concedidos?'),
  ('trke_foul_ft_awarded', 'ca', 'Tirs lliures concedits?'),
  ('trke_foul_count', 'en', 'Fouls'),
  ('trke_foul_count', 'es', 'Faltas'),
  ('trke_foul_count', 'ca', 'Faltes'),
  ('trke_fouled_out', 'en', 'Fouled Out'),
  ('trke_fouled_out', 'es', 'Eliminado'),
  ('trke_fouled_out', 'ca', 'Eliminat'),
  
  -- Substitutions
  ('trke_sub_title', 'en', 'Substitution'),
  ('trke_sub_title', 'es', 'Sustitución'),
  ('trke_sub_title', 'ca', 'Substitució'),
  ('trke_sub_select_out', 'en', 'Select Players OUT'),
  ('trke_sub_select_out', 'es', 'Seleccionar Jugadores SALEN'),
  ('trke_sub_select_out', 'ca', 'Seleccionar Jugadors SURTEN'),
  ('trke_sub_select_in', 'en', 'Select Players IN'),
  ('trke_sub_select_in', 'es', 'Seleccionar Jugadores ENTRAN'),
  ('trke_sub_select_in', 'ca', 'Seleccionar Jugadors ENTREN'),
  ('trke_sub_on_court', 'en', 'On Court'),
  ('trke_sub_on_court', 'es', 'En Cancha'),
  ('trke_sub_on_court', 'ca', 'A Pista'),
  ('trke_sub_bench', 'en', 'Bench'),
  ('trke_sub_bench', 'es', 'Banquillo'),
  ('trke_sub_bench', 'ca', 'Banqueta'),
  
  -- Starting Lineup
  ('trke_lineup_title', 'en', 'Starting Lineup'),
  ('trke_lineup_title', 'es', 'Quinteto Inicial'),
  ('trke_lineup_title', 'ca', 'Cinc Inicial'),
  ('trke_lineup_select_5', 'en', 'Select 5 players to start'),
  ('trke_lineup_select_5', 'es', 'Selecciona 5 jugadores para empezar'),
  ('trke_lineup_select_5', 'ca', 'Selecciona 5 jugadors per començar'),
  ('trke_lineup_button', 'en', 'Lineup'),
  ('trke_lineup_button', 'es', 'Alineación'),
  ('trke_lineup_button', 'ca', 'Alineació'),
  
  -- Common
  ('trke_confirm', 'en', 'Confirm'),
  ('trke_confirm', 'es', 'Confirmar'),
  ('trke_confirm', 'ca', 'Confirmar'),
  ('trke_none', 'en', 'None'),
  ('trke_none', 'es', 'Ninguno'),
  ('trke_none', 'ca', 'Cap')
ON CONFLICT (key, locale) DO NOTHING;
