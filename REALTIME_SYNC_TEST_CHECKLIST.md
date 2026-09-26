# Dual-Tablet Realtime Sync Testing Checklist

## Pre-Test Setup
- [ ] Run migrations 006 and 007 on Supabase instance
- [ ] Verify Realtime is enabled in Supabase Dashboard (Settings → API → Realtime)
- [ ] Create a test game with slot_a_user_id and slot_b_user_id assigned
- [ ] Have two devices/browsers ready (or two browser windows in incognito/different profiles)

## Device A (Slot A - Clock Authority)

### Clock Control
- [ ] Start clock - verify it counts down smoothly
- [ ] Pause clock - verify it stops
- [ ] Adjust clock (+10s, -10s) - verify time changes
- [ ] Next period - verify period increments and clock resets to 10:00
- [ ] Clock reaches zero - verify it auto-stops and shows alert

### Game State Control
- [ ] Change possession - verify possession indicator updates
- [ ] Record 2PT shot (made) - verify score increments
- [ ] Record 3PT shot (made) - verify score increments by 3
- [ ] Record free throw - verify score increments by 1
- [ ] Record 2PT shot (miss) - verify score stays same, possession changes
- [ ] Adjust opponent score (+/-) - verify opponent score changes

### Events
- [ ] Record foul - verify event appears in feed
- [ ] Record turnover - verify event appears in feed
- [ ] Undo last event - verify event removed from feed and score reverted if needed

## Device B (Slot B - View Only Clock)

### Realtime Sync Reception
- [ ] All clock changes from A appear immediately on B
- [ ] Clock ticker on B reflects A's clock without drift
- [ ] Possession changes from A appear on B
- [ ] Score changes from A appear on B (both team and opponent)
- [ ] Period changes from A appear on B
- [ ] All events from A appear in B's event feed

### Slot B Actions
- [ ] After missed shot on A, B sees rebound overlay
- [ ] Record rebound from B - verify event appears on both A and B
- [ ] After made shot on A, B sees assist overlay
- [ ] Record assist from B - verify event appears on both A and B
- [ ] Record steal from B - verify event appears on both A and B
- [ ] Record turnover from B - verify event appears on both A and B
- [ ] Undo event from B - verify removed from both devices

## Connection Status & Presence

### On Both Devices
- [ ] Connection indicator shows "Connected" with green dot when online
- [ ] Both devices show "2 online" or presence count
- [ ] Disconnect one device's internet - verify shows "Reconnecting..." (yellow)
- [ ] Reconnect internet - verify returns to "Connected" (green)
- [ ] Close one device's browser - verify other device shows "1 online"

## Cross-Device Event Sync
- [ ] Record shot on A → immediate INSERT event on B (no full page reload)
- [ ] Record rebound on B → immediate INSERT event on A
- [ ] Undo event on A → immediate DELETE event on B
- [ ] No duplicate events appear
- [ ] Events maintain correct chronological order

## Slot Swap Mid-Game

### Admin/Manager Changes Slots
- [ ] Admin changes slot_a_user_id and slot_b_user_id in game management
- [ ] Device A loses clock controls if no longer Slot A
- [ ] Device B gains clock controls if now Slot A
- [ ] Both devices show updated slot assignment in header
- [ ] No page reload required (Realtime update)
- [ ] Clock ticker stops on device that lost Slot A authority

## No Dual-Clock Drift
- [ ] Start clock on A, wait 2 minutes
- [ ] Compare clock display on A vs B - should be within 1 second (no cumulative drift)
- [ ] Verify B is NOT running its own ticker (only A writes to DB)
- [ ] Pause on A - B immediately reflects pause
- [ ] Resume on A - B immediately reflects running state

## Edge Cases
- [ ] Both devices try to undo same event simultaneously - verify graceful handling
- [ ] Record events rapidly on both devices - verify all appear correctly
- [ ] Clock reaches zero during rapid event entry - verify period ends gracefully
- [ ] Mid-game, close and reopen browser tab - verify state restored from DB
- [ ] Start game on A, join late on B - B immediately shows current game state

## Performance & UX
- [ ] Event feed updates without janky UI re-renders
- [ ] Score updates don't cause visible flicker
- [ ] Clock countdown is smooth on both devices (no jank every 3 seconds)
- [ ] Connection indicator doesn't blink unnecessarily
- [ ] Presence count updates smoothly when users join/leave

## Fallback to Supabase Dashboard (if migration fails programmatically)
If migration 006 fails to add tables to realtime publication:
- [ ] Go to Supabase Dashboard → Database → Replication
- [ ] Ensure `supabase_realtime` publication includes `games` and `game_events`
- [ ] Set both tables to REPLICA IDENTITY FULL
- [ ] Restart Realtime in Supabase Dashboard → Project Settings → API → Realtime (toggle off/on)

## Known Issues / Future Enhancements
- Currently no i18n for alerts (hardcoded English strings in confirm/alert)
- Connection indicator shows count but not detailed user names/slots
- No visual "Slot B user is typing..." indicator
- No conflict resolution UI if both users try to undo different events

## Test Result Summary
- Date: _______________
- Tester: _______________
- Supabase Environment: _______________
- Overall Result: [ ] PASS [ ] FAIL (describe issues below)
- Issues Found:


