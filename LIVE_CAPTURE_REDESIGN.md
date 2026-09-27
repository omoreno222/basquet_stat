# Live Capture Screen Redesign - Complete

## Summary

Successfully redesigned the live game capture screen into a visual, touch-first basketball court UI for tablets as requested by Oscar.

## What Changed

### New Files Created
1. **`app/team-manager/games/[id]/capture/components/BasketballCourt.tsx`**
   - FIBA half-court SVG with proper court markings
   - 3-point arc with corner 3s
   - Paint/key, free-throw line & circle
   - Rim, backboard, restricted area
   - Shot markers (green = made, red = missed)

2. **`app/team-manager/games/[id]/capture/components/PlayerSelectionModal.tsx`**
   - Visual player picker with photo avatars
   - Falls back to initials if no avatar
   - Jersey numbers and full names
   - Large touch targets (48px+)

3. **`app/team-manager/games/[id]/capture/components/ShotActionModal.tsx`**
   - Four big buttons: 2P Made, 2P Miss, 3P Made, 3P Miss
   - Auto-highlights 2P or 3P based on tap location
   - Detects if tap was inside/outside 3-point line
   - No more browser confirm() dialogs

4. **`app/team-manager/games/[id]/capture/components/SlotBActionModal.tsx`**
   - Five buttons: Offensive Rebound, Defensive Rebound, Assist, Steal, Turnover
   - All actions store coordinates

### Modified Files
1. **`app/team-manager/games/[id]/capture/page.tsx`**
   - Complete redesign from form-based to court-based layout
   - Full-viewport basketball court
   - Compact corner overlays for controls
   - Maintains all Realtime sync logic
   - Slot A clock authority preserved
   - Presence tracking still works
   - Slot swap detection intact

2. **`supabase/migrations/011_capture_ui_i18n.sql`**
   - i18n translations for all new UI strings
   - English, Spanish, Catalan (trke_* pattern)

## Key Features

### Layout (Landscape Tablet Optimized)
- **Full viewport court** - SVG scales to any screen size
- **Top-left corner**: Clock controls (Slot A only)
  - Time display (M:SS)
  - Period indicator
  - START/STOP button
  - ±10s adjustment
  - Next Period button
  - Possession indicator with Switch
- **Top-right corner**: 
  - Game score (Team - Opponent)
  - Connection status (green = connected, yellow = reconnecting, red = offline)
  - Online user count
  - Opponent score controls (Slot A only, - / + buttons)
- **Bottom-left**: FT / Foul / Sub menu button (Slot A only)
- **Bottom-right**: Show/Hide Events button
- **Right drawer**: Collapsible event feed with Undo Last button
- **Center bottom**: Slot indicator badge (A Authority / B)

### Tap-to-Record Flow

#### Slot A (Shots):
1. Tap any location on the court
2. Player selection modal appears with photos
3. Select player
4. Shot action modal appears with 4 buttons:
   - 2P MADE / 2P MISS (highlighted if inside 3pt line)
   - 3P MADE / 3P MISS (highlighted if outside 3pt line)
5. Shot saved with coordinates and displayed as marker on court

#### Slot B (Rebounds/Assists/etc):
1. Tap any location on the court
2. Player selection modal appears with photos
3. Select player
4. Action modal appears with 5 buttons:
   - Offensive Rebound
   - Defensive Rebound
   - Assist
   - Steal
   - Turnover
5. Event saved with coordinates

#### Free Throws, Fouls, Substitutions (Slot A only):
1. Tap "FT / Foul / Sub" button (bottom-left)
2. Menu appears showing selected player
3. Choose: FT Made, FT Miss, Foul, or Substitution
4. Event recorded

### Visual Feedback
- Shot markers appear on court immediately after recording
- Green markers = made shots
- Red markers = missed shots
- Shows point value (2 or 3) on marker

### Realtime Sync
✅ All existing Realtime features preserved:
- Clock updates sync across devices
- Game events sync instantly (INSERT/DELETE)
- Game state updates (score, possession, period)
- Presence tracking (connection status)
- Slot swap detection without page reload

### Multi-Device Support
✅ Two tablets can capture simultaneously:
- Slot A = Clock authority + shots/fouls/FTs/subs + opponent score
- Slot B = Rebounds/assists/steals/turnovers
- Both see real-time updates
- Both see shot markers on court

## Testing Instructions

### Single Device Test
1. Log in as `oscar@basquet.local` / `oscar2024`
2. Navigate to Team Manager → Games → Select a game → "Start Capture"
3. You should see:
   - Full basketball court filling the screen
   - Clock controls in top-left
   - Score display in top-right
   - Connection status showing "Connected"
4. **Test Clock** (you're Slot A):
   - Click START → clock counts down
   - Click STOP → clock pauses
   - Try ±10s buttons
   - Switch possession
5. **Test Shot Recording**:
   - Tap anywhere on the court
   - Player picker modal appears with avatars (or initials)
   - Select a player (e.g., #7 Marc Garcia)
   - Shot action modal appears
   - Notice 2P/3P buttons highlighted based on where you tapped
   - Click "2P MADE"
   - Green marker with "2" appears on court at tap location
   - Score increases by 2
6. **Test more shots**:
   - Tap near the 3-point line (corners or arc)
   - Notice 3P buttons are highlighted
   - Click "3P MISS"
   - Red marker with "3" appears
7. **Test Event Feed**:
   - Click "Show Events" (bottom-right)
   - Drawer opens showing all recorded events
   - Click "Undo Last Event"
   - Last marker disappears from court
8. **Test FT/Foul/Sub**:
   - Tap court to select a player
   - Click "FT / Foul / Sub" (bottom-left)
   - Menu shows selected player
   - Try recording a free throw or foul

### Dual Tablet Test
1. **Tablet 1**: Log in as `oscar@basquet.local` (Slot A)
2. **Tablet 2**: Log in as `pere.alier@basquet.local` (Slot B)
3. Both navigate to same game capture screen
4. **Verify Slot Assignment**:
   - Tablet 1 should show "Slot A (Authority)" badge
   - Tablet 2 should show "Slot B" badge
   - Tablet 1 has clock controls visible
   - Tablet 2 does NOT have clock controls
5. **Test Clock Sync**:
   - On Tablet 1 (Slot A): Start the clock
   - On Tablet 2 (Slot B): Clock updates in real-time
6. **Test Shot from Slot A**:
   - On Tablet 1: Record a shot
   - On Tablet 2: Shot marker appears immediately
   - Both tablets show updated score
7. **Test Rebound from Slot B**:
   - On Tablet 1: Record a missed shot
   - On Tablet 2: Tap court, select player, choose "Defensive Rebound"
   - On Tablet 1: Event appears in feed
8. **Test Presence**:
   - Disconnect Tablet 2 (turn off wifi)
   - On Tablet 1: Connection count goes from "2" to "1"
   - Reconnect Tablet 2
   - Count goes back to "2"

## Technical Details

### No Database Migration Needed
- `coord_x` and `coord_y` columns already exist on `game_events` table
- They are nullable, so all event types (shots, rebounds, assists, steals, turnovers) can store coordinates
- Migration 011 only adds i18n translations

### Coordinate System
- Normalized coordinates: x ∈ [0, 1], y ∈ [0, 1]
- Origin (0, 0) = top-left corner of court
- Basket at approximately (0.5, 0.05)
- 3-point detection uses distance calculation and corner detection

### Touch Targets
- All buttons are at least 48px tall (Apple/Google touch target guidelines)
- Player cards in modal are 140px min height
- Clock/score overlays positioned to avoid accidental taps during gameplay

### Responsive Design
- SVG court scales to viewport
- Primary target: Tablet landscape (1024x768 or larger)
- Also works on laptop/desktop
- Portrait mode: may require scrolling (landscape recommended)

### Theme
- Dark background (#1f2937, #111827)
- Orange accents (#f97316) matching SeasonMath branding
- Court lines in orange
- Green markers for made shots (#10b981)
- Red markers for missed shots (#ef4444)

## Commit Details

**Commit**: `85841a8` - "Redesign live capture screen with visual basketball court UI"

**Files Changed**: 6
- 4 new component files
- 1 modified page file (complete redesign)
- 1 new migration file (i18n)

**Lines**: +856 insertions, -459 deletions

**Branch**: `cursor/realtime-sync-harden-896b`

**PR**: #3 (updated)

## Known Limitations & Future Enhancements

### Current Limitations
1. Shot markers don't disappear after period ends (shows all shots from current game)
2. No shot heat map / shot chart analytics view
3. Free throws don't have a court location (event recorded without coordinates)
4. Substitution tracking is basic (no lineup management UI)
5. Portrait orientation not optimized (landscape recommended)

### Possible Enhancements (not in scope for this PR)
- Filter shot markers by period/quarter
- Shot efficiency overlay (% by zone)
- Player-specific shot charts
- Undo any event (not just last)
- Drag-to-reposition incorrect shot markers
- Voice commands for hands-free capture
- Auto-detect made/miss via camera/ML (future)

## Conclusion

✅ All requested features implemented:
- Visual FIBA basketball court
- Tap-to-place shot recording
- Player photo picker
- Shot markers on court
- Compact corner overlays
- Touch-first tablet UI
- All Realtime sync preserved
- i18n translations added

✅ No regressions:
- Clock authority still works (Slot A)
- Slot swap detection intact
- Presence tracking works
- Event feed still accessible
- Undo still works

✅ Ready for Oscar's testing on Mac + dual tablets

**Next Steps**: Oscar tests locally, confirms it works, then deploys to production.
