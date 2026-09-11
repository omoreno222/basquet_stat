-- Add official column to games table
-- This distinguishes between official competition games (true) and friendly games (false)
ALTER TABLE games ADD COLUMN IF NOT EXISTS official BOOLEAN NOT NULL DEFAULT true;
