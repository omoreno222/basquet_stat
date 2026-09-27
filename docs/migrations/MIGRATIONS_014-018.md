# Migrations 014-018: Realtime Sync Hardening & Multi-Club Infrastructure

**Status**: Ready for production deployment  
**Dependencies**: Requires migrations 001-013 already applied  
**Date**: 2026-09-27

## Overview

This set of migrations completes the realtime synchronization infrastructure and introduces multi-club (multi-tenancy) support, transforming the application from single-club to multi-tenant architecture.

## Migration Files

### 014_lineup_immutability.sql
**Purpose**: Enforce starting lineup immutability after game starts  
**Key Changes**:
- Creates trigger to prevent starting lineup changes after first period begins
- Prevents data corruption in lineup tracking
- Ensures historical accuracy of game records

### 015_profile_self_service.sql
**Purpose**: Self-service profile updates and password changes  
**Key Changes**:
- Adds `must_change_password` flag to profiles table
- Adds `avatar_url` to profiles for user avatars
- RLS policies for users to update their own profile, theme, language
- Password reset flow support

### 016_game_window_and_guests.sql
**Purpose**: Game event time windows and guest player support  
**Key Changes**:
- Creates `game_periods` table to track period start/end timestamps
- Creates `game_guest_players` table for non-roster players
- Adds `event_timestamp` to `game_events` (wall clock time, not game clock)
- RLS policies for period and guest player management

### 017_club_admin_role.sql ⚠️
**Purpose**: Add club_admin role to enum (MUST BE SEPARATE)  
**Key Changes**:
- **ONLY** adds `club_admin` value to `user_role` enum
- **Critical**: Must be in its own migration file and transaction
- **Reason**: Postgres forbids using a newly added enum value in the same transaction

### 018_clubs.sql
**Purpose**: Multi-club infrastructure and club_admin permissions  
**Dependencies**: Requires 017_club_admin_role.sql applied first  
**Key Changes**:
- Creates `clubs` table (the primary tenant entity)
- Adds `club_id` foreign keys to: profiles, profile_roles, teams, seasons
- Adds team categorization: `category` (premini → senior), `gender` (male/female/mixed)
- Helper functions: `is_platform_admin()`, `is_club_admin()`, `has_club_role()`, `get_user_clubs()`
- Updates all RLS policies to enforce club scoping
- Platform admin (role='admin', club_id=NULL) sees all clubs
- Club admin (role='club_admin' or role='admin' with club_id) sees only their club
- Backfills demo club and assigns existing data to it
- Updates profiles, teams, games, players policies to respect club boundaries
- Storage policies for club logos in `avatars/clubs/<club_id>/`
- Triggers to enforce same-club constraints (guest players, team assignments)
- Translations for club management UI (en/es/ca)

## Transaction Safety ⚠️

**CRITICAL**: Migration 017 and 018 are split because of Postgres enum transaction rules:

1. **017**: Only adds `club_admin` enum value
2. **018**: Uses the `club_admin` value in policies and constraints

This split is **required** when applying migrations via `supabase db push` or `psql -1` (single transaction mode).

## Validation

### Prerequisites
- Postgres 15+ (same major version as Supabase)
- Fresh database OR remote state with 001-016 already applied

### Fresh Database Test
```bash
# Apply base migrations (001-016)
for i in {001..016}; do
  psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/${i}_*.sql" "$DATABASE_URL"
done

# Apply new migrations in transaction mode (simulates supabase db push)
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/017_club_admin_role.sql" "$DATABASE_URL"
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/018_clubs.sql" "$DATABASE_URL"

# Test idempotency (should succeed with no errors)
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/017_club_admin_role.sql" "$DATABASE_URL"
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/018_clubs.sql" "$DATABASE_URL"
```

### Remote State Test (001-016 already applied)
```bash
# Only apply the new migrations
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/017_club_admin_role.sql" "$DATABASE_URL"
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/018_clubs.sql" "$DATABASE_URL"

# Test idempotency
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/017_club_admin_role.sql" "$DATABASE_URL"
psql -v ON_ERROR_STOP=1 -1 -f "supabase/migrations/018_clubs.sql" "$DATABASE_URL"
```

## Rollback Plan

These migrations cannot be cleanly rolled back due to:
- Enum modifications (cannot remove enum values in Postgres)
- Structural changes to core tables
- Multi-tenancy scope changes

**Recommendation**: Test thoroughly in staging before production deployment.

## Post-Deployment Checklist

- [ ] Verify demo club was created and data assigned
- [ ] Test platform admin can see all clubs
- [ ] Test club admin can only see their own club
- [ ] Verify club logo upload/delete works
- [ ] Test guest players respect club boundaries
- [ ] Verify team assignments respect club boundaries
- [ ] Test lineup immutability after period 1 starts
- [ ] Test profile self-service updates work
- [ ] Test game period tracking works
- [ ] Verify realtime sync for all new tables

## Code Changes Required

- **Auth utilities**: Use `is_platform_admin()`, `is_club_admin()` helpers
- **Admin UI**: Add club switcher for platform admin
- **User creation**: Require club_id for non-platform users
- **Queries**: Filter by club_id where applicable
- **Team/Player forms**: Add category and gender fields

## Notes

- Platform admin (Oscar) has `role='admin'` with `club_id=NULL`
- Club admins have `role='club_admin'` OR `role='admin'` with non-null `club_id`
- All existing data is backfilled to a demo club automatically
- Guest players can only be from the same club as the game's team
- Players can only be on teams within their club
- Seasons remain global (not club-scoped)
