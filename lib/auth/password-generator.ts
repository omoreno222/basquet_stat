import { randomBytes } from 'crypto';

// Character sets excluding ambiguous characters (0, O, l, 1, I)
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

const ALL_CHARS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

/**
 * Generate a strong random password
 * - 16 characters long
 * - Contains uppercase, lowercase, digits, and symbols
 * - Guaranteed at least one character from each set
 * - Excludes ambiguous characters (0, O, l, 1, I)
 */
export function generatePassword(): string {
  // Ensure at least one character from each set
  const requiredChars = [
    UPPERCASE[randomInt(UPPERCASE.length)],
    LOWERCASE[randomInt(LOWERCASE.length)],
    DIGITS[randomInt(DIGITS.length)],
    SYMBOLS[randomInt(SYMBOLS.length)],
  ];

  // Fill remaining 12 characters randomly from all sets
  const remainingChars: string[] = [];
  for (let i = 0; i < 12; i++) {
    remainingChars.push(ALL_CHARS[randomInt(ALL_CHARS.length)]);
  }

  // Combine and shuffle using Fisher-Yates algorithm
  const allChars = [...requiredChars, ...remainingChars];
  for (let i = allChars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [allChars[i], allChars[j]] = [allChars[j], allChars[i]];
  }

  return allChars.join('');
}

/**
 * Generate a cryptographically secure random integer between 0 (inclusive) and max (exclusive)
 */
function randomInt(max: number): number {
  // Use rejection sampling to avoid modulo bias
  const range = Math.floor(256 / max) * max;
  let value: number;
  
  do {
    value = randomBytes(1)[0];
  } while (value >= range);
  
  return value % max;
}

/**
 * Validate password meets requirements
 */
export function validateGeneratedPassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length !== 16) {
    errors.push('Password must be exactly 16 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one symbol');
  }

  // Check for ambiguous characters
  if (/[0OlI1]/.test(password)) {
    errors.push('Password contains ambiguous characters (0, O, l, 1, I)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
