'use client';

import { useEffect, useState } from 'react';
import { BasketballCourt } from './BasketballCourt';
import { freeThrowNeedsRebound } from '@/lib/capture/free-throws';
import {
  foulKindFallback,
  foulKindKey,
  foulKinds,
  foulNeedsOther,
  foulThrowAllowance,
  shotFoulKinds,
  madeAssistRequired,
  offenseAttacksRight,
  otherCaptureSide,
  shotInPaint,
  shotOnAttackingHalf,
  shotValueFromWorld,
  turnoverReasonFallback,
  turnoverReasonKey,
  turnoverReasons,
  type CaptureSide,
  type FoulContext,
  type FoulKind,
  type FreeThrowMark,
  type ShotFoulKind,
  type TurnoverReason,
} from '@/lib/capture/plays';

export interface DeferredPlayer {
  id: string;
  jersey: number;
  name: string;
  onCourt: boolean;
  eliminated: boolean;
}

type DeferredPlay =
  | {
    play: 'made';
    side: CaptureSide;
    coordX: number;
    coordY: number;
    shooterId: string;
    assistId: string | null;
    foulerId: string | null;
    foulKind: ShotFoulKind | null;
    throws: FreeThrowMark[];
    rebounderId: string | null;
    unknownRebound: boolean;
  }
  | {
    play: 'miss';
    side: CaptureSide;
    coordX: number;
    coordY: number;
    shooterId: string;
    rebounderId: string | null;
    unknownRebound: boolean;
    deadBall: 'lodged' | 'period_end' | null;
    foulerId: string | null;
    foulKind: ShotFoulKind | null;
    throws: FreeThrowMark[];
  }
  | {
    play: 'foul';
    side: CaptureSide;
    coordX: number | null;
    coordY: number | null;
    foulKind: FoulKind;
    context: FoulContext;
    offenderId: string | null;
    otherId: string | null;
    coach: boolean;
    throws: FreeThrowMark[];
    rebounderId: string | null;
    unknownRebound: boolean;
  }
  | {
    play: 'substitution';
    side: CaptureSide;
    swaps: { outId: string; inId: string }[];
  }
  | { play: 'timeout'; side: CaptureSide }
  | {
    play: 'turnover';
    side: CaptureSide;
    coordX: number;
    coordY: number;
    reason: TurnoverReason;
    offenderId: string;
  }
  | { play: 'shot_clock' | 'eight_seconds' | 'five_seconds'; side: CaptureSide }
  | { play: 'jump_won' | 'jump_lost'; side: CaptureSide };

export type DeferredSequenceInput = DeferredPlay & {
  periodNumber: 1 | 2 | 3 | 4;
  clockRemainingMs: number;
};

type SequenceId = DeferredPlay['play'];

type Translate = (key: string, fallback: string) => string;

interface DeferredSequencePopupProps {
  t: Translate;
  homeName: string;
  awayName: string;
  period: number;
  clockRemainingMs: number;
  attackRightFirst: boolean;
  possession: CaptureSide | null;
  teamFouls: { home: number; away: number };
  homePlayers: DeferredPlayer[];
  awayPlayers: DeferredPlayer[];
  playersAt: (side: CaptureSide, periodNumber: 1 | 2 | 3 | 4, clockRemainingMs: number) => DeferredPlayer[];
  teamLogoUrl?: string | null;
  opponentColor?: string;
  opponentCode?: string;
  onClose: () => void;
  onSubmit: (input: DeferredSequenceInput) => Promise<string | null>;
}

const SEQUENCES: { id: SequenceId; key: string; fallback: string }[] = [
  { id: 'made', key: 'trke_deferred_sequence_made', fallback: 'Made basket' },
  { id: 'miss', key: 'trke_deferred_sequence_miss', fallback: 'Missed shot' },
  { id: 'foul', key: 'trke_foul_title', fallback: 'Foul' },
  { id: 'substitution', key: 'trke_sub_title', fallback: 'Substitution' },
  { id: 'timeout', key: 'trke_timeout_log', fallback: 'Timeout' },
  { id: 'turnover', key: 'trke_turnover_log', fallback: 'Turnover' },
  { id: 'shot_clock', key: 'trke_shot_clock_log', fallback: '24-second possession violation' },
  { id: 'eight_seconds', key: 'trke_eight_seconds_log', fallback: 'Did not cross half court in 8 seconds' },
  { id: 'five_seconds', key: 'trke_five_seconds_log', fallback: 'Did not inbound in 5 seconds' },
  { id: 'jump_won', key: 'trke_deferred_jump_won', fallback: 'Jump won' },
  { id: 'jump_lost', key: 'trke_deferred_jump_lost', fallback: 'Jump lost' },
];

const QUARTERS = [1, 2, 3, 4] as const;

function startingQuarter(period: number): 1 | 2 | 3 | 4 {
  if (period === 2 || period === 3 || period === 4) return period;
  return 1;
}

function formatClock(clockRemainingMs: number) {
  const clamped = Math.min(600000, Math.max(0, Math.floor(clockRemainingMs)));
  const minute = Math.floor(clamped / 60000);
  const second = Math.floor((clamped % 60000) / 1000);
  return `${minute}:${String(second).padStart(2, '0')}`;
}

/** `m:ss` or `mm:ss`, from 0:00 through 10:00. */
function clockFromText(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minuteValue = Number(match[1]);
  const secondValue = Number(match[2]);
  if (minuteValue > 10 || secondValue > 59) return null;
  if (minuteValue === 10 && secondValue !== 0) return null;
  return minuteValue * 60000 + secondValue * 1000;
}

const TURNOVER_REASON_ORDER: TurnoverReason[] = [
  'bad_pass_lost',
  'ball_handling_lost',
  ...turnoverReasons.filter((id) => id !== 'bad_pass_lost' && id !== 'ball_handling_lost'),
];

function labelOf(player: DeferredPlayer) {
  const name = player.name.trim();
  return name ? `#${player.jersey} ${name}` : `#${player.jersey}`;
}

function onCourt(players: DeferredPlayer[]) {
  return players.filter((player) => player.onCourt && !player.eliminated);
}

function onBench(players: DeferredPlayer[]) {
  return players.filter((player) => !player.onCourt && !player.eliminated);
}

export function DeferredSequencePopup({
  t,
  homeName,
  awayName,
  period,
  clockRemainingMs,
  attackRightFirst,
  possession,
  teamFouls,
  homePlayers,
  awayPlayers,
  playersAt,
  teamLogoUrl = null,
  opponentColor = '#737373',
  opponentCode = '',
  onClose,
  onSubmit,
}: DeferredSequencePopupProps) {
  const [play, setPlay] = useState<SequenceId | null>(null);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(startingQuarter(period));
  const [clockText, setClockText] = useState(formatClock(clockRemainingMs));
  const [side, setSide] = useState<CaptureSide | null>(possession);
  const [coord, setCoord] = useState<{ x: number; y: number } | null>(null);
  const [shooterId, setShooterId] = useState<string | null>(null);
  const [assistId, setAssistId] = useState<string | null>(null);
  const [foulerId, setFoulerId] = useState<string | null>(null);
  const [rebounderId, setRebounderId] = useState<string | null>(null);
  const [unknownRebound, setUnknownRebound] = useState(false);
  const [deadBall, setDeadBall] = useState<'lodged' | 'period_end' | null>(null);
  const [withFoul, setWithFoul] = useState(false);
  const [shotFoulKind, setShotFoulKind] = useState<ShotFoulKind | null>(null);
  const [throws, setThrows] = useState<(FreeThrowMark | null)[]>([]);
  const [foulKind, setFoulKind] = useState<FoulKind | null>(null);
  const [foulContext, setFoulContext] = useState<FoulContext | null>(null);
  const [coach, setCoach] = useState(false);
  const [otherId, setOtherId] = useState<string | null>(null);
  const [reason, setReason] = useState<TurnoverReason | null>(null);
  const [outId, setOutId] = useState<string | null>(null);
  const [inId, setInId] = useState<string | null>(null);
  const [swaps, setSwaps] = useState<{ outId: string; inId: string }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const roster = (which: CaptureSide) => (which === 'home' ? homePlayers : awayPlayers);
  const sideName = (which: CaptureSide) => (which === 'home' ? homeName : awayName);
  const choices = SEQUENCES;

  function pickPlay(next: SequenceId) {
    setPlay(next);
    setError('');
    setCoord(null);
    setShooterId(null);
    setAssistId(null);
    setFoulerId(null);
    setRebounderId(null);
    setUnknownRebound(false);
    setDeadBall(null);
    setWithFoul(false);
    setShotFoulKind(null);
    setThrows([]);
    setFoulKind(null);
    setFoulContext(null);
    setCoach(false);
    setOtherId(null);
    setReason(null);
    setSwaps([]);
    setOutId(null);
    setInId(null);
    if (next === 'made' || next === 'miss' || next === 'turnover' || next === 'shot_clock' || next === 'eight_seconds' || next === 'five_seconds') {
      setSide(possession);
    }
  }

  function attacksRight(which: CaptureSide) {
    return offenseAttacksRight(which, quarter, attackRightFirst);
  }

  function shotFacts(which: CaptureSide) {
    if (!coord) return null;
    const right = attacksRight(which);
    if (!shotOnAttackingHalf(coord.x, right)) return null;
    const points = shotValueFromWorld(coord.x, coord.y, right);
    const paint = shotInPaint(coord.x, coord.y, right);
    return { points, paint };
  }

  function onCourtAt(which: CaptureSide) {
    if (enteredClock == null) return [];
    return playersAt(which, quarter, enteredClock);
  }

  function mates(which: CaptureSide, exceptId: string | null) {
    return onCourtAt(which).filter((player) => player.id !== exceptId);
  }

  const enteredClock = clockFromText(clockText);
  const turnoverPlayers = play === 'turnover' && side && enteredClock != null
    ? playersAt(side, quarter, enteredClock)
    : [];

  useEffect(() => {
    if (play !== 'turnover' || !shooterId || enteredClock == null) return;
    if (turnoverPlayers.some((player) => player.id === shooterId)) return;
    setShooterId(null);
  }, [play, shooterId, enteredClock, turnoverPlayers]);

  useEffect(() => {
    if (play === 'made' && withFoul) {
      setThrows((current) => (current.length === 1 ? current : [null]));
      return;
    }
    if (play === 'miss' && withFoul && side && coord) {
      const right = attacksRight(side);
      if (!shotOnAttackingHalf(coord.x, right)) return;
      const count = shotValueFromWorld(coord.x, coord.y, right);
      setThrows((current) => (current.length === count ? current : Array.from({ length: count }, () => null)));
      return;
    }
    if (play !== 'foul' || !foulKind || !side) return;
    const context: FoulContext | null = foulKind === 'personal'
      ? foulContext
      : foulKind === 'technical'
        ? 'technical'
        : foulKind === 'double'
          ? 'double'
          : 'no_shot';
    if (!context) return;
    const count = foulThrowAllowance({
      kind: foulKind,
      context,
      teamFoulsBefore: teamFouls[side],
    });
    setThrows((current) => (current.length === count ? current : Array.from({ length: count }, () => null)));
  }, [play, withFoul, side, coord, foulKind, foulContext, quarter, attackRightFirst, teamFouls]);

  const madeFacts = play === 'made' && side ? shotFacts(side) : null;
  const shotMarked = (play === 'made' || play === 'miss') && withFoul && shotFoulKind
    ? completedThrows(play === 'made' ? 1 : (side ? shotFacts(side)?.points ?? 0 : 0))
    : null;
  const shotNeedsRebound = !!shotMarked && !!shotFoulKind && (play === 'made' || play === 'miss')
    && freeThrowNeedsRebound({
      source: play === 'miss' ? 'miss' : 'made',
      kind: shotFoulKind,
      throws: shotMarked,
    });
  const foulContextNow: FoulContext | null = foulKind === 'personal'
    ? foulContext
    : foulKind === 'technical'
      ? 'technical'
      : foulKind === 'double'
        ? 'double'
        : foulKind
          ? 'no_shot'
          : null;
  const foulAward = play === 'foul' && foulKind && foulContextNow && side
    ? foulThrowAllowance({ kind: foulKind, context: foulContextNow, teamFoulsBefore: teamFouls[side] })
    : null;
  const foulMarked = foulAward != null ? completedThrows(foulAward) : null;
  const foulNeedsRebound = !!foulMarked && !!foulKind && !!foulContextNow
    && freeThrowNeedsRebound({ source: 'foul', kind: foulKind, context: foulContextNow, throws: foulMarked });

  const assistNeeded = !!(
    play === 'made'
    && side
    && shooterId
    && madeFacts
    && madeAssistRequired(madeFacts.points, madeFacts.paint, mates(side, shooterId).length)
  );

  function completedThrows(count: number): FreeThrowMark[] | null {
    if (throws.length !== count) return null;
    if (throws.some((mark) => mark !== 'made' && mark !== 'miss')) return null;
    return throws as FreeThrowMark[];
  }

  function foulReady() {
    if (!side || !foulKind) return false;
    const context: FoulContext | null = foulKind === 'personal'
      ? foulContext
      : foulKind === 'technical'
        ? 'technical'
        : foulKind === 'double'
          ? 'double'
          : 'no_shot';
    if (!context) return false;
    const allowance = foulThrowAllowance({ kind: foulKind, context, teamFoulsBefore: teamFouls[side] });
    const marked = completedThrows(allowance);
    if (!marked) return false;
    if (coach) return foulKind === 'technical' && !!otherId;
    if (!coord || !onCourtAt(side).some((player) => player.id === shooterId)) return false;
    const needsOther = foulNeedsOther({ kind: foulKind, context, teamFoulsBefore: teamFouls[side] });
    if (needsOther && !otherId) return false;
    if (!needsOther && otherId) return false;
    const needsRebound = freeThrowNeedsRebound({ source: 'foul', kind: foulKind, context, throws: marked });
    if (needsRebound) return !!rebounderId || unknownRebound;
    return !rebounderId && !unknownRebound;
  }

  function ready() {
    if (!play || enteredClock == null) return false;
    if (play === 'jump_won' || play === 'jump_lost') return !!side;
    if (!side) return false;
    if (play === 'timeout') return true;
    if (play === 'shot_clock' || play === 'eight_seconds' || play === 'five_seconds') {
      return true;
    }
    if (play === 'substitution') return swaps.length >= 1 && swaps.length <= 5;
    if (play === 'turnover') {
      return !!coord
        && !!reason
        && turnoverPlayers.some((player) => player.id === shooterId);
    }
    if (play === 'made') {
      if (!madeFacts || !shooterId) return false;
      if (assistNeeded && !assistId) return false;
      if (assistId && assistId === shooterId) return false;
      if (withFoul) {
        const marked = completedThrows(1);
        if (!shotFoulKind || !foulerId || foulerId === shooterId || foulerId === assistId || !marked) return false;
        const needsRebound = freeThrowNeedsRebound({ source: 'made', kind: shotFoulKind, throws: marked });
        if (needsRebound) return !!rebounderId || unknownRebound;
        return !rebounderId && !unknownRebound;
      }
      return throws.length === 0 && !foulerId;
    }
    if (play === 'miss') {
      if (!side || !shotFacts(side) || !shooterId) return false;
      if (withFoul) {
        const count = shotFacts(side)?.points;
        const marked = count ? completedThrows(count) : null;
        if (!shotFoulKind || !foulerId || foulerId === shooterId || !marked) return false;
        const needsRebound = freeThrowNeedsRebound({ source: 'miss', kind: shotFoulKind, throws: marked });
        if (needsRebound) return !!rebounderId || unknownRebound;
        return !rebounderId && !unknownRebound && !deadBall;
      }
      const reboundChoices = [!!rebounderId, unknownRebound, !!deadBall].filter(Boolean).length;
      return reboundChoices === 1 && throws.length === 0;
    }
    return foulReady();
  }

  async function save() {
    if (!ready() || saving || !play) return;
    setSaving(true);
    setError('');
    if (enteredClock == null) {
      setSaving(false);
      setError(t('trke_deferred_clock_invalid', 'Enter a time from 0:00 to 10:00'));
      return;
    }
    const stamp = { periodNumber: quarter, clockRemainingMs: enteredClock };
    let input: DeferredSequenceInput | null = null;
    if ((play === 'jump_won' || play === 'jump_lost') && side) {
      input = { ...stamp, play, side };
    } else if (play === 'timeout' && side) {
      input = { ...stamp, play: 'timeout', side };
    } else if ((play === 'shot_clock' || play === 'eight_seconds' || play === 'five_seconds') && side) {
      input = { ...stamp, play, side };
    } else if (play === 'substitution' && side) {
      input = { ...stamp, play: 'substitution', side, swaps };
    } else if (play === 'turnover' && side && coord && reason && shooterId) {
      input = { ...stamp, play: 'turnover', side, coordX: coord.x, coordY: coord.y, reason, offenderId: shooterId };
    } else if (play === 'made' && side && coord && shooterId) {
      input = {
        ...stamp,
        play: 'made',
        side,
        coordX: coord.x,
        coordY: coord.y,
        shooterId,
        assistId,
        foulerId: withFoul ? foulerId : null,
        foulKind: withFoul ? shotFoulKind : null,
        throws: withFoul ? (completedThrows(throws.length) ?? []) : [],
        rebounderId: withFoul ? rebounderId : null,
        unknownRebound: withFoul && unknownRebound,
      };
    } else if (play === 'miss' && side && coord && shooterId) {
      input = {
        ...stamp,
        play: 'miss',
        side,
        coordX: coord.x,
        coordY: coord.y,
        shooterId,
        rebounderId: deadBall ? null : rebounderId,
        unknownRebound: !deadBall && unknownRebound,
        deadBall: withFoul || unknownRebound ? null : deadBall,
        foulerId: withFoul ? foulerId : null,
        foulKind: withFoul ? shotFoulKind : null,
        throws: withFoul ? (completedThrows(throws.length) ?? []) : [],
      };
    } else if (play === 'foul' && side && foulKind) {
      const context: FoulContext = foulKind === 'personal'
        ? (foulContext ?? 'no_shot')
        : foulKind === 'technical'
          ? 'technical'
          : foulKind === 'double'
            ? 'double'
            : 'no_shot';
      input = {
        ...stamp,
        play: 'foul',
        side,
        coordX: coach || !coord ? null : coord.x,
        coordY: coach || !coord ? null : coord.y,
        foulKind,
        context,
        offenderId: coach ? null : shooterId,
        otherId,
        coach,
        throws: completedThrows(throws.length) ?? [],
        rebounderId,
        unknownRebound,
      };
    }
    if (!input) {
      setSaving(false);
      setError(t('trke_deferred_need_players', 'Choose the players'));
      return;
    }
    const message = await onSubmit(input);
    setSaving(false);
    if (message) setError(message);
    else onClose();
  }

  function addSwap() {
    if (!side || !outId || !inId || outId === inId || swaps.length >= 5) return;
    if (swaps.some((swap) => swap.outId === outId || swap.inId === inId)) return;
    setSwaps((current) => [...current, { outId, inId }]);
    setOutId(null);
    setInId(null);
  }

  const courtSide = side;
  const showCourt = !!courtSide && (
    play === 'made'
    || play === 'miss'
    || play === 'turnover'
    || (play === 'foul' && !coach)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deferred-sequence-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="deferred-sequence-title" className="text-base font-black">
            {play ? t(choices.find((item) => item.id === play)?.key ?? 'trke_deferred_add', 'Add a sequence') : t('trke_deferred_pick', 'Which sequence?')}
          </h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded px-3 text-sm font-bold">
            {t('trke_cancel', 'Cancel')}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {!play ? (
            <div className="flex flex-col gap-2">
              {choices.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickPlay(item.id)}
                  className="min-h-11 rounded-lg border border-neutral-300 px-3 text-left text-sm font-bold hover:bg-neutral-100"
                >
                  {t(item.key, item.fallback)}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-xs font-medium text-neutral-600">{t('trke_deferred_quarter', 'Quarter')}</p>
                <div className="grid grid-cols-4 gap-2">
                  {QUARTERS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setQuarter(item);
                        setCoord(null);
                      }}
                      className={`min-h-11 rounded-lg border text-sm font-bold ${quarter === item ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                    >
                      Q{item}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-medium">
                mm:ss
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="mm:ss"
                  aria-label="mm:ss"
                  value={clockText}
                  onChange={(event) => {
                    const next = event.target.value.replace(/[^\d:]/g, '').slice(0, 5);
                    setClockText(next);
                  }}
                  className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
                  style={{ colorScheme: 'light' }}
                />
              </label>
              {enteredClock == null ? (
                <p className="text-sm text-red-700">{t('trke_deferred_clock_invalid', 'Enter a time from 0:00 to 10:00')}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {(['home', 'away'] as const).map((which) => (
                  <button
                    key={which}
                    type="button"
                    onClick={() => { setSide(which); setCoord(null); setShooterId(null); setFoulerId(null); setOtherId(null); setSwaps([]); }}
                    className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${side === which ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                  >
                    {sideName(which)}
                  </button>
                ))}
              </div>

              {showCourt && courtSide ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-neutral-600">{t('trke_deferred_need_spot', 'Tap the spot on the court')}</p>
                  <div className="aspect-[28/15] w-full">
                    <BasketballCourt
                      className="h-full w-full"
                      attackingRight={offenseAttacksRight('home', quarter, attackRightFirst)}
                      isOffense={courtSide === 'home'}
                      teamLogoUrl={teamLogoUrl}
                      opponentColor={opponentColor}
                      opponentCode={opponentCode}
                      logoClipId="deferred-home-attack-logo"
                      onCourtTap={(x, y) => setCoord({ x, y })}
                      placement={coord}
                    />
                  </div>
                  {coord && play !== 'turnover' && play !== 'foul' && !shotFacts(courtSide) ? (
                    <p className="mt-1 text-xs text-red-700">{t('trke_made_hint_half', 'That point is not on the attacking half')}</p>
                  ) : null}
                </div>
              ) : null}

              {play === 'turnover' ? (
                <PlayerField
                  label={t('trke_turnover_hint_player', 'Choose the player who lost the ball')}
                  players={turnoverPlayers}
                  value={shooterId}
                  onChange={setShooterId}
                />
              ) : null}

              {play === 'made' || play === 'miss' || (play === 'foul' && !coach) ? (
                <PlayerField
                  label={play === 'foul'
                    ? t('trke_foul_hint_player', 'Choose who committed the foul')
                    : t('trke_deferred_need_players', 'Choose the players')}
                  players={side ? onCourtAt(side) : []}
                  value={shooterId}
                  onChange={setShooterId}
                />
              ) : null}

              {play === 'made' && side && shooterId ? (
                <PlayerField
                  label={t('trke_made_hint_assist', 'Choose the assist')}
                  players={mates(side, shooterId)}
                  value={assistId}
                  onChange={setAssistId}
                  allowEmpty={!assistNeeded}
                />
              ) : null}

              {play === 'made' || play === 'miss' ? (
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={withFoul} onChange={(event) => { setWithFoul(event.target.checked); setShotFoulKind(null); setThrows([]); setFoulerId(null); setRebounderId(null); setDeadBall(null); setUnknownRebound(false); }} />
                  {t('trke_foul', 'Foul')}
                </label>
              ) : null}

              {(play === 'made' || play === 'miss') && withFoul && side ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {shotFoulKinds.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => { setShotFoulKind(kind); setRebounderId(null); setUnknownRebound(false); }}
                        className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${shotFoulKind === kind ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                      >
                        {t(foulKindKey[kind], foulKindFallback[kind])}
                      </button>
                    ))}
                  </div>
                  <PlayerField
                    label={t('trke_made_hint_fouler', 'Choose who committed the foul')}
                    players={onCourtAt(otherCaptureSide(side))}
                    value={foulerId}
                    onChange={setFoulerId}
                  />
                </>
              ) : null}

              {(play === 'miss' && !withFoul) || shotNeedsRebound || foulNeedsRebound ? (
                <>
                  <PlayerField
                    label={t('trke_miss_hint_rebound', 'Choose who took the rebound')}
                    players={[...onCourtAt('home'), ...onCourtAt('away')]}
                    value={rebounderId}
                    onChange={(id) => { setRebounderId(id); setDeadBall(null); setUnknownRebound(false); }}
                  />
                  <button
                    type="button"
                    aria-pressed={unknownRebound}
                    aria-label={t('trke_unknown_rebound', 'Rebound by the other team. Player unknown.')}
                    onClick={() => {
                      setUnknownRebound((current) => !current);
                      setRebounderId(null);
                      setDeadBall(null);
                    }}
                    className={`flex min-h-11 w-full items-center justify-center rounded-lg border text-2xl font-black ${unknownRebound ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                  >
                    ?
                  </button>
                  {play === 'miss' && !withFoul ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => { setDeadBall(deadBall === 'lodged' ? null : 'lodged'); setRebounderId(null); setUnknownRebound(false); }}
                      className={`min-h-11 rounded-lg border px-3 text-left text-sm font-bold ${deadBall === 'lodged' ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                    >
                      {t('trke_miss_lodged', 'Ball lodged between the ring and the backboard')}
                      <span className={`mt-0.5 block text-xs font-medium ${deadBall === 'lodged' ? 'text-neutral-200' : 'text-neutral-600'}`}>
                        {t('trke_miss_lodged_hint', 'Alternating-possession throw-in. The arrow reverses.')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeadBall(deadBall === 'period_end' ? null : 'period_end'); setRebounderId(null); setUnknownRebound(false); }}
                      className={`min-h-11 rounded-lg border px-3 text-left text-sm font-bold ${deadBall === 'period_end' ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                    >
                      {t('trke_miss_period_end', 'End of the period')}
                      <span className={`mt-0.5 block text-xs font-medium ${deadBall === 'period_end' ? 'text-neutral-200' : 'text-neutral-600'}`}>
                        {t('trke_miss_period_end_hint', 'No rebound. The arrow stays as it is.')}
                      </span>
                    </button>
                  </div>
                  ) : null}
                </>
              ) : null}

              {((play === 'made' || play === 'miss') && withFoul && throws.length > 0) ? (
                <>
                  <p className="text-xs font-medium text-neutral-600">
                    {throws.length === 1
                      ? t('trke_ft_awarded_1', '1 free throw')
                      : throws.length === 2
                        ? t('trke_ft_awarded_2', '2 free throws')
                        : t('trke_ft_awarded_3', '3 free throws')}
                  </p>
                  <ThrowMarks
                    t={t}
                    marks={throws}
                    onChange={(marks) => {
                      setThrows(marks);
                      const done = marks.length > 0 && marks.every((mark) => mark === 'made' || mark === 'miss');
                      if (done && shotFoulKind && !freeThrowNeedsRebound({
                        source: play === 'miss' ? 'miss' : 'made',
                        kind: shotFoulKind,
                        throws: marks as FreeThrowMark[],
                      })) {
                        setRebounderId(null);
                        setUnknownRebound(false);
                      }
                    }}
                  />
                </>
              ) : null}

              {play === 'foul' && side ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {foulKinds.map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => { setFoulKind(kind); setFoulContext(kind === 'personal' ? null : kind === 'technical' ? 'technical' : kind === 'double' ? 'double' : 'no_shot'); setCoach(false); setThrows([]); setOtherId(null); }}
                        className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${foulKind === kind ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                      >
                        {t(foulKindKey[kind], foulKindFallback[kind])}
                      </button>
                    ))}
                  </div>
                  {foulKind === 'personal' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setFoulContext('offensive'); setThrows([]); setOtherId(null); }} className={`min-h-11 rounded-lg border text-sm font-bold ${foulContext === 'offensive' ? 'border-black bg-black text-white' : 'border-neutral-300'}`}>
                        {t('trke_foul_offensive', 'Offensive foul')}
                      </button>
                      <button type="button" onClick={() => { setFoulContext('no_shot'); setThrows([]); }} className={`min-h-11 rounded-lg border text-sm font-bold ${foulContext === 'no_shot' ? 'border-black bg-black text-white' : 'border-neutral-300'}`}>
                        {t('trke_foul_no_shot', 'No shot')}
                      </button>
                    </div>
                  ) : null}
                  {foulKind === 'technical' ? (
                    <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                      <input type="checkbox" checked={coach} onChange={(event) => { setCoach(event.target.checked); setShooterId(null); setCoord(null); }} />
                      {t('trke_team_coach', 'Coach')}
                    </label>
                  ) : null}
                  {foulKind && foulContext && foulNeedsOther({ kind: foulKind, context: foulKind === 'personal' ? foulContext : foulKind === 'technical' ? 'technical' : foulKind === 'double' ? 'double' : 'no_shot', teamFoulsBefore: teamFouls[side] }) ? (
                    <PlayerField
                      label={t('trke_foul_hint_victim', 'Choose who was fouled')}
                      players={onCourtAt(otherCaptureSide(side))}
                      value={otherId}
                      onChange={setOtherId}
                    />
                  ) : null}
                  {foulAward != null && foulAward > 0 ? (
                    <>
                      <p className="text-xs font-medium text-neutral-600">
                        {foulAward === 1
                          ? t('trke_ft_awarded_1', '1 free throw')
                          : foulAward === 2
                            ? t('trke_ft_awarded_2', '2 free throws')
                            : t('trke_ft_awarded_3', '3 free throws')}
                      </p>
                      <ThrowMarks
                        t={t}
                        marks={throws}
                        onChange={(marks) => {
                          setThrows(marks);
                          const done = foulKind && foulContextNow && marks.length > 0
                            && marks.every((mark) => mark === 'made' || mark === 'miss');
                          if (done && foulKind && foulContextNow && !freeThrowNeedsRebound({
                            source: 'foul',
                            kind: foulKind,
                            context: foulContextNow,
                            throws: marks as FreeThrowMark[],
                          })) {
                            setRebounderId(null);
                            setUnknownRebound(false);
                          }
                        }}
                      />
                    </>
                  ) : null}
                </>
              ) : null}

              {play === 'turnover' ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-neutral-600">{t('trke_turnover_log', 'Turnover')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TURNOVER_REASON_ORDER.slice(0, 2).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={reason === item}
                        onClick={() => setReason(item)}
                        className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${reason === item ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                      >
                        {t(turnoverReasonKey[item], turnoverReasonFallback[item])}
                      </button>
                    ))}
                  </div>
                  <div className="my-2 border-t border-neutral-300" role="separator" />
                  <div className="grid grid-cols-2 gap-2">
                    {TURNOVER_REASON_ORDER.slice(2).map((item) => (
                      <button
                        key={item}
                        type="button"
                        aria-pressed={reason === item}
                        onClick={() => setReason(item)}
                        className={`min-h-11 rounded-lg border px-2 text-sm font-bold ${reason === item ? 'border-black bg-black text-white' : 'border-neutral-300'}`}
                      >
                        {t(turnoverReasonKey[item], turnoverReasonFallback[item])}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {play === 'substitution' && side ? (
                <div className="flex flex-col gap-2">
                  <PlayerField label={t('trke_sub_hint_out', 'Tap who leaves')} players={onCourt(roster(side)).filter((player) => !swaps.some((swap) => swap.outId === player.id))} value={outId} onChange={setOutId} />
                  <PlayerField label={t('trke_sub_hint_in', 'Tap who comes in from the bench')} players={onBench(roster(side)).filter((player) => !swaps.some((swap) => swap.inId === player.id))} value={inId} onChange={setInId} />
                  <button type="button" onClick={addSwap} disabled={!outId || !inId || swaps.length >= 5} className="min-h-11 rounded-lg border border-neutral-300 text-sm font-bold disabled:opacity-40">
                    {t('trke_sub_title', 'Substitution')}
                  </button>
                  {swaps.map((swap) => (
                    <p key={`${swap.outId}-${swap.inId}`} className="text-sm">
                      {labelOf([...homePlayers, ...awayPlayers].find((player) => player.id === swap.outId) ?? { id: swap.outId, jersey: 0, name: '', onCourt: true, eliminated: false })}
                      {' → '}
                      {labelOf([...homePlayers, ...awayPlayers].find((player) => player.id === swap.inId) ?? { id: swap.inId, jersey: 0, name: '', onCourt: false, eliminated: false })}
                    </p>
                  ))}
                </div>
              ) : null}

              {error ? <p className="text-sm text-red-700">{error}</p> : null}
            </div>
          )}
        </div>
        {play ? (
          <footer className="flex gap-2 border-t border-neutral-200 px-4 py-3">
            <button type="button" onClick={() => { setPlay(null); setError(''); }} className="min-h-11 flex-1 rounded-lg border border-neutral-300 text-sm font-bold">
              {t('trke_step_back', 'Step back')}
            </button>
            <button type="button" onClick={() => { void save(); }} disabled={!ready() || saving} className="min-h-11 flex-1 rounded-lg bg-black text-sm font-black text-amber-300 disabled:opacity-40">
              {t('trke_save', 'Save')}
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

function PlayerField({
  label,
  players,
  value,
  onChange,
  allowEmpty,
  emptyLabel,
}: {
  label: string;
  players: DeferredPlayer[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="mt-1 block min-h-11 w-full rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-900"
      >
        <option value="">{allowEmpty ? (emptyLabel ?? '') : ''}</option>
        {players.map((player) => (
          <option key={player.id} value={player.id}>{labelOf(player)}</option>
        ))}
      </select>
    </label>
  );
}

function ThrowMarks({
  t,
  marks,
  onChange,
}: {
  t: Translate;
  marks: readonly (FreeThrowMark | null)[];
  onChange: (marks: (FreeThrowMark | null)[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {marks.map((mark, index) => (
        <div key={index} className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onChange(marks.map((item, itemIndex) => itemIndex === index ? 'made' : item))} className={`min-h-11 rounded-lg border text-sm font-bold ${mark === 'made' ? 'border-black bg-black text-white' : 'border-neutral-300'}`}>
            {t('trke_ft_made', 'Made')}
          </button>
          <button type="button" onClick={() => onChange(marks.map((item, itemIndex) => itemIndex === index ? 'miss' : item))} className={`min-h-11 rounded-lg border text-sm font-bold ${mark === 'miss' ? 'border-black bg-black text-white' : 'border-neutral-300'}`}>
            {t('trke_ft_missed', 'Missed')}
          </button>
        </div>
      ))}
    </div>
  );
}
