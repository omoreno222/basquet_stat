/**
 * Box line for one player, plus the game pace in the header.
 * Shots are made/attempted. Rebound share is that player's part of their own team's rebounds.
 * Possessions follow Dean Oliver: FGA − offensive rebounds + turnovers + 0.44 × FTA.
 * The game pace is the average of the two teams.
 */

export type EvalSide = 'home' | 'away';

export interface EvalEvent {
  play_group_id?: string | null;
  event_type: string;
  player_id?: string | null;
  opponent_player_id?: string | null;
  points?: number | null;
  made?: boolean | null;
  is_offensive?: boolean | null;
  rebound_side?: string | null;
  turnover_side?: string | null;
  foul_side?: string | null;
  foul_context?: string | null;
  coach_technical_side?: string | null;
  foul_received_player_id?: string | null;
  foul_received_opponent_player_id?: string | null;
}

export interface EvalPerson {
  id: string;
  name: string;
  jerseyNumber: number | null;
}

export interface EvalInput {
  events: readonly EvalEvent[];
  /** Names for home players. Squad ids are the rows that appear even with an empty line. */
  homePlayers: readonly EvalPerson[];
  homeSquadIds: readonly string[];
  awayPlayers: readonly EvalPerson[];
  awayRosterIds: readonly string[];
}

export interface PlayerEval {
  id: string;
  name: string;
  jerseyNumber: number | null;
  ftMade: number;
  ftAtt: number;
  twoMade: number;
  twoAtt: number;
  threeMade: number;
  threeAtt: number;
  drb: number;
  orb: number;
  /** Null when the team has no defensive rebounds. */
  drbShare: number | null;
  /** Null when the team has no offensive rebounds. */
  orbShare: number | null;
  foulsCommitted: number;
  foulsReceived: number;
  turnovers: number;
  assists: number;
  points: number;
}

/** Team totals, including rebounds and fouls that are not charged to a player. */
export interface TeamEval {
  ftMade: number;
  ftAtt: number;
  twoMade: number;
  twoAtt: number;
  threeMade: number;
  threeAtt: number;
  drb: number;
  orb: number;
  foulsCommitted: number;
  foulsReceived: number;
}

export interface EvalResult {
  homePossessions: number;
  awayPossessions: number;
  gamePossessions: number;
  homePoints: number;
  awayPoints: number;
  homeTeam: TeamEval;
  awayTeam: TeamEval;
  home: PlayerEval[];
  away: PlayerEval[];
}

interface Counts {
  ftMade: number;
  ftAtt: number;
  twoMade: number;
  twoAtt: number;
  threeMade: number;
  threeAtt: number;
  drb: number;
  orb: number;
  fc: number;
  fr: number;
  ast: number;
  tov: number;
  points: number;
}

interface TeamCounts {
  fga: number;
  fta: number;
  ftMade: number;
  twoMade: number;
  twoAtt: number;
  threeMade: number;
  threeAtt: number;
  drb: number;
  orb: number;
  fc: number;
  fr: number;
  tov: number;
  points: number;
}

function emptyCounts(): Counts {
  return {
    ftMade: 0,
    ftAtt: 0,
    twoMade: 0,
    twoAtt: 0,
    threeMade: 0,
    threeAtt: 0,
    drb: 0,
    orb: 0,
    fc: 0,
    fr: 0,
    ast: 0,
    tov: 0,
    points: 0,
  };
}

function emptyTeam(): TeamCounts {
  return {
    fga: 0,
    fta: 0,
    ftMade: 0,
    twoMade: 0,
    twoAtt: 0,
    threeMade: 0,
    threeAtt: 0,
    drb: 0,
    orb: 0,
    fc: 0,
    fr: 0,
    tov: 0,
    points: 0,
  };
}

function teamEval(team: TeamCounts): TeamEval {
  return {
    ftMade: team.ftMade,
    ftAtt: team.fta,
    twoMade: team.twoMade,
    twoAtt: team.twoAtt,
    threeMade: team.threeMade,
    threeAtt: team.threeAtt,
    drb: team.drb,
    orb: team.orb,
    foulsCommitted: team.fc,
    foulsReceived: team.fr,
  };
}

function actorSide(playerId: string | null | undefined, opponentId: string | null | undefined): EvalSide | null {
  const home = !!playerId;
  const away = !!opponentId;
  if (home === away) return null;
  return home ? 'home' : 'away';
}

function actorId(event: EvalEvent, side: EvalSide): string | null {
  const id = side === 'home' ? event.player_id : event.opponent_player_id;
  return id || null;
}

function displayName(person: EvalPerson | undefined, id: string): { name: string; jerseyNumber: number | null } {
  const name = person?.name.trim() ?? '';
  const jerseyNumber = person?.jerseyNumber ?? null;
  if (name) return { name, jerseyNumber };
  if (jerseyNumber != null) return { name: `#${jerseyNumber}`, jerseyNumber };
  return { name: id, jerseyNumber: null };
}

function teamShare(player: number, teamTotal: number): number | null {
  if (teamTotal <= 0) return null;
  return (player / teamTotal) * 100;
}

function percentDigits(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? 0 : 1;
}

/** `3/5 60%`. No percentage when there are no attempts. */
export function formatShotLine(made: number, attempted: number, locale: string): string {
  if (attempted <= 0) return '0/0';
  const pct = (made / attempted) * 100;
  return `${made}/${attempted} ${formatStat(pct, percentDigits(pct), locale)}%`;
}

/** `2 (20%)`. The share is omitted when the team total is zero. */
export function formatRebound(count: number, share: number | null, locale: string): string {
  if (share == null) return String(count);
  return `${count} (${formatStat(share, percentDigits(share), locale)}%)`;
}

function compareRows(a: PlayerEval, b: PlayerEval): number {
  if (a.jerseyNumber == null && b.jerseyNumber == null) return a.name.localeCompare(b.name);
  if (a.jerseyNumber == null) return 1;
  if (b.jerseyNumber == null) return -1;
  if (a.jerseyNumber !== b.jerseyNumber) return a.jerseyNumber - b.jerseyNumber;
  return a.name.localeCompare(b.name);
}

export function formatStat(value: number | null, digits: number, locale: string): string {
  if (value == null || Number.isNaN(value)) return '';
  const safeLocale = locale === 'es' || locale === 'ca' ? locale : 'en';
  return new Intl.NumberFormat(safeLocale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function evaluateGame(input: EvalInput): EvalResult {
  const home = emptyTeam();
  const away = emptyTeam();
  const teams: Record<EvalSide, TeamCounts> = { home, away };
  const players = new Map<string, Counts>();
  const sideOf = new Map<string, EvalSide>();

  const ensure = (id: string, side: EvalSide) => {
    sideOf.set(id, side);
    let counts = players.get(id);
    if (!counts) {
      counts = emptyCounts();
      players.set(id, counts);
    }
    return counts;
  };

  const turnoverGroups = new Set(
    input.events
      .filter((event) => event.event_type === 'turnover' && event.play_group_id)
      .map((event) => event.play_group_id as string),
  );

  for (const event of input.events) {
    if (event.event_type === 'shot' || event.event_type === 'free_throw') {
      const side = actorSide(event.player_id, event.opponent_player_id);
      if (!side) continue;
      const team = teams[side];
      const id = actorId(event, side);
      const counts = id ? ensure(id, side) : null;
      const made = event.made === true;
      const points = event.points ?? 0;
      if (event.event_type === 'shot') {
        team.fga += 1;
        if (points === 2) {
          team.twoAtt += 1;
          if (made) team.twoMade += 1;
        } else if (points === 3) {
          team.threeAtt += 1;
          if (made) team.threeMade += 1;
        }
        if (counts) {
          if (points === 2) {
            counts.twoAtt += 1;
            if (made) counts.twoMade += 1;
          } else if (points === 3) {
            counts.threeAtt += 1;
            if (made) counts.threeMade += 1;
          }
          if (made) counts.points += points;
        }
        if (made) team.points += points;
      } else {
        team.fta += 1;
        if (made) team.ftMade += 1;
        if (counts) {
          counts.ftAtt += 1;
          if (made) {
            counts.ftMade += 1;
            counts.points += points;
          }
        }
        if (made) team.points += points;
      }
      continue;
    }

    if (event.event_type === 'rebound') {
      let side = actorSide(event.player_id, event.opponent_player_id);
      if (!side && event.rebound_side === 'away') side = 'away';
      if (!side || event.is_offensive == null) continue;
      const team = teams[side];
      if (event.is_offensive) team.orb += 1;
      else team.drb += 1;
      const id = actorId(event, side);
      if (!id) continue;
      const counts = ensure(id, side);
      if (event.is_offensive) counts.orb += 1;
      else counts.drb += 1;
      continue;
    }

    if (event.event_type === 'foul') {
      if (!event.coach_technical_side) {
        const side = event.foul_side === 'home' || event.foul_side === 'away'
          ? event.foul_side
          : actorSide(event.player_id, event.opponent_player_id);
        if (side) {
          teams[side].fc += 1;
          const id = actorId(event, side);
          if (id) ensure(id, side).fc += 1;
          const groupHasTurnover = !!event.play_group_id && turnoverGroups.has(event.play_group_id);
          if (event.foul_context === 'offensive' && !groupHasTurnover) {
            teams[side].tov += 1;
            if (id) ensure(id, side).tov += 1;
          }
        }
      }
      if (event.foul_received_player_id) {
        teams.home.fr += 1;
        ensure(event.foul_received_player_id, 'home').fr += 1;
      }
      if (event.foul_received_opponent_player_id) {
        teams.away.fr += 1;
        ensure(event.foul_received_opponent_player_id, 'away').fr += 1;
      }
      continue;
    }

    if (event.event_type === 'assist') {
      const side = actorSide(event.player_id, event.opponent_player_id);
      if (!side) continue;
      const id = actorId(event, side);
      if (id) ensure(id, side).ast += 1;
      continue;
    }

    if (event.event_type === 'turnover') {
      const side = event.turnover_side === 'home' || event.turnover_side === 'away'
        ? event.turnover_side
        : null;
      if (!side) continue;
      teams[side].tov += 1;
      const id = actorId(event, side);
      if (id) ensure(id, side).tov += 1;
    }
  }

  const homePossessions = home.fga - home.orb + home.tov + 0.44 * home.fta;
  const awayPossessions = away.fga - away.orb + away.tov + 0.44 * away.fta;
  const gamePossessions = (homePossessions + awayPossessions) / 2;

  const homeDirectory = new Map(input.homePlayers.map((person) => [person.id, person]));
  const awayDirectory = new Map(input.awayPlayers.map((person) => [person.id, person]));

  const row = (id: string, side: EvalSide): PlayerEval => {
    const counts = players.get(id) ?? emptyCounts();
    const team = teams[side];
    const directory = side === 'home' ? homeDirectory : awayDirectory;
    const label = displayName(directory.get(id), id);
    return {
      id,
      name: label.name,
      jerseyNumber: label.jerseyNumber,
      ftMade: counts.ftMade,
      ftAtt: counts.ftAtt,
      twoMade: counts.twoMade,
      twoAtt: counts.twoAtt,
      threeMade: counts.threeMade,
      threeAtt: counts.threeAtt,
      drb: counts.drb,
      orb: counts.orb,
      drbShare: teamShare(counts.drb, team.drb),
      orbShare: teamShare(counts.orb, team.orb),
      foulsCommitted: counts.fc,
      foulsReceived: counts.fr,
      turnovers: counts.tov,
      assists: counts.ast,
      points: counts.points,
    };
  };

  const idsFor = (side: EvalSide, required: readonly string[]) => {
    const ids = new Set(required);
    for (const [id, countedSide] of sideOf) {
      if (countedSide === side) ids.add(id);
    }
    return [...ids].map((id) => row(id, side)).sort(compareRows);
  };

  return {
    homePossessions,
    awayPossessions,
    gamePossessions,
    homePoints: home.points,
    awayPoints: away.points,
    homeTeam: teamEval(home),
    awayTeam: teamEval(away),
    home: idsFor('home', input.homeSquadIds),
    away: idsFor('away', input.awayRosterIds),
  };
}
