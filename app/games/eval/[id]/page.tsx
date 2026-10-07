import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { MapPin } from 'lucide-react';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth-server';
import { countTimeouts, timeoutBanks } from '@/lib/capture/timeouts';
import { onCourtAfterSubs, type SubstitutionEvent } from '@/lib/capture/substitutions';
import {
  evaluateGame,
  formatShotLine,
  formatStat,
  type EvalEvent,
  type EvalPerson,
  type PlayerEval,
} from '@/lib/stats/sampaio-eval';
import {
  EvalScoreboard,
  PlayerPortrait,
  formatGameClock,
  type ScoreboardPlayer,
} from './eval-scoreboard';
import { EvalRefresh } from './eval-refresh';

export const dynamic = 'force-dynamic';

const COPY = {
  trke_eval_title: 'Player evaluation',
  trke_eval_possessions: 'Possessions',
  trke_players: 'Players',
  trke_eval_ft: 'FT',
  trke_eval_two: '2P',
  trke_eval_three: '3P',
  trke_eval_reb_def: 'RD',
  trke_eval_reb_off: 'RO',
  trke_eval_reb_def_name: 'Defensive rebounds',
  trke_eval_reb_off_name: 'Offensive rebounds',
  trke_eval_fh: 'FC',
  trke_eval_fr: 'FD',
  trke_eval_turnovers: 'TO',
  trke_eval_turnovers_name: 'Turnovers',
  trke_eval_assists: 'AST',
  trke_eval_assists_name: 'Assists',
  trke_eval_points: 'TP',
  trke_eval_points_name: 'Points',
  trke_eval_location: 'Location',
  trke_eval_empty: 'No marks yet',
  trke_eval_not_found: 'Game not found',
  trke_eval_score_events: 'Points from events',
  trke_eval_reload: 'Reload to update',
  trke_eval_updated: 'Updated at {time}',
  trke_eval_reload_button: 'Reload',
  trke_eval_quarter: 'Quarter',
  trke_eval_in_play: 'In play',
  trke_eval_stopped: 'Stopped',
  trke_eval_timeout_short: 'TO',
  trke_eval_overtime: 'OT',
} as const;

const COPY_LOCALE: Record<string, Partial<Record<CopyKey, string>>> = {
  es: {
    trke_players: 'Jugadores',
    trke_eval_ft: 'TL',
    trke_eval_fh: 'FH',
    trke_eval_fr: 'FR',
    trke_eval_reb_def_name: 'Rebote defensivo',
    trke_eval_reb_off_name: 'Rebote ofensivo',
    trke_eval_turnovers: 'PERD',
    trke_eval_turnovers_name: 'Pérdidas',
    trke_eval_assists: 'ASIS',
    trke_eval_assists_name: 'Asistencias',
    trke_eval_points: 'TP',
    trke_eval_points_name: 'Puntos',
    trke_eval_location: 'Ubicación',
    trke_eval_updated: 'Actualizado a las {time}',
    trke_eval_reload_button: 'Recargar',
    trke_eval_quarter: 'Cuarto',
    trke_eval_in_play: 'En juego',
    trke_eval_stopped: 'Parado',
    trke_eval_timeout_short: 'T.M.',
    trke_eval_overtime: 'PR',
  },
  ca: {
    trke_players: 'Jugadors',
    trke_eval_ft: 'TL',
    trke_eval_fh: 'FH',
    trke_eval_fr: 'FR',
    trke_eval_reb_def_name: 'Rebot defensiu',
    trke_eval_reb_off_name: 'Rebot ofensiu',
    trke_eval_turnovers: 'PERD',
    trke_eval_turnovers_name: 'Pèrdues',
    trke_eval_assists: 'ASIS',
    trke_eval_assists_name: 'Assistències',
    trke_eval_points: 'TP',
    trke_eval_points_name: 'Punts',
    trke_eval_location: 'Ubicació',
    trke_eval_updated: 'Actualitzat a les {time}',
    trke_eval_reload_button: 'Recarregar',
    trke_eval_quarter: 'Quart',
    trke_eval_in_play: 'En joc',
    trke_eval_stopped: 'Aturat',
    trke_eval_timeout_short: 'T.M.',
    trke_eval_overtime: 'PR',
  },
};

type CopyKey = keyof typeof COPY;

const EVENT_COLUMNS = [
  'play_group_id',
  'event_type',
  'player_id',
  'opponent_player_id',
  'points',
  'made',
  'is_offensive',
  'rebound_side',
  'turnover_side',
  'foul_side',
  'foul_context',
  'coach_technical_side',
  'foul_received_player_id',
  'foul_received_opponent_player_id',
  'period_number',
  'clock_remaining_ms',
  'created_at',
  'player_out_id',
  'opponent_player_out_id',
  'timeout_side',
].join(', ');

function userClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
}

function teamName(teams: { name?: string } | { name?: string }[] | null): string {
  if (!teams) return '';
  const row = Array.isArray(teams) ? teams[0] : teams;
  return row?.name ?? '';
}

function EvalTable({
  rows,
  locale,
  headers,
  photos,
  onCourt,
  portrait = 'jersey',
}: {
  rows: PlayerEval[];
  locale: string;
  headers: Record<CopyKey, string>;
  photos: ReadonlyMap<string, string | null>;
  onCourt: ReadonlySet<string>;
  portrait?: 'jersey' | 'avatar';
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th className="sticky left-0 z-10 bg-white px-3 py-[0.425rem] text-left dark:bg-gray-900">#</th>
            <th className="whitespace-nowrap px-3 py-[0.425rem]">{headers.trke_eval_ft}</th>
            <th className="whitespace-nowrap px-3 py-[0.425rem]">{headers.trke_eval_two}</th>
            <th className="whitespace-nowrap px-3 py-[0.425rem]">{headers.trke_eval_three}</th>
            <th className="cursor-help whitespace-nowrap px-3 py-[0.425rem]" title={headers.trke_eval_points_name}>{headers.trke_eval_points}</th>
            <th className="cursor-help whitespace-nowrap px-3 py-[0.425rem]" title={headers.trke_eval_assists_name}>{headers.trke_eval_assists}</th>
            <th className="cursor-help whitespace-nowrap px-3 py-[0.425rem]" title={headers.trke_eval_reb_def_name}>{headers.trke_eval_reb_def}</th>
            <th className="cursor-help whitespace-nowrap px-3 py-[0.425rem]" title={headers.trke_eval_reb_off_name}>{headers.trke_eval_reb_off}</th>
            <th className="whitespace-nowrap px-3 py-[0.425rem]">{headers.trke_eval_fh}</th>
            <th className="whitespace-nowrap px-3 py-[0.425rem]">{headers.trke_eval_fr}</th>
            <th className="cursor-help whitespace-nowrap px-3 py-[0.425rem]" title={headers.trke_eval_turnovers_name}>{headers.trke_eval_turnovers}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const playing = onCourt.has(row.id);
            const sticky = playing
              ? 'bg-amber-50 dark:bg-amber-950'
              : 'bg-white dark:bg-gray-900';
            return (
              <tr key={row.id} className={`border-t border-gray-200 dark:border-white/10 ${playing ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
                <td className={`sticky left-0 z-10 min-w-64 px-3 py-[0.425rem] font-medium ${sticky}`}>
                  <span className="flex items-center gap-2">
                    {row.jerseyNumber != null ? (
                      <span className="tabular-nums text-gray-500 dark:text-gray-400">{row.jerseyNumber}</span>
                    ) : null}
                    <PlayerPortrait name={row.name} jerseyNumber={row.jerseyNumber} avatarUrl={photos.get(row.id) ?? null} placeholder={portrait} />
                    <span className="inline-flex flex-wrap items-center">
                      <button
                        type="button"
                        aria-label={headers.trke_eval_location}
                        className="mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/5 dark:text-gray-100 dark:hover:bg-white/10"
                      >
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="font-bold">{row.name}</span>
                      {playing ? (
                        <span className="ml-1 text-sm leading-none" role="img" aria-label={headers.trke_eval_in_play}>
                          🏀
                        </span>
                      ) : null}
                    </span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{formatShotLine(row.ftMade, row.ftAtt, locale)}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{formatShotLine(row.twoMade, row.twoAtt, locale)}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{formatShotLine(row.threeMade, row.threeAtt, locale)}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{row.points}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{row.assists}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{row.drb}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{row.orb}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{row.foulsCommitted}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{row.foulsReceived}</td>
                <td className="whitespace-nowrap px-3 py-[0.425rem] tabular-nums">{row.turnovers}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function GameEvalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getAuthenticatedUser();
  if (!user) redirect('/login');

  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) redirect('/login');

  const supabase = userClient(token);
  const { data: profile } = await supabase
    .from('profiles')
    .select('locale, language')
    .eq('id', user.id)
    .single();
  const locale = profile?.locale || profile?.language || 'en';
  const { data: translationRows } = await supabase
    .from('translations')
    .select('key, value')
    .eq('locale', locale)
    .in('key', Object.keys(COPY));
  const headers = { ...COPY, ...(COPY_LOCALE[locale] ?? {}) } as Record<CopyKey, string>;
  translationRows?.forEach((row) => {
    if (row.key in headers && row.value) headers[row.key as CopyKey] = row.value;
  });

  if (!z.string().uuid().safeParse(id).success) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <p className="mx-auto max-w-5xl">{headers.trke_eval_not_found}</p>
      </main>
    );
  }

  const { data: game } = await supabase
    .from('games')
    .select('id, team_id, opponent_name, team_score, opponent_score, current_period, possession, clock_running, clock_remaining_ms, teams(name)')
    .eq('id', id)
    .single();

  if (!game) {
    return (
      <main className="min-h-screen bg-gray-100 px-4 py-8 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <p className="mx-auto max-w-5xl">{headers.trke_eval_not_found}</p>
      </main>
    );
  }

  const [playersRes, opponentsRes, squadRes, eventsRes, lineupsRes] = await Promise.all([
    supabase.from('players').select('id, full_name, jersey_number, avatar_url').eq('team_id', game.team_id),
    supabase.from('game_opponent_players').select('id, name, jersey_number, is_coach').eq('game_id', id),
    supabase.from('game_squads').select('player_id').eq('game_id', id),
    supabase.from('game_events').select(EVENT_COLUMNS).eq('game_id', id),
    supabase.from('game_period_lineups').select('period_number, side, position_index, player_id, opponent_player_id').eq('game_id', id),
  ]);

  const homePlayers: EvalPerson[] = (playersRes.data ?? []).map((player) => ({
    id: player.id,
    name: player.full_name ?? '',
    jerseyNumber: player.jersey_number,
  }));
  const awayPlayers: EvalPerson[] = (opponentsRes.data ?? [])
    .filter((player) => !player.is_coach)
    .map((player) => ({
      id: player.id,
      name: player.name ?? '',
      jerseyNumber: player.jersey_number,
    }));
  const events = (eventsRes.data ?? []) as unknown as Array<EvalEvent & {
    period_number: number | null;
    clock_remaining_ms: number | null;
    created_at: string | null;
    player_out_id: string | null;
    opponent_player_out_id: string | null;
    timeout_side: 'home' | 'away' | null;
  }>;
  const result = evaluateGame({
    events,
    homePlayers,
    homeSquadIds: (squadRes.data ?? []).map((row) => row.player_id),
    awayPlayers,
    awayRosterIds: awayPlayers.map((player) => player.id),
  });

  const ourName = teamName(game.teams as { name?: string } | { name?: string }[] | null);
  const opponentName = game.opponent_name ?? '';
  const storedHome = game.team_score ?? 0;
  const storedAway = game.opponent_score ?? 0;
  const scoreMatches = storedHome === result.homePoints && storedAway === result.awayPoints;
  const poss = (value: number) => formatStat(value, 1, locale);
  const period = game.current_period || 1;
  const possession = game.possession === 'home' || game.possession === 'away' ? game.possession : null;
  const photos = new Map((playersRes.data ?? []).map((player) => [player.id, player.avatar_url ?? null]));
  const homeById = new Map(homePlayers.map((player) => [player.id, player]));
  const awayById = new Map(awayPlayers.map((player) => [player.id, player]));

  const subs: SubstitutionEvent[] = events.flatMap((event) => {
    if (event.event_type !== 'substitution' || event.period_number == null) return [];
    return [{
      event_type: event.event_type,
      period_number: event.period_number,
      clock_remaining_ms: event.clock_remaining_ms ?? 0,
      created_at: event.created_at,
      player_id: event.player_id,
      player_out_id: event.player_out_id,
      opponent_player_id: event.opponent_player_id,
      opponent_player_out_id: event.opponent_player_out_id,
    }];
  });
  const starters = (side: 'home' | 'away', lineupPeriod: number) => (lineupsRes.data ?? [])
    .filter((row) => row.period_number === lineupPeriod && row.side === side)
    .sort((a, b) => a.position_index - b.position_index)
    .map((row) => (side === 'home' ? row.player_id : row.opponent_player_id))
    .filter((playerId): playerId is string => !!playerId);
  const onCourt = (side: 'home' | 'away') => {
    const known = (lineupsRes.data ?? [])
      .filter((row) => row.side === side && row.period_number <= period)
      .map((row) => row.period_number);
    if (known.length === 0) return [];
    const from = Math.max(...known);
    let ids = starters(side, from);
    for (let lineupPeriod = from; lineupPeriod <= period; lineupPeriod += 1) {
      ids = onCourtAfterSubs(ids, subs, lineupPeriod, side);
    }
    return ids;
  };
  const homeCourtIds = onCourt('home');
  const awayCourtIds = onCourt('away');
  const face = (playerId: string, side: 'home' | 'away'): ScoreboardPlayer => {
    const person = (side === 'home' ? homeById : awayById).get(playerId);
    return {
      id: playerId,
      name: person?.name ?? '',
      jerseyNumber: person?.jerseyNumber ?? null,
      avatarUrl: side === 'home' ? photos.get(playerId) ?? null : null,
    };
  };
  const timeoutEvents = events.map((event) => ({
    event_type: event.event_type,
    timeout_side: event.timeout_side,
    period_number: event.period_number,
  }));
  const banks = timeoutBanks(period).map((bank) => ({
    id: bank.id,
    label: bank.id.startsWith('ot-') ? `${headers.trke_eval_overtime}${bank.label}` : bank.label,
    max: bank.max,
    countPeriod: bank.countPeriod,
  }));
  const sideTimeouts = (side: 'home' | 'away') => banks.map((bank) => ({
    id: bank.id,
    label: bank.label,
    max: bank.max,
    used: countTimeouts(timeoutEvents, side, bank.countPeriod),
  }));

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6 text-gray-900 dark:bg-gray-950 dark:text-gray-100 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <EvalScoreboard
          homeName={ourName}
          awayName={opponentName}
          homeScore={storedHome}
          awayScore={storedAway}
          homePossessions={poss(result.homePossessions)}
          awayPossessions={poss(result.awayPossessions)}
          possession={possession}
          period={period}
          clockRunning={game.clock_running === true}
          clockLabel={formatGameClock(game.clock_remaining_ms ?? 0)}
          homeOnCourt={homeCourtIds.map((playerId) => face(playerId, 'home'))}
          awayOnCourt={awayCourtIds.map((playerId) => face(playerId, 'away'))}
          homeTimeouts={sideTimeouts('home')}
          awayTimeouts={sideTimeouts('away')}
          quarterLabel={headers.trke_eval_quarter}
          inPlayLabel={headers.trke_eval_in_play}
          stoppedLabel={headers.trke_eval_stopped}
          overtimeLabel={headers.trke_eval_overtime}
          timeoutPrefix={headers.trke_eval_timeout_short}
          possessionsLabel={headers.trke_eval_possessions}
          playersLabel={headers.trke_players}
          locationLabel={headers.trke_eval_location}
        >
          <EvalRefresh
            updatedAt={new Date().toISOString()}
            updatedLabel={headers.trke_eval_updated}
            reloadLabel={headers.trke_eval_reload_button}
          />
        </EvalScoreboard>

        {scoreMatches ? null : (
          <p className="text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            {headers.trke_eval_score_events}: {result.homePoints} – {result.awayPoints}
          </p>
        )}

        <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-900 dark:ring-1 dark:ring-white/10 sm:p-6">
          <h2 className="mb-3 flex items-center gap-1 text-lg font-bold">
            <button
              type="button"
              aria-label={headers.trke_eval_location}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/5 dark:text-gray-100 dark:hover:bg-white/10"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </button>
            {ourName}
          </h2>
          {result.home.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{headers.trke_eval_empty}</p>
          ) : (
            <EvalTable rows={result.home} locale={locale} headers={headers} photos={photos} onCourt={new Set(homeCourtIds)} />
          )}
        </section>

        <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-900 dark:ring-1 dark:ring-white/10 sm:p-6">
          <h2 className="mb-3 flex items-center gap-1 text-lg font-bold">
            <button
              type="button"
              aria-label={headers.trke_eval_location}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-black/5 dark:text-gray-100 dark:hover:bg-white/10"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
            </button>
            {opponentName}
          </h2>
          {result.away.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{headers.trke_eval_empty}</p>
          ) : (
            <EvalTable rows={result.away} locale={locale} headers={headers} photos={photos} onCourt={new Set(awayCourtIds)} portrait="avatar" />
          )}
        </section>
      </div>
    </main>
  );
}
