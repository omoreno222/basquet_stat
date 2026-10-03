import { z } from 'zod';
import { validateEmail, validatePassword, validatePhone } from '@/lib/profile-utils';

export const userRoleValues = ['admin', 'club_admin', 'team_manager', 'coach', 'parent', 'player'] as const;
export const teamCategoryValues = ['premini', 'mini', 'infantil', 'cadete', 'junior', 'sub22', 'senior'] as const;
export const teamGenderValues = ['male', 'female', 'mixed'] as const;
export const gameStatusValues = ['scheduled', 'live', 'final'] as const;
export const kitColorValues = ['primary', 'secondary'] as const;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color');

function blankToNull(value: unknown) {
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

const optionalText = z.preprocess(blankToNull, z.string().trim().nullable().optional());
const optionalUuid = z.preprocess(blankToNull, z.string().uuid().nullable().optional());

export const FIBA_SHORT_NAME_PATTERN = /^[A-Z0-9]{3}$/;

function normalizeFibaShortName(value: unknown) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toUpperCase();
  return normalized === '' ? null : normalized;
}

const optionalFibaShortName = z.preprocess(
  normalizeFibaShortName,
  z.string().regex(FIBA_SHORT_NAME_PATTERN, 'FIBA short name must be 3 letters or numbers').nullable().optional(),
);

export function schemaError(error: z.ZodError) {
  return error.issues[0]?.message || 'Invalid input';
}

export const clubSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Club name is required').max(200),
  short_name: z.preprocess(blankToNull, z.string().trim().max(10).nullable().optional()),
  primary_color: hexColor,
  secondary_color: hexColor,
});

export const seasonSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date is required'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date is required'),
  is_active: z.boolean(),
}).refine((value) => value.end_date >= value.start_date, {
  message: 'End date must be on or after the start date',
  path: ['end_date'],
});

export const teamSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Team name is required').max(200),
  fiba_short_name: optionalFibaShortName,
  club_id: optionalUuid,
  coach_id: optionalUuid,
  season_id: z.string().uuid('Season is required'),
  category: z.enum(teamCategoryValues),
  gender: z.enum(teamGenderValues),
});

export const playerSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(1, 'Full name is required').max(200),
  jersey_number: z.coerce.number().int().min(0).max(99),
  team_id: z.string().uuid('Team is required'),
  position: optionalText,
  date_of_birth: z.preprocess(
    blankToNull,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ),
});

const opponentRosterPlayerSchema = z.object({
  id: z.string().uuid().nullable(),
  jersey_number: z.number().int().min(0).max(99).nullable(),
  name: z.preprocess(blankToNull, z.string().trim().max(80, 'name too long').nullable()),
  is_coach: z.boolean(),
}).superRefine((player, ctx) => {
  if (player.is_coach && player.jersey_number !== null) {
    ctx.addIssue({ code: 'custom', message: 'coach has no jersey', path: ['jersey_number'] });
  }
  if (!player.is_coach && player.jersey_number === null) {
    ctx.addIssue({ code: 'custom', message: 'jersey required', path: ['jersey_number'] });
  }
});

export const opponentRosterSchema = z.object({
  game_id: z.string().uuid(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'invalid color').transform((value) => value.toLowerCase()),
  players: z.array(opponentRosterPlayerSchema).max(13, 'at most 12 opponent players'),
}).refine((value) => {
  const jerseys = value.players.flatMap((player) => (player.jersey_number === null ? [] : [player.jersey_number]));
  return new Set(jerseys).size === jerseys.length;
}, {
  message: 'duplicate jersey',
  path: ['players'],
}).refine((value) => value.players.filter((player) => player.is_coach).length <= 1, {
  message: 'only one coach',
  path: ['players'],
}).refine((value) => value.players.filter((player) => !player.is_coach).length <= 12, {
  message: 'at most 12 opponent players',
  path: ['players'],
});

export const opponentBenchAddSchema = z.object({
  game_id: z.string().uuid(),
  jersey_number: z.number().int().min(0).max(99),
  name: z.preprocess(blankToNull, z.string().trim().max(80, 'name too long').nullable()),
  existing_jerseys: z.array(z.number().int().min(0).max(99)),
}).superRefine((value, ctx) => {
  if (value.existing_jerseys.length >= 12) {
    ctx.addIssue({ code: 'custom', message: 'at most 12 opponent players', path: ['jersey_number'] });
    return;
  }
  if (value.existing_jerseys.includes(value.jersey_number)) {
    ctx.addIssue({ code: 'custom', message: 'duplicate jersey', path: ['jersey_number'] });
  }
});

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

export const gameSquadSchema = z.object({
  game_id: z.string().uuid(),
  player_ids: z.array(z.string().uuid()).max(12, 'at most 12 players'),
  require_twelve: z.boolean(),
}).refine((value) => uniqueIds(value.player_ids), {
  message: 'duplicate player',
  path: ['player_ids'],
}).refine((value) => !value.require_twelve || value.player_ids.length === 12, {
  message: 'exactly 12 players',
  path: ['player_ids'],
});

export const incorporatePlayerSchema = z.object({
  game_id: z.string().uuid(),
  player_id: z.string().uuid(),
  dressed_ids: z.array(z.string().uuid()).max(12, 'at most 12 players'),
}).refine((value) => uniqueIds(value.dressed_ids), {
  message: 'duplicate player',
  path: ['dressed_ids'],
}).refine((value) => !value.dressed_ids.includes(value.player_id), {
  message: 'already dressed',
  path: ['player_id'],
}).refine((value) => value.dressed_ids.length < 12, {
  message: 'at most 12 players',
  path: ['dressed_ids'],
});

export const openingTipWinnerSchema = z.enum(['home', 'away']);

export const periodLineupSchema = z.object({
  game_id: z.string().uuid(),
  period_number: z.number().int().min(1).max(20),
  home_player_ids: z.array(z.string().uuid()).max(5, 'at most 5 starters'),
  away_player_ids: z.array(z.string().uuid()).max(5, 'at most 5 starters'),
}).refine((value) => uniqueIds(value.home_player_ids), {
  message: 'duplicate player',
  path: ['home_player_ids'],
}).refine((value) => uniqueIds(value.away_player_ids), {
  message: 'duplicate player',
  path: ['away_player_ids'],
});

export const gameSchema = z.object({
  id: z.string().uuid().optional(),
  team_id: z.string().uuid('Team is required'),
  opponent_name: z.string().trim().min(1, 'Opponent name is required').max(200),
  game_date: z.string().min(1, 'Game date is required').refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'Game date is required',
  }),
  venue: optionalText,
  status: z.enum(gameStatusValues),
  is_home: z.boolean(),
  official: z.boolean(),
  kit_color: z.enum(kitColorValues),
  opponent_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color').transform((value) => value.toLowerCase()),
});

export const userCreateSchema = z.object({
  email: z.string().trim().refine(validateEmail, 'Invalid email address'),
  full_name: z.string().trim().max(200).optional().default(''),
  roles: z.array(z.enum(userRoleValues)).min(1, 'At least one role must be selected'),
  club_id: optionalUuid,
});

export const userUpdateSchema = userCreateSchema.extend({
  id: z.string().uuid(),
});

export const userRolesSchema = z.object({
  roles: z.array(z.enum(userRoleValues)).min(1, 'At least one role must be selected'),
  clubId: optionalUuid,
});

export const profileFieldsSchema = z.object({
  first_name: z.string().trim().max(80),
  last_name: z.string().trim().max(80),
  locale: z.enum(['en', 'es', 'ca']),
  phone: z.string().refine(validatePhone, 'Invalid phone number'),
});

export const profileThemeSchema = z.object({
  theme: z.enum(['light', 'dark']),
});

export const profileEmailSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newEmail: z.string().trim().refine(validateEmail, 'Invalid email address'),
});

export const profilePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().refine((value) => validatePassword(value).valid, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Current password is required'),
}).refine((value) => value.newPassword === value.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});
