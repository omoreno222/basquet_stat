export type UserRole = 'admin' | 'team_manager' | 'coach' | 'parent' | 'player';
export type GameStatus = 'scheduled' | 'live' | 'final';
export type EventType = 'shot' | 'free_throw' | 'foul' | 'rebound' | 'assist' | 'steal' | 'turnover';
export type Locale = 'en' | 'es' | 'ca';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  language: Locale;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Team {
  id: string;
  season_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  user_id: string | null;
  full_name: string;
  jersey_number: number;
  position: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentPlayerLink {
  id: string;
  parent_id: string;
  player_id: string;
  created_at: string;
}

export interface Game {
  id: string;
  team_id: string;
  opponent_name: string;
  opponent_score: number;
  team_score: number;
  is_home: boolean;
  venue: string | null;
  game_date: string;
  status: GameStatus;
  slot_a_user_id: string | null;
  slot_b_user_id: string | null;
  clock_running: boolean;
  clock_remaining_ms: number;
  current_period: number;
  possession: 'home' | 'away' | null;
  official: boolean;
  created_at: string;
  updated_at: string;
}

export interface GamePeriod {
  id: string;
  game_id: string;
  period_number: number;
  duration_ms: number;
  is_overtime: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface Stint {
  id: string;
  game_id: string;
  player_id: string;
  period_number: number;
  clock_in_ms: number;
  clock_out_ms: number | null;
  created_at: string;
}

export interface GameEvent {
  id: string;
  game_id: string;
  player_id: string | null;
  event_type: EventType;
  period_number: number;
  clock_remaining_ms: number;
  elapsed_ms: number;
  points: number;
  made: boolean | null;
  coord_x: number | null;
  coord_y: number | null;
  zone: number | null;
  is_offensive: boolean | null;
  recorded_by_user_id: string | null;
  created_at: string;
}

export interface Translation {
  id: string;
  key: string;
  locale: Locale;
  value: string;
  created_at: string;
  updated_at: string;
}
