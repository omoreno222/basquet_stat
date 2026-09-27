/**
 * Profile utility functions
 */

export type UserRole = 'admin' | 'team_manager' | 'coach' | 'parent' | 'player';

/**
 * Generate initials from a full name or first/last name
 * @param firstName First name (or full name if lastName is not provided)
 * @param lastName Last name (optional)
 * @returns Two-letter initials (uppercase)
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  if (!firstName) return '??';
  
  const first = firstName.trim();
  const last = lastName?.trim();
  
  if (last) {
    // Use first letter of first name and first letter of last name
    return (first.charAt(0) + last.charAt(0)).toUpperCase();
  }
  
  // If only one name, try to split it
  const parts = first.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  
  // Single word name: use first two characters
  return (first.charAt(0) + (first.charAt(1) || first.charAt(0))).toUpperCase();
}

/**
 * Get role badge color classes
 * @param role User role
 * @returns Tailwind CSS classes for the role badge
 */
export function getRoleBadgeClasses(role: UserRole): string {
  const baseClasses = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium';
  
  const colorMap: Record<UserRole, string> = {
    admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    team_manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    coach: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    parent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    player: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };
  
  return `${baseClasses} ${colorMap[role]}`;
}

/**
 * Get role translation key
 * @param role User role
 * @returns Translation key for the role
 */
export function getRoleTranslationKey(role: UserRole): string {
  return `trke_role_${role}`;
}

/**
 * Validate phone number (basic validation)
 * @param phone Phone number string
 * @returns true if valid (or empty), false otherwise
 */
export function validatePhone(phone: string): boolean {
  if (!phone || phone.trim() === '') return true; // Optional field
  
  // Allow numbers, spaces, dashes, parentheses, and + sign
  // At least 6 digits required
  const cleaned = phone.replace(/[\s\-()]/g, '');
  const digitCount = (cleaned.match(/\d/g) || []).length;
  
  if (digitCount < 6) return false;
  
  // Check that it only contains valid characters
  return /^[\d\s\-()+ ]+$/.test(phone);
}

/**
 * Validate email format
 * @param email Email string
 * @returns true if valid email format
 */
export function validateEmail(email: string): boolean {
  if (!email || email.trim() === '') return false;
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param password Password string
 * @returns { valid: boolean, message?: string }
 */
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  return { valid: true };
}
