// Common database types

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  category: string | null;
  season: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  team_id: string;
  full_name: string;
  jersey_number: number;
  position: string | null;
  avatar_url: string | null;
  created_at: string;
  team?: Team;
}

export interface Game {
  id: string;
  team_id: string;
  opponent_name: string;
  opponent_score: number;
  team_score: number;
  is_home: boolean;
  venue?: string;
  game_date: string;
  status: string;
  official?: boolean;
  slot_a_user_id: string | null;
  slot_b_user_id: string | null;
  clock_running: boolean;
  clock_remaining_ms: number;
  current_period: number;
  possession: 'home' | 'away';
  attack_right_first: boolean;
  created_at: string;
  updated_at?: string;
  teams?: Team;
}

export interface Translation {
  id: string;
  key: string;
  locale: string;
  value: string;
  created_at: string;
}

export interface ProfileRole {
  profile_id: string;
  role: string;
}

export interface SupabaseError {
  message: string;
  code?: string;
}
