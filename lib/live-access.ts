/**
 * Recorders are complete when tablet A is set and, unless the game has a
 * single recorder, tablet B is set too.
 */
export function assignmentComplete(params: {
  singleRecorder: boolean;
  slotAUserId: string | null;
  slotBUserId: string | null;
}): boolean {
  if (!params.slotAUserId) return false;
  if (params.singleRecorder) return !params.slotBUserId;
  return Boolean(params.slotBUserId);
}

/**
 * A live game opens on the court only for the team manager stored on tablet A or B.
 */
export function userCanOpenLiveGame(params: {
  status: string;
  userId: string | null;
  singleRecorder: boolean;
  slotAUserId: string | null;
  slotBUserId: string | null;
}): boolean {
  if (params.status !== 'live' || !params.userId) return false;
  if (!assignmentComplete(params)) return false;
  return params.userId === params.slotAUserId || params.userId === params.slotBUserId;
}
