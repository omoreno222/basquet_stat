export const SQUAD_LIMIT = 12;
export const COURT_LIMIT = 5;
export const FOUL_OUT = 5;

/** Players who must be on the court. Five whenever five or more can still play. */
export function requiredOnCourt(available: number): number {
  if (available >= COURT_LIMIT) return COURT_LIMIT;
  if (available >= 4) return 4;
  return 3;
}

export function canStartPeriod(
  homeOnCourt: number,
  awayOnCourt: number,
  homeAvailable: number,
  awayAvailable: number,
): boolean {
  const homeMinimum = requiredOnCourt(homeAvailable);
  const awayMinimum = requiredOnCourt(awayAvailable);
  return homeOnCourt >= homeMinimum
    && homeOnCourt <= COURT_LIMIT
    && awayOnCourt >= awayMinimum
    && awayOnCourt <= COURT_LIMIT;
}

export function isEliminated(personalFouls: number): boolean {
  return personalFouls >= FOUL_OUT;
}
