/**
 * Tests for team category and gender label helpers
 */

import { describe, it, expect } from 'vitest';

// Type definitions
export type TeamCategory = 'premini' | 'mini' | 'infantil' | 'cadete' | 'junior' | 'sub22' | 'senior';
export type TeamGender = 'male' | 'female' | 'mixed';

// Helper functions
export function getCategoryLabel(category: TeamCategory): string {
  const labels: Record<TeamCategory, string> = {
    premini: 'PreMini',
    mini: 'Mini',
    infantil: 'Infantil',
    cadete: 'Cadete',
    junior: 'Junior',
    sub22: 'Sub-22',
    senior: 'Senior',
  };
  return labels[category];
}

export function getGenderLabel(gender: TeamGender): string {
  const labels: Record<TeamGender, string> = {
    male: 'Male',
    female: 'Female',
    mixed: 'Mixed',
  };
  return labels[gender];
}

// Tests
describe('Team Category Labels', () => {
  it('should return correct label for premini', () => {
    expect(getCategoryLabel('premini')).toBe('PreMini');
  });

  it('should return correct label for mini', () => {
    expect(getCategoryLabel('mini')).toBe('Mini');
  });

  it('should return correct label for infantil', () => {
    expect(getCategoryLabel('infantil')).toBe('Infantil');
  });

  it('should return correct label for cadete', () => {
    expect(getCategoryLabel('cadete')).toBe('Cadete');
  });

  it('should return correct label for junior', () => {
    expect(getCategoryLabel('junior')).toBe('Junior');
  });

  it('should return correct label for sub22', () => {
    expect(getCategoryLabel('sub22')).toBe('Sub-22');
  });

  it('should return correct label for senior', () => {
    expect(getCategoryLabel('senior')).toBe('Senior');
  });
});

describe('Team Gender Labels', () => {
  it('should return correct label for male', () => {
    expect(getGenderLabel('male')).toBe('Male');
  });

  it('should return correct label for female', () => {
    expect(getGenderLabel('female')).toBe('Female');
  });

  it('should return correct label for mixed', () => {
    expect(getGenderLabel('mixed')).toBe('Mixed');
  });
});
