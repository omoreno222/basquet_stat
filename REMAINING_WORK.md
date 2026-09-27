# Remaining Work Summary

## ✅ Section 1: COMPLETE - Migrations Consolidated
- Deleted duplicate migrations 018 and 019
- Merged translation keys into 015
- Fixed migration 017 CHECK constraint blocking club_admin
- Tested fresh apply and idempotency
- All migrations 014-017 ready for `supabase db push`

## ✅ Section 2: COMPLETE - Password Auth
- `/profile` now uses `changeEmailWithPassword()` with current password verification
- `/profile` now uses `changePasswordWithCurrent()` with current password verification
- Fixed `EMAIL_FROM` default to `SeasonMath <no-reply@seasonmath.com>`
- Fixed `EMAIL_REPLY_TO` default to `support@seasonmath.com`
- Fixed bug: `profile_roles.profile_id` (was incorrectly `user_id`)
- Added current password fields to email/password change forms
- Added unit test structure for password-auth functions
- Magic link/OTP code already removed (none found)
- `createUserWithPassword()` respects `club_id` parameter

## 🚧 Section 3: INCOMPLETE - Game UI Features (Estimated 60% complete)

### ✅ Already Done
- Game start window with 30-min countdown
- Admin override
- Periodic countdown updates
- Scorer's table marker
- Choose-side modal at game start

### ❌ Remaining

#### FIBA Period Labels
**Status**: NOT DONE
**Location**: `app/team-manager/games/[id]/capture/page.tsx` lines 1064, 1111
**Current**: Displays "P1", "P2", "P3", etc.
**Required**: Display "Q1", "Q2", "Q3", "Q4", "OT1", "OT2", etc.

**Implementation**:
1. Create helper function:
```typescript
function getPeriodLabel(period: number): string {
  if (period <= 4) return `Q${period}`;
  return `OT${period - 4}`;
}
```

2. Replace `P{currentPeriod}` with `{getPeriodLabel(currentPeriod)}` in:
   - Top bar clock display (line 1064)
   - Score block display (line 1111)
   - Event feed (search for period display in event rendering)

#### Auto-Close Game Logic
**Status**: PARTIALLY DONE (function exists in migration 016, not implemented in UI)
**Location**: `app/team-manager/games/[id]/capture/page.tsx`
**Required**:
1. At end of Q4 or OT (clock reaches 0:00):
   - Check if tied: `teamScore === opponentScore`
   - If NOT tied:
     - Set `games.status = 'final'` via Supabase update
     - Stop clock
     - Show overlay: "Game Finished" with final score
     - Block further event recording (trigger exists in migration 016)
   - If tied:
     - Auto-start next OT at 5:00 (300,000 ms)
     - Label as OT1, OT2, etc.

2. Implement in `nextPeriod()` function around line 902

#### Menu Button
**Status**: NOT DONE
**Location**: Top bar (currently has START/STOP, Next, Flip, Poss)
**Required**:
- Add compact menu icon button (☰ or ⋮) in top bar
- On click: navigate to `/team-manager/games/${gameId}` WITHOUT ending game
- If clock is running when leaving: show confirm dialog "Clock will be paused when you leave. Continue?"
- Returning to capture page restores all state (clock, score, period)

**Implementation**:
```tsx
<button
  onClick={() => {
    if (clockRunning) {
      if (confirm(t.trke_clock_will_pause || 'Clock will be paused. Continue?')) {
        router.push(`/team-manager/games/${gameId}`);
      }
    } else {
      router.push(`/team-manager/games/${gameId}`);
    }
  }}
  className="px-2 py-2 bg-gray-700 hover:bg-gray-600 rounded"
  title="Back to Game"
>
  ☰
</button>
```

#### Guest Players
**Status**: NOT DONE
**Location**: New modal + integration in capture page
**Required**:
1. Create `GuestPlayerModal.tsx` component
2. "Add Guest Player" button in lineup screen and capture page
3. Modal features:
   - Search players from **same club**, **other teams** (query: `SELECT * FROM players WHERE club_id = ? AND team_id != ?`)
   - Display: photo, name, team name, jersey number
   - Optional jersey override input (if duplicate)
   - Insert into `game_guest_players` table
4. Guest players appear in ALL pickers:
   - Shots, Free Throws, Fouls, Substitutions, Lineup, Minutes
   - Show "Guest" tag + team name next to player name
5. Realtime sync: subscribe to `game_guest_players` table changes

**Database**: Table already exists in migration 016

#### Free Throw Marker Positions
**Status**: INCORRECT POSITIONS
**Location**: `app/team-manager/games/[id]/capture/components/BasketballCourt.tsx` and `FreeThrowModal.tsx`
**Problem**: FT markers don't align with drawn FT line

**FIBA Court Constants** (all positions should derive from these):
```typescript
const COURT_WIDTH = 2800;  // pixels (15m court)
const COURT_HEIGHT = 1500; // pixels (28m court)
const VIEWBOX_HEIGHT = 1560; // 1500 + 60 for scorer's table

// Free throw line: 5.8m from endline, centered at y=7.5m
const FT_LINE_FROM_ENDLINE = 5.8 / 28; // 0.207 in normalized
const FT_LINE_CENTER_Y = 0.5; // centered at 7.5m
const FT_LINE_X_LEFT = 0.207;  // 580 / 2800
const FT_LINE_X_RIGHT = 0.793; // 2220 / 2800
```

**Required**:
1. Draw FT line in court SVG at x=580 and x=2220 (3.6m long, centered)
2. FT markers for multi-shot sets:
   - 1 shot: center at y=750
   - 2 shots: y=[690, 810]
   - 3 shots: y=[690, 750, 810]
3. Respect attacking basket (left vs right) per period
4. Same positions in shot maps/charts

#### Tests
**Status**: NOT DONE
**Required**:
- Unit test for `getPeriodLabel()`
- Unit test for auto-close logic (tied vs not tied)
- Unit test for FT position helper
- Integration test for menu button navigation

## 🚧 Section 4: INCOMPLETE - Screenshots

**Status**: NOT REQUIRED YET (do after Section 3 is complete)
**Approach**: Playwright with headless Chromium OR dev-only preview route
**Required Screenshots**:
- (a) Court with scorer's table marker, both orientations
- (b) Choose-side modal
- (c) FT markers (made=green, missed=red) on both baskets, 3-shot set
- (d) Capture top bar with menu button
- (e) `/profile` page in light and dark mode
- (f) Navbar with avatar, name, role pills, club logo
- (g) `/admin/clubs` page

**Save to**: `/opt/cursor/artifacts/screenshots/`

## 🚧 Section 5: INCOMPLETE - Final Quality

**Status**: PARTIALLY DONE
- ✅ TypeScript: 0 errors (`npx tsc --noEmit`)
- ✅ Build: Success (`npm run build`)
- ⚠️ Lint: 4 warnings (acceptable, unused imports for future)
- ⚠️ Tests: Need to run after fixes
- ❌ Dead code cleanup: Pending
- ❌ PR description update: Pending

**Required**:
1. Run `npm run lint` and fix any NEW warnings (keep existing 4)
2. Run `npm run test:run` and ensure all pass
3. Remove dead code:
   - Unused functions
   - Unused styles
   - Unused components
   - Unused translation keys
4. Update PR #3 description with:
   - Final env vars needed in `.env.local`
   - Supabase Auth settings to change (specific setting names)
   - Final migration list 014-017
   - Manual test checklist per feature

---

## Priority Order

1. **HIGH**: Period labels Q1-Q4, OT1, OT2 (simple, high visibility)
2. **HIGH**: Menu button (important UX, simple to add)
3. **MEDIUM**: Auto-close game logic (important feature, moderate complexity)
4. **MEDIUM**: FT marker fix (visible bug, requires math)
5. **LOW**: Guest players (complex, less critical for MVP)
6. **LAST**: Screenshots (after all features work)
7. **LAST**: Final quality checks and PR description

## Time Estimates

- Period labels: 15 minutes
- Menu button: 20 minutes
- Auto-close logic: 45 minutes
- FT markers: 1 hour
- Guest players: 2-3 hours
- Screenshots: 1 hour
- Quality checks: 30 minutes

**Total remaining**: ~6-7 hours of focused work
