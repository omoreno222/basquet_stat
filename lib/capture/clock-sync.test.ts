import { describe, expect, it } from 'vitest';
import { nextClockFromRemote, type ClockView } from './clock-sync';

const local: ClockView = { running: false, remainingMs: 482300, period: 2 };

describe('nextClockFromRemote', () => {
  it('follows the server until this tablet takes the clock', () => {
    const remote: ClockView = { running: true, remainingMs: 500000, period: 2 };
    expect(nextClockFromRemote(local, remote, false)).toEqual(remote);
  });

  it('does not restart a stopped clock from a sync echo that still says running', () => {
    const remote: ClockView = { running: true, remainingMs: 485000, period: 2 };
    expect(nextClockFromRemote(local, remote, true)).toEqual(local);
  });

  it('does not rewind a running clock to the value written when it was started', () => {
    const running: ClockView = { running: true, remainingMs: 597400, period: 1 };
    const startEcho: ClockView = { running: true, remainingMs: 600000, period: 1 };
    expect(nextClockFromRemote(running, startEcho, true)).toEqual(running);
  });

  it('does not move a stopped clock back to the time captured when the stop was sent', () => {
    const remote: ClockView = { running: false, remainingMs: 483100, period: 2 };
    expect(nextClockFromRemote(local, remote, true)).toEqual(local);
  });

  it('does not apply an echo from the previous period', () => {
    const remote: ClockView = { running: true, remainingMs: 12000, period: 1 };
    expect(nextClockFromRemote(local, remote, true)).toEqual(local);
  });
});
