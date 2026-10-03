-- Timeout is its own event. This file only adds the enum value.
-- Postgres cannot use a new enum value in the same transaction that adds it.

DO $$ BEGIN
  ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'timeout';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
