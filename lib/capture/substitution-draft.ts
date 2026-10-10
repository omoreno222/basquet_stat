export const COURT_MAX = 5;

export interface SubstitutionSwap {
  outId: string;
  inId: string;
}

export interface SubstitutionDraft {
  /** Replacements already paired. The bench player is not on court until this exists. */
  swaps: SubstitutionSwap[];
  /** Bench players added to complete a short court. They do not replace anyone. */
  entries: string[];
  /** Players who have left and still need a replacement, including a foul-out. */
  waitingOutIds: string[];
  /** Bench player chosen first. They stay on the bench until someone on court is tapped. */
  pendingInId: string | null;
}

export function createSubstitutionDraft(initialCourt: string[], forcedOutId: string | null): SubstitutionDraft {
  const parked = forcedOutId && initialCourt.includes(forcedOutId) ? forcedOutId : null;
  return {
    swaps: [],
    entries: [],
    waitingOutIds: parked ? [parked] : [],
    pendingInId: null,
  };
}

export function draftCourtIds(initialCourt: string[], draft: SubstitutionDraft): string[] {
  const gone = new Set([...draft.swaps.map((swap) => swap.outId), ...draft.waitingOutIds]);
  return [
    ...initialCourt.filter((id) => !gone.has(id)),
    ...draft.swaps.map((swap) => swap.inId),
    ...draft.entries,
  ];
}

export function substitutionReady(
  draft: SubstitutionDraft,
  saving: boolean,
  courtSize = COURT_MAX,
  minimumOnCourt = 0,
): boolean {
  return !saving
    && draft.pendingInId == null
    && draft.waitingOutIds.length === 0
    && (draft.swaps.length > 0 || draft.entries.length > 0)
    && courtSize >= minimumOnCourt;
}

export type SubstitutionTap =
  | { kind: 'bench'; playerId: string; eliminated: boolean; forcedOut: boolean }
  | { kind: 'court'; playerId: string };

export function applySubstitutionTap(
  initialCourt: string[],
  draft: SubstitutionDraft,
  tap: SubstitutionTap,
  fillVacancies = false,
): { draft: SubstitutionDraft; full: boolean } {
  const court = draftCourtIds(initialCourt, draft);

  if (tap.kind === 'court') {
    if (!court.includes(tap.playerId)) return { draft, full: false };
    const entered = draft.swaps.findIndex((swap) => swap.inId === tap.playerId);
    if (entered !== -1) {
      const swap = draft.swaps[entered];
      return {
        draft: {
          swaps: draft.swaps.filter((_, index) => index !== entered),
          entries: draft.entries,
          waitingOutIds: [...draft.waitingOutIds, swap.outId],
          pendingInId: null,
        },
        full: false,
      };
    }
    if (draft.entries.includes(tap.playerId)) {
      return {
        draft: {
          ...draft,
          entries: draft.entries.filter((id) => id !== tap.playerId),
          pendingInId: null,
        },
        full: false,
      };
    }
    if (!initialCourt.includes(tap.playerId) || draft.waitingOutIds.includes(tap.playerId)) {
      return { draft, full: false };
    }
    if (fillVacancies && court.length < COURT_MAX && !draft.pendingInId) {
      return { draft, full: false };
    }
    if (draft.pendingInId) {
      return {
        draft: {
          swaps: [...draft.swaps, { outId: tap.playerId, inId: draft.pendingInId }],
          entries: draft.entries,
          waitingOutIds: draft.waitingOutIds,
          pendingInId: null,
        },
        full: false,
      };
    }
    return {
      draft: {
        ...draft,
        pendingInId: null,
        waitingOutIds: [...draft.waitingOutIds, tap.playerId],
      },
      full: false,
    };
  }

  if (tap.eliminated || tap.forcedOut || court.includes(tap.playerId)) return { draft, full: false };

  const asOut = draft.swaps.findIndex((swap) => swap.outId === tap.playerId);
  if (asOut !== -1) {
    return {
      draft: {
        swaps: draft.swaps.filter((_, index) => index !== asOut),
        entries: draft.entries,
        waitingOutIds: draft.waitingOutIds,
        pendingInId: null,
      },
      full: false,
    };
  }

  if (draft.waitingOutIds.includes(tap.playerId)) {
    if (court.length >= COURT_MAX) return { draft, full: true };
    return {
      draft: {
        ...draft,
        waitingOutIds: draft.waitingOutIds.filter((id) => id !== tap.playerId),
      },
      full: false,
    };
  }

  if (draft.waitingOutIds.length > 0 && court.length < COURT_MAX) {
    const [outId, ...rest] = draft.waitingOutIds;
    return {
      draft: {
        swaps: [...draft.swaps, { outId, inId: tap.playerId }],
        entries: draft.entries,
        waitingOutIds: rest,
        pendingInId: null,
      },
      full: false,
    };
  }

  if (fillVacancies && court.length < COURT_MAX) {
    return {
      draft: {
        ...draft,
        entries: [...draft.entries, tap.playerId],
        pendingInId: null,
      },
      full: false,
    };
  }

  if (draft.pendingInId === tap.playerId) {
    return { draft: { ...draft, pendingInId: null }, full: false };
  }

  return { draft: { ...draft, pendingInId: tap.playerId }, full: false };
}
