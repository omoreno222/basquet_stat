-- Migration 017: Add club_admin role to user_role enum
-- This must be in its own transaction/file before any usage of the new value
-- because Postgres forbids using a newly added enum value in the same transaction

-- Add club_admin to user_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typcategory = 'E') THEN
    CREATE TYPE user_role AS ENUM ('admin', 'club_admin', 'team_manager', 'coach', 'parent', 'player');
  ELSE
    -- Check if club_admin doesn't exist in the enum
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'user_role' AND e.enumlabel = 'club_admin'
    ) THEN
      ALTER TYPE user_role ADD VALUE 'club_admin';
    END IF;
  END IF;
END $$;
