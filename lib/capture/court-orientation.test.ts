import { describe, expect, it } from 'vitest';
import { courtOrientationFromLegacy, courtOrientationFromReading } from './court-orientation';

describe('court orientation', () => {
  it('places the table on the right bezel for a phone, whose natural hold is portrait', () => {
    expect(courtOrientationFromReading({ type: 'portrait-primary', angle: 0 })).toEqual({
      courtTurn: -90,
      tableOnBottom: true,
      logoInverted: false,
    });
    expect(courtOrientationFromReading({ type: 'portrait-secondary', angle: 180 })).toEqual({
      courtTurn: 90,
      tableOnBottom: true,
      logoInverted: false,
    });
    expect(courtOrientationFromReading({ type: 'landscape-secondary', angle: 270 })).toEqual({
      courtTurn: 0,
      tableOnBottom: true,
      logoInverted: false,
    });
    expect(courtOrientationFromReading({ type: 'landscape-primary', angle: 90 })).toEqual({
      courtTurn: 0,
      tableOnBottom: false,
      logoInverted: true,
    });
  });

  it('places the table on the right bezel for a tablet, whose natural hold is landscape', () => {
    expect(courtOrientationFromReading({ type: 'portrait-primary', angle: 90 })).toEqual({
      courtTurn: -90,
      tableOnBottom: true,
      logoInverted: false,
    });
    expect(courtOrientationFromReading({ type: 'portrait-secondary', angle: 270 })).toEqual({
      courtTurn: 90,
      tableOnBottom: true,
      logoInverted: false,
    });
    expect(courtOrientationFromReading({ type: 'landscape-primary', angle: 0 })).toEqual({
      courtTurn: 0,
      tableOnBottom: true,
      logoInverted: false,
    });
    expect(courtOrientationFromReading({ type: 'landscape-secondary', angle: 180 })).toEqual({
      courtTurn: 0,
      tableOnBottom: false,
      logoInverted: true,
    });
  });

  it('reads the legacy window.orientation only as upright, top-left, upside-down, and top-right', () => {
    expect(courtOrientationFromLegacy(0).courtTurn).toBe(-90);
    expect(courtOrientationFromLegacy(180).courtTurn).toBe(90);
    expect(courtOrientationFromLegacy(-90)).toEqual({
      courtTurn: 0,
      tableOnBottom: true,
      logoInverted: false,
    });
    expect(courtOrientationFromLegacy(90)).toEqual({
      courtTurn: 0,
      tableOnBottom: false,
      logoInverted: true,
    });
  });
});
