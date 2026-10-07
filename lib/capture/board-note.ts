/** Which multi-step capture button the message line is explaining. */
export type BoardFlow =
  | 'made'
  | 'made_personal'
  | 'miss'
  | 'miss_personal'
  | 'foul'
  | 'turnover'
  | 'sub';

export const boardFlowKey: Record<BoardFlow, string> = {
  made: 'trke_flow_made',
  made_personal: 'trke_flow_made_personal',
  miss: 'trke_flow_miss',
  miss_personal: 'trke_flow_miss_personal',
  foul: 'trke_flow_foul',
  turnover: 'trke_flow_turnover',
  sub: 'trke_flow_sub',
};

export const boardFlowFallback: Record<BoardFlow, string> = {
  made: 'Made',
  made_personal: 'Made and a personal foul',
  miss: 'Miss',
  miss_personal: 'Miss and a personal foul',
  foul: 'Foul',
  turnover: 'Turnover',
  sub: 'Change',
};

/**
 * A null message clears the label. Omitting the flow keeps the current one,
 * so later steps and the confirmation stay tagged. An explicit null flow
 * is a one-tap result (24s, 8s, team 5s, timeout) and drops the label.
 */
export function nextBoardFlow(
  current: BoardFlow | null,
  message: string | null,
  flow?: BoardFlow | null,
): BoardFlow | null {
  if (message == null) return null;
  if (flow === undefined) return current;
  return flow;
}

export function formatBoardNote(message: string, label: string | null): string {
  if (!label) return message;
  return `${label}: ${message}`;
}
