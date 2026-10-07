export const PUBLIC_ROUTES = ['/login', '/change-password'];

/** Routes any authenticated user may open, regardless of role. */
export const AUTHENTICATED_ROUTES = ['/profile', '/games'];

export const ROLE_ROUTES: Record<string, string[]> = {
  admin: ['/admin', '/team-manager', '/coach', '/parent', '/player'],
  club_admin: ['/admin', '/team-manager', '/coach', '/parent', '/player'],
  team_manager: ['/team-manager'],
  coach: ['/coach'],
  parent: ['/parent'],
  player: ['/player'],
};

export type RouteDecision =
  | { action: 'next' }
  | { action: 'redirect'; to: string };

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function defaultRouteForRole(primaryRole: string) {
  return ROLE_ROUTES[primaryRole]?.[0] || '/login';
}

/**
 * Decide where an already-authenticated user may go.
 * Order: password change, then routes open to every signed-in user, then role routes.
 */
export function decideAuthenticatedRoute(input: {
  pathname: string;
  roles: string[];
  primaryRole: string;
  mustChangePassword: boolean;
}): RouteDecision {
  const { pathname, roles, primaryRole, mustChangePassword } = input;

  if (mustChangePassword && pathname !== '/change-password') {
    return { action: 'redirect', to: '/change-password' };
  }

  if (AUTHENTICATED_ROUTES.some((route) => matchesRoute(pathname, route))) {
    return { action: 'next' };
  }

  if (pathname === '/') {
    return { action: 'redirect', to: defaultRouteForRole(primaryRole) };
  }

  const allowedRoutes = roles.flatMap((role) => ROLE_ROUTES[role] || []);
  const isAccessingAllowedRoute = allowedRoutes.some((route) => pathname.startsWith(route));

  if (!isAccessingAllowedRoute && !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return { action: 'redirect', to: defaultRouteForRole(primaryRole) };
  }

  return { action: 'next' };
}
