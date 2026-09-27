/**
 * Game start window logic
 * Games can only be started within 30 minutes of scheduled time (or by admin override)
 */

import { supabase } from './supabase';

export interface GameStartCheck {
  canStart: boolean;
  reason?: string;
  minutesUntilStart?: number;
  isAdmin?: boolean;
}

/**
 * Check if a game can be started based on scheduled time and user role
 * @param gameId - The game ID
 * @param userId - The current user ID
 * @returns GameStartCheck with canStart flag and details
 */
export async function canStartGame(gameId: string, userId: string): Promise<GameStartCheck> {
  // Get game details
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('game_date, status')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    return { canStart: false, reason: 'Game not found' };
  }

  // If game is already live or finished, don't allow starting again
  if (game.status === 'live' || game.status === 'final') {
    return { canStart: false, reason: `Game is already ${game.status}` };
  }

  // Check if user is admin
  const { data: roles, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', userId);

  if (rolesError) {
    console.error('Error loading roles:', rolesError);
  }

  const isAdmin = roles?.some(r => r.role === 'admin' && r.club_id === null) || false;

  // Admins can always start
  if (isAdmin) {
    return { canStart: true, isAdmin: true };
  }

  // Check time window (30 minutes before scheduled time)
  const scheduledTime = new Date(game.game_date);
  const now = new Date();
  const thirtyMinsBefore = new Date(scheduledTime.getTime() - 30 * 60 * 1000);

  if (now < thirtyMinsBefore) {
    const minutesUntilStart = Math.ceil((thirtyMinsBefore.getTime() - now.getTime()) / 60000);
    return {
      canStart: false,
      reason: 'Game cannot be started yet',
      minutesUntilStart,
      isAdmin: false,
    };
  }

  // Within the 30-minute window or after scheduled time
  return { canStart: true, isAdmin: false };
}

/**
 * Format time remaining until game can start
 */
export function formatTimeUntilStart(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
