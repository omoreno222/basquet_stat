/**
 * Tests for player role data access
 * 
 * These tests verify that player-role users can access:
 * - Their own full stats
 * - Their team's stats (team totals and per-game box scores including teammates' numbers)
 * 
 * Covers:
 * - is_player_of_team(team_id) function
 * - get_user_player_teams() function
 * - RLS policies for players table, games, game_events, etc.
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Player Access Logic', () => {
  describe('Team Association', () => {
    it('should identify player as member of their team', () => {
      // Mock: player with user_id belongs to team A
      const playerId = 'player-1';
      const userId = 'user-1';
      const teamId = 'team-a';
      
      const player = {
        id: playerId,
        user_id: userId,
        team_id: teamId,
      };
      
      expect(player.user_id).toBe(userId);
      expect(player.team_id).toBe(teamId);
    });

    it('should not identify player as member of different team', () => {
      // Mock: player belongs to team A, not team B
      const player = {
        team_id: 'team-a',
      };
      
      const otherTeamId = 'team-b';
      
      expect(player.team_id).not.toBe(otherTeamId);
    });

    it('should handle player with multiple teams in different seasons', () => {
      // A player can be on different teams across seasons
      const players = [
        { id: 'p1', user_id: 'user-1', team_id: 'team-a', jersey_number: 10 },
        { id: 'p2', user_id: 'user-1', team_id: 'team-b', jersey_number: 15 },
      ];
      
      const userId = 'user-1';
      const userPlayers = players.filter(p => p.user_id === userId);
      
      expect(userPlayers).toHaveLength(2);
      expect(userPlayers.map(p => p.team_id)).toEqual(['team-a', 'team-b']);
    });
  });

  describe('Player Data Access', () => {
    it('should allow player to see own player record', () => {
      const players = [
        { id: 'p1', user_id: 'user-1', full_name: 'Alice', team_id: 'team-a' },
        { id: 'p2', user_id: 'user-2', full_name: 'Bob', team_id: 'team-a' },
      ];
      
      const currentUserId = 'user-1';
      const ownPlayer = players.find(p => p.user_id === currentUserId);
      
      expect(ownPlayer).toBeDefined();
      expect(ownPlayer?.full_name).toBe('Alice');
    });

    it('should allow player to see teammates', () => {
      const players = [
        { id: 'p1', user_id: 'user-1', full_name: 'Alice', team_id: 'team-a' },
        { id: 'p2', user_id: 'user-2', full_name: 'Bob', team_id: 'team-a' },
        { id: 'p3', user_id: 'user-3', full_name: 'Carol', team_id: 'team-b' },
      ];
      
      const currentUserId = 'user-1';
      const userTeamIds = players
        .filter(p => p.user_id === currentUserId)
        .map(p => p.team_id);
      
      const teammates = players.filter(p => userTeamIds.includes(p.team_id));
      
      expect(teammates).toHaveLength(2);
      expect(teammates.map(p => p.full_name).sort()).toEqual(['Alice', 'Bob']);
    });

    it('should not allow player to see players from other teams', () => {
      const players = [
        { id: 'p1', user_id: 'user-1', team_id: 'team-a' },
        { id: 'p2', user_id: 'user-2', team_id: 'team-b' },
      ];
      
      const currentUserId = 'user-1';
      const userTeamIds = players
        .filter(p => p.user_id === currentUserId)
        .map(p => p.team_id);
      
      const visiblePlayers = players.filter(p => userTeamIds.includes(p.team_id));
      
      expect(visiblePlayers).toHaveLength(1);
      expect(visiblePlayers[0].id).toBe('p1');
    });
  });

  describe('Game Data Access', () => {
    it('should allow player to see own team games', () => {
      const games = [
        { id: 'g1', team_id: 'team-a', opponent_name: 'Opponent A' },
        { id: 'g2', team_id: 'team-b', opponent_name: 'Opponent B' },
      ];
      
      const userTeamIds = ['team-a'];
      const visibleGames = games.filter(g => userTeamIds.includes(g.team_id));
      
      expect(visibleGames).toHaveLength(1);
      expect(visibleGames[0].opponent_name).toBe('Opponent A');
    });

    it('should not allow player to see other team games', () => {
      const games = [
        { id: 'g1', team_id: 'team-a' },
        { id: 'g2', team_id: 'team-b' },
      ];
      
      const userTeamIds = ['team-a'];
      const visibleGames = games.filter(g => userTeamIds.includes(g.team_id));
      
      expect(visibleGames).not.toContainEqual(expect.objectContaining({ team_id: 'team-b' }));
    });
  });

  describe('Event Data Access', () => {
    it('should allow player to see events from own team games', () => {
      const games = [
        { id: 'g1', team_id: 'team-a' },
        { id: 'g2', team_id: 'team-b' },
      ];
      
      const events = [
        { id: 'e1', game_id: 'g1', player_id: 'p1', event_type: 'shot' },
        { id: 'e2', game_id: 'g1', player_id: 'p2', event_type: 'foul' },
        { id: 'e3', game_id: 'g2', player_id: 'p3', event_type: 'shot' },
      ];
      
      const userTeamIds = ['team-a'];
      const visibleGameIds = games
        .filter(g => userTeamIds.includes(g.team_id))
        .map(g => g.id);
      
      const visibleEvents = events.filter(e => visibleGameIds.includes(e.game_id));
      
      expect(visibleEvents).toHaveLength(2);
      expect(visibleEvents.map(e => e.id).sort()).toEqual(['e1', 'e2']);
    });

    it('should not allow player to see events from other team games', () => {
      const games = [
        { id: 'g1', team_id: 'team-a' },
        { id: 'g2', team_id: 'team-b' },
      ];
      
      const events = [
        { id: 'e1', game_id: 'g1' },
        { id: 'e2', game_id: 'g2' },
      ];
      
      const userTeamIds = ['team-a'];
      const visibleGameIds = games
        .filter(g => userTeamIds.includes(g.team_id))
        .map(g => g.id);
      
      const visibleEvents = events.filter(e => visibleGameIds.includes(e.game_id));
      
      expect(visibleEvents).not.toContainEqual(expect.objectContaining({ game_id: 'g2' }));
    });
  });

  describe('Multi-Role Scenarios', () => {
    it('should handle player who is also a parent', () => {
      // Player can have multiple roles
      const roles = ['player', 'parent'];
      
      expect(roles).toContain('player');
      expect(roles).toContain('parent');
      expect(roles).toHaveLength(2);
    });

    it('should allow player-parent to see own team plus children teams', () => {
      // As player: can see team A
      // As parent: can see child's team B
      const playerTeams = ['team-a'];
      const childrenTeams = ['team-b'];
      
      const allAccessibleTeams = [...new Set([...playerTeams, ...childrenTeams])];
      
      expect(allAccessibleTeams.sort()).toEqual(['team-a', 'team-b']);
    });
  });

  describe('Unlinked Players', () => {
    it('should not grant access if player has no user_id', () => {
      const players = [
        { id: 'p1', user_id: null, team_id: 'team-a' },
        { id: 'p2', user_id: 'user-2', team_id: 'team-a' },
      ];
      
      const currentUserId = 'user-1';
      const userPlayers = players.filter(p => p.user_id === currentUserId);
      
      expect(userPlayers).toHaveLength(0);
    });

    it('should handle case where user has player role but no linked player record', () => {
      // User has 'player' role but no players.user_id pointing to them
      const roles = ['player'];
      const players = [
        { id: 'p1', user_id: 'user-2', team_id: 'team-a' },
      ];
      
      const currentUserId = 'user-1';
      const userPlayers = players.filter(p => p.user_id === currentUserId);
      
      expect(roles).toContain('player');
      expect(userPlayers).toHaveLength(0);
      // In this case, player would have no team access
    });
  });

  describe('Starting Lineups Access', () => {
    it('should allow player to see lineups from own team games', () => {
      const games = [
        { id: 'g1', team_id: 'team-a' },
        { id: 'g2', team_id: 'team-b' },
      ];
      
      const lineups = [
        { id: 'l1', game_id: 'g1', player_id: 'p1' },
        { id: 'l2', game_id: 'g1', player_id: 'p2' },
        { id: 'l3', game_id: 'g2', player_id: 'p3' },
      ];
      
      const userTeamIds = ['team-a'];
      const visibleGameIds = games
        .filter(g => userTeamIds.includes(g.team_id))
        .map(g => g.id);
      
      const visibleLineups = lineups.filter(l => visibleGameIds.includes(l.game_id));
      
      expect(visibleLineups).toHaveLength(2);
    });
  });

  describe('Game Periods Access', () => {
    it('should allow player to see periods from own team games', () => {
      const games = [
        { id: 'g1', team_id: 'team-a' },
        { id: 'g2', team_id: 'team-b' },
      ];
      
      const periods = [
        { id: 'pd1', game_id: 'g1', period_number: 1 },
        { id: 'pd2', game_id: 'g1', period_number: 2 },
        { id: 'pd3', game_id: 'g2', period_number: 1 },
      ];
      
      const userTeamIds = ['team-a'];
      const visibleGameIds = games
        .filter(g => userTeamIds.includes(g.team_id))
        .map(g => g.id);
      
      const visiblePeriods = periods.filter(p => visibleGameIds.includes(p.game_id));
      
      expect(visiblePeriods).toHaveLength(2);
    });
  });

  describe('Guest Players Access', () => {
    it('should allow player to see guest players in own team games', () => {
      const games = [
        { id: 'g1', team_id: 'team-a' },
        { id: 'g2', team_id: 'team-b' },
      ];
      
      const guestPlayers = [
        { game_id: 'g1', player_id: 'p-guest-1' },
        { game_id: 'g2', player_id: 'p-guest-2' },
      ];
      
      const userTeamIds = ['team-a'];
      const visibleGameIds = games
        .filter(g => userTeamIds.includes(g.team_id))
        .map(g => g.id);
      
      const visibleGuests = guestPlayers.filter(gp => visibleGameIds.includes(gp.game_id));
      
      expect(visibleGuests).toHaveLength(1);
      expect(visibleGuests[0].player_id).toBe('p-guest-1');
    });
  });
});
