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
  home_team_id: string;
  away_team_id: string;
  game_date: string;
  location: string | null;
  venue?: string;
  opponent_name?: string;
  status?: string;
  slot_a_user_id: string | null;
  slot_b_user_id: string | null;
  home_score: number;
  away_score: number;
  period: number;
  clock_remaining_ms: number;
  clock_running: boolean;
  current_period: number;
  possession: 'home' | 'away';
  team_score: number;
  opponent_score: number;
  attacking_right_first_period: boolean;
  attack_right_first: boolean;
  created_at: string;
  home_team?: Team;
  away_team?: Team;
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
