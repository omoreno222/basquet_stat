'use client';

import { useState } from 'react';

export interface OpponentRosterDraft {
  key: string;
  id: string | null;
  jerseyNumber: string;
  name: string;
  isCoach: boolean;
  removable: boolean;
}

export interface OpponentRosterInput {
  id: string | null;
  jersey_number: number | null;
  name: string | null;
  is_coach: boolean;
}

const ROSTER_HINT = 'Enter up to 12 jerseys. Add the coach with the button. The coach has no jersey.';

type Translate = (key: string, fallback: string) => string;

interface OpponentRosterModalProps {
  t: Translate;
  lineupLocked: boolean;
  canClose: boolean;
  initialPlayers: OpponentRosterDraft[];
  onSave: (players: OpponentRosterInput[]) => Promise<string | null>;
  onClose: () => void;
}

function emptyRow(isCoach: boolean): OpponentRosterDraft {
  return {
    key: crypto.randomUUID(),
    id: null,
    jerseyNumber: '',
    name: '',
    isCoach,
    removable: true,
  };
}

function jerseyDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 2);
}

export function OpponentRosterModal({
  t,
  lineupLocked,
  canClose,
  initialPlayers,
  onSave,
  onClose,
}: OpponentRosterModalProps) {
  const [rows, setRows] = useState<OpponentRosterDraft[]>(
    initialPlayers.length > 0 ? initialPlayers : Array.from({ length: 5 }, () => emptyRow(false)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const playerRows = rows.filter((row) => !row.isCoach);
  const coachRow = rows.find((row) => row.isCoach) ?? null;
  const playerCount = playerRows.length;
  const hasCoach = coachRow !== null;

  function updateRow(key: string, patch: Partial<OpponentRosterDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow(isCoach: boolean) {
    if (isCoach) {
      if (hasCoach) {
        setError(t('trke_opponent_roster_one_coach', 'Only one coach'));
        return;
      }
    } else if (playerCount >= 12) {
      setError(t('trke_opponent_roster_max', 'This game already has 12 opponent jerseys'));
      return;
    }
    setError(null);
    setRows((current) => [...current, emptyRow(isCoach)]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  async function save() {
    const players: OpponentRosterInput[] = [];
    for (const row of rows) {
      const name = row.name.trim() === '' ? null : row.name.trim();
      if (row.isCoach) {
        players.push({ id: row.id, jersey_number: null, name, is_coach: true });
        continue;
      }
      if (row.jerseyNumber.trim() === '' && name === null) continue;
      if (!/^\d{1,2}$/.test(row.jerseyNumber)) {
        setError(t('trke_opponent_roster_hint', ROSTER_HINT));
        return;
      }
      players.push({
        id: row.id,
        jersey_number: Number(row.jerseyNumber),
        name,
        is_coach: false,
      });
    }
    setSaving(true);
    const message = await onSave(players);
    setSaving(false);
    if (message) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="opponent-roster-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col border border-neutral-300 bg-white text-neutral-900 shadow-2xl"
      >
        <header className="shrink-0 border-b border-neutral-200 bg-neutral-100 px-4 py-3">
          <h2 id="opponent-roster-title" className="text-center text-lg font-black tracking-tight">
            {t('trke_opponent_roster_title', 'Opponent roster')}
          </h2>
          <p className="mt-1 text-center text-[11px] font-medium text-neutral-500">
            {lineupLocked
              ? t('trke_opponent_roster_locked', 'The starting five cannot be changed after the game starts')
              : t('trke_opponent_roster_hint', ROSTER_HINT)}
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-2">
            {playerRows.map((row, index) => (
              <div key={row.key} className="rounded-lg border border-neutral-200 p-2">
                <div className="flex gap-2">
                  <input
                    inputMode="numeric"
                    aria-label={`${t('trke_opponent_roster_jersey', 'Jersey')} ${index + 1}`}
                    value={row.jerseyNumber}
                    placeholder="–"
                    onChange={(event) => updateRow(row.key, { jerseyNumber: jerseyDigits(event.target.value) })}
                    className="h-11 w-16 shrink-0 rounded-lg border border-neutral-300 bg-white text-center text-xl font-black tabular-nums text-neutral-900 outline-none focus:border-neutral-900"
                  />
                  <input
                    aria-label={`${t('trke_opponent_roster_name', 'Name, if readable')} ${index + 1}`}
                    value={row.name}
                    maxLength={80}
                    placeholder={t('trke_opponent_roster_name', 'Name, if readable')}
                    onChange={(event) => updateRow(row.key, { name: event.target.value.slice(0, 80) })}
                    className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
                  />
                  {row.removable ? (
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="h-11 shrink-0 px-2 text-xs font-bold text-neutral-500 hover:text-neutral-900"
                    >
                      {t('trke_opponent_roster_remove', 'Remove')}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {playerCount < 12 && (
            <button
              type="button"
              onClick={() => addRow(false)}
              className="mt-3 w-full rounded-lg border border-dashed border-neutral-400 py-3 text-sm font-bold text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              style={{ minHeight: '44px' }}
            >
              {t('trke_opponent_roster_add', 'Add jersey')}
            </button>
          )}
          {coachRow ? (
            <div className="mt-3 rounded-lg border border-neutral-900 bg-neutral-50 p-2">
              <div className="flex gap-2">
                <div className="flex h-11 shrink-0 items-center rounded-lg bg-neutral-900 px-3 text-xs font-black uppercase tracking-wide text-white">
                  {t('trke_opponent_roster_coach', 'Coach')}
                </div>
                <input
                  aria-label={t('trke_opponent_roster_coach_name', 'Coach name')}
                  value={coachRow.name}
                  maxLength={80}
                  placeholder={t('trke_opponent_roster_coach_name', 'Coach name')}
                  onChange={(event) => updateRow(coachRow.key, { name: event.target.value.slice(0, 80) })}
                  className="h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
                />
                {coachRow.removable ? (
                  <button
                    type="button"
                    onClick={() => removeRow(coachRow.key)}
                    className="h-11 shrink-0 px-2 text-xs font-bold text-neutral-500 hover:text-neutral-900"
                  >
                    {t('trke_opponent_roster_remove', 'Remove')}
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addRow(true)}
              className="mt-2 w-full rounded-lg border border-dashed border-neutral-400 py-3 text-sm font-bold text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              style={{ minHeight: '44px' }}
            >
              {t('trke_opponent_roster_add_coach', 'Add coach')}
            </button>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-neutral-200 p-3">
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-neutral-200 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-300"
              style={{ minHeight: '48px' }}
            >
              {t('trke_cancel', 'Cancel')}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => { void save(); }}
            className="flex-1 bg-neutral-900 py-3 text-sm font-black text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
            style={{ minHeight: '48px' }}
          >
            {t('trke_opponent_roster_save', 'Save roster')}
          </button>
        </footer>
      </div>
    </div>
  );
}
