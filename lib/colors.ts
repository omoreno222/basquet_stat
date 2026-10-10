export const DEFAULT_OPPONENT_COLOR = '#737373';

export const OPPONENT_JERSEY_COLORS = [
  '#ffffff',
  '#171717',
  '#dc2626',
  '#1d4ed8',
  '#eab308',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#737373',
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeHexColor(value: string | null | undefined, fallback = DEFAULT_OPPONENT_COLOR) {
  if (!value || !HEX_COLOR.test(value)) return fallback;
  return value.toLowerCase();
}

/** Text color that stays readable on a solid jersey background. */
export function inkOn(hex: string) {
  const value = normalizeHexColor(hex);
  const red = parseInt(value.slice(1, 3), 16);
  const green = parseInt(value.slice(3, 5), 16);
  const blue = parseInt(value.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? '#171717' : '#ffffff';
}
