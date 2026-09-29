import { describe, expect, it } from 'vitest';
import { assignmentComplete, userCanOpenLiveGame } from './live-access';

const userId = 'user-1';

describe('assignmentComplete', () => {
  it('needs both recorders unless the game has a single recorder', () => {
    expect(assignmentComplete({
      singleRecorder: false,
      slotAUserId: userId,
      slotBUserId: 'user-2',
    })).toBe(true);
    expect(assignmentComplete({
      singleRecorder: true,
      slotAUserId: userId,
      slotBUserId: null,
    })).toBe(true);
    expect(assignmentComplete({
      singleRecorder: false,
      slotAUserId: userId,
      slotBUserId: null,
    })).toBe(false);
    expect(assignmentComplete({
      singleRecorder: true,
      slotAUserId: null,
      slotBUserId: null,
    })).toBe(false);
  });
});

describe('userCanOpenLiveGame', () => {
  it('lets an assigned recorder open a complete live game', () => {
    expect(userCanOpenLiveGame({
      status: 'live',
      userId,
      singleRecorder: false,
      slotAUserId: userId,
      slotBUserId: 'user-2',
    })).toBe(true);
    expect(userCanOpenLiveGame({
      status: 'live',
      userId,
      singleRecorder: false,
      slotAUserId: 'user-2',
      slotBUserId: userId,
    })).toBe(true);
    expect(userCanOpenLiveGame({
      status: 'live',
      userId,
      singleRecorder: true,
      slotAUserId: userId,
      slotBUserId: null,
    })).toBe(true);
  });

  it('stays closed when the game is not live, a recorder is missing, or the user is not assigned', () => {
    expect(userCanOpenLiveGame({
      status: 'scheduled',
      userId,
      singleRecorder: false,
      slotAUserId: userId,
      slotBUserId: 'user-2',
    })).toBe(false);
    expect(userCanOpenLiveGame({
      status: 'live',
      userId,
      singleRecorder: false,
      slotAUserId: userId,
      slotBUserId: null,
    })).toBe(false);
    expect(userCanOpenLiveGame({
      status: 'live',
      userId,
      singleRecorder: false,
      slotAUserId: 'other',
      slotBUserId: 'user-2',
    })).toBe(false);
  });
});
