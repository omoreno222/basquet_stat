/** Platform admin: admin role with no club. */
export function isPlatformAdmin(roles: { role: string; club_id: string | null }[]): boolean {
  return roles.some((role) => role.role === 'admin' && role.club_id === null);
}

/**
 * A platform admin, or a club admin or team manager of this club, can record its games.
 */
export function userManagesClub(
  roles: { role: string; club_id: string | null }[],
  clubId: string | null,
): boolean {
  if (!clubId) return false;
  return roles.some((role) =>
    (role.role === 'admin' && role.club_id === null)
    || ((role.role === 'club_admin' || role.role === 'team_manager') && role.club_id === clubId),
  );
}

/** A live game opens on the court for a platform admin or someone who manages that club. */
export function userCanOpenLiveGame(params: {
  status: string;
  managesClub: boolean;
}): boolean {
  return params.status === 'live' && params.managesClub;
}
