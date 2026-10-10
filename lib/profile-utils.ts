/**
 * Profile utility functions
 */

export type UserRole = 'admin' | 'club_admin' | 'team_manager' | 'coach' | 'parent' | 'player';

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
  const baseClasses = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold';

  // Light mode keeps a saturated chip with white text (team manager stays a white
  // chip so it does not blend into the navy bar). Dark mode uses a lighter chip
  // with dark text: the bar stays navy, and the same chip still reads on gray-800
  // profile cards and on the admin lists.
  const colorMap: Record<UserRole, string> = {
    admin: 'bg-red-600 text-white dark:bg-red-300 dark:text-red-950',
    club_admin: 'bg-indigo-700 text-white dark:bg-indigo-300 dark:text-indigo-950',
    team_manager: 'border-2 border-current bg-white text-blue-800 dark:border-sky-700 dark:bg-sky-200 dark:text-sky-950',
    coach: 'bg-green-700 text-white dark:bg-green-300 dark:text-green-950',
    parent: 'bg-purple-600 text-white dark:bg-purple-300 dark:text-purple-950',
    player: 'bg-orange-700 text-white dark:bg-orange-300 dark:text-orange-950',
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
