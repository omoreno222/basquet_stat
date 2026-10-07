import { describe, expect, it } from 'vitest';
import {
  applySubstitutionTap,
  createSubstitutionDraft,
  draftCourtIds,
  substitutionReady,
} from './substitution-draft';

const court = ['a', 'b', 'c', 'd', 'e'];

describe('substitution draft', () => {
  it('does not put a bench player on a full court or require a second removal', () => {
    const start = createSubstitutionDraft(court, null);
    const selected = applySubstitutionTap(court, start, {
      kind: 'bench', playerId: 'f', eliminated: false, forcedOut: false,
    });

    expect(draftCourtIds(court, selected.draft)).toEqual(court);
    expect(selected.draft.pendingInId).toBe('f');
    expect(substitutionReady(selected.draft, false)).toBe(false);

    const swapped = applySubstitutionTap(court, selected.draft, { kind: 'court', playerId: 'b' });
    expect(draftCourtIds(court, swapped.draft)).toEqual(['a', 'c', 'd', 'e', 'f']);
    expect(swapped.draft.swaps).toEqual([{ outId: 'b', inId: 'f' }]);
    expect(substitutionReady(swapped.draft, false)).toBe(true);
  });

  it('pairs each chosen bench player with the court player who was tapped', () => {
    let draft = createSubstitutionDraft(court, null);
    draft = applySubstitutionTap(court, draft, {
      kind: 'bench', playerId: 'x', eliminated: false, forcedOut: false,
    }).draft;
    draft = applySubstitutionTap(court, draft, { kind: 'court', playerId: 'b' }).draft;
    draft = applySubstitutionTap(court, draft, {
      kind: 'bench', playerId: 'y', eliminated: false, forcedOut: false,
    }).draft;
    draft = applySubstitutionTap(court, draft, { kind: 'court', playerId: 'a' }).draft;

    expect(draft.swaps).toEqual([
      { outId: 'b', inId: 'x' },
      { outId: 'a', inId: 'y' },
    ]);
    expect(substitutionReady(draft, false)).toBe(true);
  });

  it('fills a foul-out with one bench tap and does not ask for another player to leave', () => {
    const start = createSubstitutionDraft(court, 'e');
    expect(draftCourtIds(court, start)).toEqual(['a', 'b', 'c', 'd']);
    expect(substitutionReady(start, false)).toBe(false);

    const filled = applySubstitutionTap(court, start, {
      kind: 'bench', playerId: 'f', eliminated: false, forcedOut: false,
    });
    expect(filled.draft.swaps).toEqual([{ outId: 'e', inId: 'f' }]);
    expect(draftCourtIds(court, filled.draft)).toEqual(['a', 'b', 'c', 'd', 'f']);
    expect(substitutionReady(filled.draft, false)).toBe(true);

    const blocked = applySubstitutionTap(court, filled.draft, {
      kind: 'bench', playerId: 'e', eliminated: false, forcedOut: true,
    });
    expect(blocked.draft).toEqual(filled.draft);
  });

  it('lets a short lineup bring someone in only by replacing a player, not by adding an extra', () => {
    const four = ['a', 'b', 'c', 'd'];
    const start = createSubstitutionDraft(four, null);
    const selected = applySubstitutionTap(four, start, {
      kind: 'bench', playerId: 'f', eliminated: false, forcedOut: false,
    });
    expect(draftCourtIds(four, selected.draft)).toEqual(four);
    expect(substitutionReady(selected.draft, false)).toBe(false);

    const swapped = applySubstitutionTap(four, selected.draft, { kind: 'court', playerId: 'a' });
    expect(draftCourtIds(four, swapped.draft)).toEqual(['b', 'c', 'd', 'f']);
    expect(swapped.draft.swaps).toEqual([{ outId: 'a', inId: 'f' }]);
    expect(substitutionReady(swapped.draft, false)).toBe(true);
  });

  it('undoes a player who just left and a player who just entered', () => {
    let draft = createSubstitutionDraft(court, null);
    draft = applySubstitutionTap(court, draft, { kind: 'court', playerId: 'b' }).draft;
    expect(substitutionReady(draft, false)).toBe(false);

    draft = applySubstitutionTap(court, draft, {
      kind: 'bench', playerId: 'b', eliminated: false, forcedOut: false,
    }).draft;
    expect(draftCourtIds(court, draft)).toEqual(court);
    expect(substitutionReady(draft, false)).toBe(false);

    draft = applySubstitutionTap(court, draft, {
      kind: 'bench', playerId: 'f', eliminated: false, forcedOut: false,
    }).draft;
    draft = applySubstitutionTap(court, draft, { kind: 'court', playerId: 'c' }).draft;
    draft = applySubstitutionTap(court, draft, { kind: 'court', playerId: 'f' }).draft;
    expect(draft.swaps).toEqual([]);
    expect(draft.waitingOutIds).toEqual(['c']);
    expect(draftCourtIds(court, draft)).toEqual(['a', 'b', 'd', 'e']);

    draft = applySubstitutionTap(court, draft, {
      kind: 'bench', playerId: 'g', eliminated: false, forcedOut: false,
    }).draft;
    draft = applySubstitutionTap(court, draft, {
      kind: 'bench', playerId: 'c', eliminated: false, forcedOut: false,
    }).draft;
    expect(draftCourtIds(court, draft)).toEqual(court);
    expect(substitutionReady(draft, false)).toBe(false);
  });

  it('ignores an eliminated bench player and a second tap clears the selection', () => {
    const start = createSubstitutionDraft(court, null);
    const eliminated = applySubstitutionTap(court, start, {
      kind: 'bench', playerId: 'f', eliminated: true, forcedOut: false,
    });
    expect(eliminated.draft).toEqual(start);

    const selected = applySubstitutionTap(court, start, {
      kind: 'bench', playerId: 'f', eliminated: false, forcedOut: false,
    }).draft;
    const cleared = applySubstitutionTap(court, selected, {
      kind: 'bench', playerId: 'f', eliminated: false, forcedOut: false,
    });
    expect(cleared.draft.pendingInId).toBeNull();
    expect(draftCourtIds(court, cleared.draft)).toEqual(court);
  });
});
