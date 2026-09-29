import { describe, it, expect } from 'vitest';
import { getInitials, validatePhone, validateEmail, validatePassword, getRoleBadgeClasses } from './profile-utils';

describe('getInitials', () => {
  it('should return initials from first and last name', () => {
    expect(getInitials('John', 'Doe')).toBe('JD');
    expect(getInitials('Alice', 'Smith')).toBe('AS');
  });

  it('should handle single name by splitting', () => {
    expect(getInitials('John Doe', null)).toBe('JD');
    expect(getInitials('Alice Marie Smith', null)).toBe('AS');
  });

  it('should use first two characters for single word', () => {
    expect(getInitials('John', null)).toBe('JO');
    expect(getInitials('Al', null)).toBe('AL');
  });

  it('should handle single character names', () => {
    expect(getInitials('J', null)).toBe('JJ');
  });

  it('should return ?? for empty name', () => {
    expect(getInitials('', null)).toBe('??');
    expect(getInitials(null, null)).toBe('??');
    expect(getInitials(undefined, undefined)).toBe('??');
  });

  it('should handle names with extra whitespace', () => {
    expect(getInitials('  John  ', '  Doe  ')).toBe('JD');
  });

  it('should return uppercase initials', () => {
    expect(getInitials('john', 'doe')).toBe('JD');
    expect(getInitials('alice smith', null)).toBe('AS');
  });
});

describe('validatePhone', () => {
  it('should accept valid phone numbers', () => {
    expect(validatePhone('123-456-7890')).toBe(true);
    expect(validatePhone('(123) 456-7890')).toBe(true);
    expect(validatePhone('+1 234 567 8900')).toBe(true);
    expect(validatePhone('1234567890')).toBe(true);
  });

  it('should accept empty phone (optional field)', () => {
    expect(validatePhone('')).toBe(true);
    expect(validatePhone('  ')).toBe(true);
  });

  it('should reject phone numbers with too few digits', () => {
    expect(validatePhone('12345')).toBe(false);
    expect(validatePhone('123')).toBe(false);
  });

  it('should reject phone numbers with invalid characters', () => {
    expect(validatePhone('123-456-789a')).toBe(false);
    expect(validatePhone('phone number')).toBe(false);
  });

  it('should accept international formats', () => {
    expect(validatePhone('+34 666 777 888')).toBe(true);
    expect(validatePhone('+44 20 7946 0958')).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.user@domain.co.uk')).toBe(true);
    expect(validateEmail('name+tag@example.org')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('missing@domain')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(validateEmail('  ')).toBe(false);
    expect(validateEmail(' user@example.com ')).toBe(false); // Leading/trailing space
  });
});

describe('validatePassword', () => {
  it('should accept passwords with 8+ characters', () => {
    expect(validatePassword('password123')).toEqual({ valid: true });
    expect(validatePassword('abcdefgh')).toEqual({ valid: true });
    expect(validatePassword('P@ssw0rd!')).toEqual({ valid: true });
  });

  it('should reject passwords with less than 8 characters', () => {
    const result = validatePassword('pass123');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('8 characters');
  });

  it('should reject empty passwords', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Password is required');
  });
});

describe('getRoleBadgeClasses', () => {
  it('should return appropriate classes for each role', () => {
    expect(getRoleBadgeClasses('admin')).toContain('bg-red-600');
    expect(getRoleBadgeClasses('admin')).toContain('text-white');
    expect(getRoleBadgeClasses('club_admin')).toContain('bg-indigo-700');
    expect(getRoleBadgeClasses('club_admin')).toContain('text-white');
    expect(getRoleBadgeClasses('team_manager')).toContain('bg-white');
    expect(getRoleBadgeClasses('team_manager')).toContain('text-blue-800');
    expect(getRoleBadgeClasses('coach')).toContain('bg-green-700');
    expect(getRoleBadgeClasses('parent')).toContain('bg-purple-600');
    expect(getRoleBadgeClasses('player')).toContain('bg-orange-700');
  });

  it('should stay readable on the navy header in both themes', () => {
    expect(getRoleBadgeClasses('admin')).toContain('dark:bg-red-300');
    expect(getRoleBadgeClasses('admin')).toContain('dark:text-red-950');
    expect(getRoleBadgeClasses('club_admin')).toContain('dark:bg-indigo-300');
    expect(getRoleBadgeClasses('club_admin')).toContain('dark:text-indigo-950');
    expect(getRoleBadgeClasses('team_manager')).toContain('dark:bg-sky-200');
    expect(getRoleBadgeClasses('team_manager')).toContain('dark:text-sky-950');
    expect(getRoleBadgeClasses('coach')).toContain('dark:bg-green-300');
    expect(getRoleBadgeClasses('coach')).toContain('dark:text-green-950');
    expect(getRoleBadgeClasses('parent')).toContain('dark:bg-purple-300');
    expect(getRoleBadgeClasses('parent')).toContain('dark:text-purple-950');
    expect(getRoleBadgeClasses('player')).toContain('dark:bg-orange-300');
    expect(getRoleBadgeClasses('player')).toContain('dark:text-orange-950');
  });

  it('should include base classes', () => {
    const classes = getRoleBadgeClasses('admin');
    expect(classes).toContain('inline-flex');
    expect(classes).toContain('rounded-full');
    expect(classes).toContain('px-4');
    expect(classes).toContain('py-2');
    expect(classes).toContain('text-sm');
    expect(classes).toContain('font-semibold');
  });
});
