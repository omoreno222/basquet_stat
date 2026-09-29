export const SQUAD_LIMIT = 12;
export const COURT_LIMIT = 5;
export const FOUL_OUT = 5;

export function minimumToStart(eliminated: number): number {
  if (eliminated <= 0) return 5;
  if (eliminated === 1) return 4;
  return 3;
}

export function canStartPeriod(
  homeOnCourt: number,
  awayOnCourt: number,
  homeEliminated: number,
  awayEliminated: number,
): boolean {
  const homeMinimum = minimumToStart(homeEliminated);
  const awayMinimum = minimumToStart(awayEliminated);
  return homeOnCourt >= homeMinimum
    && homeOnCourt <= COURT_LIMIT
    && awayOnCourt >= awayMinimum
    && awayOnCourt <= COURT_LIMIT;
}

export function isEliminated(personalFouls: number): boolean {
  return personalFouls >= FOUL_OUT;
}
