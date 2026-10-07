export type CourtTurn = 0 | 90 | -90;

export type CourtOrientation = {
  /** CSS rotation of the landscape court drawing. 0 when the device is held landscape. */
  courtTurn: CourtTurn;
  /** Table on the bottom edge of the unrotated drawing. After courtTurn it meets the device's right bezel. */
  tableOnBottom: boolean;
  /** Flip the center logo so it reads from the scorer sitting at the table. */
  logoInverted: boolean;
};

type OrientationType =
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

const ORIENTATION_TYPES: readonly OrientationType[] = [
  'portrait-primary',
  'portrait-secondary',
  'landscape-primary',
  'landscape-secondary',
];

/**
 * The drawn table stays on the physical right edge of the device: the edge
 * that is on the right when the device is held in upright portrait.
 *
 * Clockwise from that hold:
 *   0°   upright portrait              → right
 *   90°  top of the device to the right → bottom
 *   180° upside-down portrait          → left
 *   270° top of the device to the left  → top
 *
 * `screen.orientation.angle` is counter-clockwise from the device's natural
 * orientation. Phones are naturally portrait (angle 0 = upright). Tablets are
 * naturally landscape (angle 0 = landscape-primary), so angle 0 is not upright.
 */
export function courtOrientationFromReading(reading: { type: string; angle: number }): CourtOrientation {
  const type = isOrientationType(reading.type) ? reading.type : 'landscape-primary';
  const angle = quarterAngle(reading.angle);
  const uprightAngle = naturalIsLandscape(type, angle) ? 90 : 0;
  const clockwise = (uprightAngle - angle + 360) % 360;

  if (clockwise === 0) return { courtTurn: -90, tableOnBottom: true, logoInverted: false };
  if (clockwise === 180) return { courtTurn: 90, tableOnBottom: true, logoInverted: false };
  if (clockwise === 90) return { courtTurn: 0, tableOnBottom: true, logoInverted: false };
  return { courtTurn: 0, tableOnBottom: false, logoInverted: true };
}

/**
 * `window.orientation` when `screen.orientation` is missing.
 * 0 upright portrait, 90 top of the device to the left, -90 top to the right, 180 upside down.
 */
export function courtOrientationFromLegacy(windowOrientation: number): CourtOrientation {
  const legacy = quarterAngle(windowOrientation);
  if (legacy === 90) return courtOrientationFromReading({ type: 'landscape-primary', angle: 90 });
  if (legacy === 270) return courtOrientationFromReading({ type: 'landscape-secondary', angle: 270 });
  if (legacy === 180) return courtOrientationFromReading({ type: 'portrait-secondary', angle: 180 });
  return courtOrientationFromReading({ type: 'portrait-primary', angle: 0 });
}

export function readCourtOrientation(): CourtOrientation {
  if (typeof window === 'undefined') {
    return courtOrientationFromReading({ type: 'landscape-primary', angle: 0 });
  }
  const orientation = window.screen?.orientation;
  if (orientation?.type && typeof orientation.angle === 'number') {
    return courtOrientationFromReading({ type: orientation.type, angle: orientation.angle });
  }
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (typeof legacy === 'number') return courtOrientationFromLegacy(legacy);
  return courtOrientationFromReading({ type: 'landscape-primary', angle: 0 });
}

function isOrientationType(type: string): type is OrientationType {
  return (ORIENTATION_TYPES as readonly string[]).includes(type);
}

function naturalIsLandscape(type: OrientationType, angle: number): boolean {
  const landscapeType = type === 'landscape-primary' || type === 'landscape-secondary';
  return landscapeType === (angle % 180 === 0);
}

function quarterAngle(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((angle % 360) + 360) % 360;
  const snapped = (Math.round(normalized / 90) * 90) % 360;
  if (snapped === 90 || snapped === 180 || snapped === 270) return snapped;
  return 0;
}
