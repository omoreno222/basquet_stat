# Consolidated Migrations 014-017

## Summary

Migrations 018 and 019 have been **deleted** as they were duplicating columns already added in migration 015.

## Migration List

### 014_lineup_immutability.sql
- Prevents starting lineup changes after game starts (has events or clock ran)
- Adds `check_game_not_started()` function
- Adds triggers to block INSERT/UPDATE/DELETE on starting_lineups after game start
- Adds `clock_remaining_ms` to game_periods for accurate period-end tracking
- Adds game_periods to realtime publication

### 015_profile_self_service.sql
- **Consolidated** - now includes keys from deleted 018 and 019
- Adds user profile fields: first_name, last_name, phone, locale, must_change_password, password_reset_requested_at, theme
- Adds RLS for users to update own profile (safe columns only)
- Adds trigger to prevent self-role-escalation
- Includes translation keys for profile, password auth, email change, theme toggle
- Total: ~280 translation keys (EN/ES/CA)

### 016_game_window_and_guests.sql
- Adds game opening window (30-min before scheduled time, admin override)
- Adds `regular_periods` and `max_overtimes` columns to games
- Creates `game_guest_players` table for cross-team guest players
- Adds `can_start_game()` function with 30-min window check
- Adds player-role RLS policies (players can see own team data)
- Helper functions: `is_player_of_team()`, `get_user_player_teams()`
- Adds `should_auto_close_game()` function for FIBA end-of-game logic
- Trigger to prevent events on finished games
- Translation keys for game window, periods, guests (~90 keys)

### 017_clubs.sql
- **Major migration** - transforms app into multi-tenant system
- Adds `club_admin` role to user_role enum
- **FIXED**: Drops old `valid_role` CHECK constraint from migration 005 that was blocking club_admin
- Creates team_category enum (premini, mini, infantil, cadete, junior, sub22, senior)
- Creates team_gender enum (male, female, mixed)
- Creates `clubs` table (id, name, short_name, logo_url, colors)
- Adds club_id to: teams, players, profile_roles, games (via team)
- Adds category/gender to teams
- Backfills demo club and assigns all existing data to it
- Security helper functions: `is_platform_admin()`, `is_club_admin()`, `has_club_role()`, `get_user_clubs()`
- Complete RLS rewrite for club-scoped access (all tenant tables)
- Triggers: `enforce_same_club_guest_players()`, `enforce_same_club_team_players()`
- Storage policies for club logos in avatars bucket
- Translation keys for clubs, roles, categories, genders, logos (~130 keys)

## Key Fixes

1. **Migration 017 CHECK constraint fix**: Drops `valid_role` constraint from profile_roles that was preventing club_admin inserts
2. **Migrations 018 & 019 deleted**: These duplicated columns from 015 (must_change_password, password_reset_requested_at, theme)
3. **Migration 015 consolidated**: Now includes all unique translation keys from 018 and 019

## Testing Results

- ✅ Fresh apply of 001-017: Success
- ✅ Idempotency test (re-running migrations): Mostly idempotent (expected warnings for already-existing objects)
- ✅ club_admin role: Can be inserted without CHECK constraint errors
- ✅ Backfill: Demo club created and data assigned
- ✅ Enums: All 6 user_role values present (admin, club_admin, team_manager, coach, parent, player)

## Migration Order Dependencies

- 014: Independent (builds on 013's starting_lineups)
- 015: Independent (profile enhancements)
- 016: Depends on 015 (references must_change_password indirectly via password flows)
- 017: Depends on 016 (references game_guest_players, player RLS policies from 016)

## Remote DB Status

- Migrations 001-013: ✅ Already applied to remote
- Migrations 014-017: ⏳ Unapplied, ready for `supabase db push`
