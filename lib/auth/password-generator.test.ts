import { describe, it, expect } from 'vitest';
import { generatePassword, validateGeneratedPassword } from './password-generator';

describe('generatePassword', () => {
  it('should generate passwords of exactly 16 characters', () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword();
      expect(password.length).toBe(16);
    }
  });

  it('should contain at least one uppercase letter', () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword();
      expect(/[A-Z]/.test(password)).toBe(true);
    }
  });

  it('should contain at least one lowercase letter', () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword();
      expect(/[a-z]/.test(password)).toBe(true);
    }
  });

  it('should contain at least one digit', () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword();
      expect(/[0-9]/.test(password)).toBe(true);
    }
  });

  it('should contain at least one symbol', () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword();
      expect(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)).toBe(true);
    }
  });

  it('should not contain ambiguous characters (0, O, l, 1, I)', () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword();
      expect(/[0OlI1]/.test(password)).toBe(false);
    }
  });

  it('should generate different passwords each time', () => {
    const passwords = new Set<string>();
    for (let i = 0; i < 100; i++) {
      passwords.add(generatePassword());
    }
    // All 100 passwords should be unique
    expect(passwords.size).toBe(100);
  });

  it('should pass validation', () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword();
      const validation = validateGeneratedPassword(password);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    }
  });
});

describe('validateGeneratedPassword', () => {
  it('should accept valid passwords', () => {
    const valid = validateGeneratedPassword('Abc2$efg3&hij4#k');
    expect(valid.valid).toBe(true);
    expect(valid.errors).toEqual([]);
  });

  it('should reject passwords that are too short', () => {
    const result = validateGeneratedPassword('Abc2$efg');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be exactly 16 characters');
  });

  it('should reject passwords without uppercase', () => {
    const result = validateGeneratedPassword('abc2$efg3&hij4#k');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject passwords without lowercase', () => {
    const result = validateGeneratedPassword('ABC2$EFG3&HIJ4#K');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject passwords without digits', () => {
    const result = validateGeneratedPassword('Abc$$efg$&hij$#k');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one digit');
  });

  it('should reject passwords without symbols', () => {
    const result = validateGeneratedPassword('Abc2efg3hij4mnkp');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one symbol');
  });

  it('should reject passwords with ambiguous characters', () => {
    const tests = [
      'Abc2$efg3&hij40k', // contains 0
      'Abc2$efg3&hijO#k', // contains O
      'Abc2$efg3&hijl#k', // contains l
      'Abc2$efg3&hij1#k', // contains 1
      'Abc2$efg3&hijI#k', // contains I
    ];

    tests.forEach(password => {
      const result = validateGeneratedPassword(password);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password contains ambiguous characters (0, O, l, 1, I)');
    });
  });
});
