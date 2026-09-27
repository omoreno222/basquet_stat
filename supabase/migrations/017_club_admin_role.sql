-- Migration 017: Add club_admin role to user_role enum
-- This must be in its own transaction/file before any usage of the new value
-- because Postgres forbids using a newly added enum value in the same transaction

-- Add club_admin role to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'club_admin';
