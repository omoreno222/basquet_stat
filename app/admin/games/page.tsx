import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/live-access';
import GamesList, { type GameWithTeam } from './games-list';

const GAME_COLUMNS = '*, teams(name, seasons(name), clubs(id, name, short_name, logo_url, primary_color, secondary_color))';

export default async function GamesPage() {
  const token = (await cookies()).get('sb-access-token')?.value;
  if (!token) redirect('/login');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) redirect('/login');

  const { data: roleRows, error: rolesError } = await supabase
    .from('profile_roles')
    .select('role, club_id')
    .eq('profile_id', user.id);

  const roles = roleRows ?? [];
  let games: GameWithTeam[] = [];
  let error = rolesError?.message ?? '';

  if (!rolesError) {
    const platformAdmin = isPlatformAdmin(roles);
    const clubAdmin = roles.find((role) => (role.role === 'club_admin' || role.role === 'admin') && role.club_id !== null);
    let gamesQuery = supabase
      .from('games')
      .select(GAME_COLUMNS)
      .order('game_date', { ascending: false });

    if (!platformAdmin && clubAdmin?.club_id) {
      const { data: clubTeams } = await supabase.from('teams').select('id').eq('club_id', clubAdmin.club_id);
      const teamIds = clubTeams?.map((team) => team.id) ?? [];
      gamesQuery = gamesQuery.in('team_id', teamIds.length > 0 ? teamIds : ['00000000-0000-0000-0000-000000000000']);
    }

    const { data, error: gamesError } = await gamesQuery;
    games = (data ?? []) as GameWithTeam[];
    error = gamesError?.message ?? '';
  }

  return <GamesList initialGames={games} initialRoles={roles} initialError={error} />;
}
