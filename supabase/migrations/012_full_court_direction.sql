-- Add court direction tracking for full-court capture
-- Migration: 012_full_court_direction

-- Track which basket the team attacks first (Q1-Q2)
-- True = attack right basket in Q1-Q2, false = attack left basket in Q1-Q2
-- Teams switch at halftime (Q3-Q4 attack the opposite basket)
ALTER TABLE games ADD COLUMN IF NOT EXISTS attack_right_first BOOLEAN DEFAULT true;

-- Update existing games to default to attacking right first
UPDATE games SET attack_right_first = true WHERE attack_right_first IS NULL;
