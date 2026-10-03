'use server';

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getServerSupabase } from '@/lib/supabase';
import { assertAdmin, assertClubAdmin, assertPlatformAdmin, getAuthenticatedUser, getUserClubs } from '@/lib/auth-server';
import {
  clubSchema,
  gameSchema,
  playerSchema,
  profileEmailSchema,
  profileFieldsSchema,
  profilePasswordSchema,
  profileThemeSchema,
  schemaError,
  seasonSchema,
  teamSchema,
  userCreateSchema,
  userRolesSchema,
  userUpdateSchema,
} from '@/lib/form-schemas';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function updateUserRoles(userId: string, roles: string[], clubId?: string | null) {
  // SECURITY: Verify caller is admin before proceeding
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const parsedRoles = userRolesSchema.safeParse({ roles, clubId: clubId ?? null });
  if (!parsedRoles.success) {
    return { error: schemaError(parsedRoles.error) };
  }

  const access = await getUserClubs();
  if (access.error) {
    return { error: access.error };
  }

  const resolvedClubId = access.isPlatformAdmin
    ? parsedRoles.data.clubId ?? null
    : access.clubIds?.[0] ?? null;

  roles = parsedRoles.data.roles;
  clubId = resolvedClubId;

  // Get user-scoped client (anon key + user's access token) so auth.uid() works in the RPC
  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;

  if (!token) {
    return { error: 'Unauthorized: Not authenticated' };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  // Call the secure SQL function that handles all the logic
  const { data, error } = await supabase.rpc('update_user_roles_safe', {
    p_user_id: userId,
    p_roles: roles,
    p_club_id: clubId || null,
  });

  if (error) {
    return { error: error.message };
  }

  // Check if the function returned an error in the JSON response
  if (data && typeof data === 'object' && 'error' in data) {
    return { error: data.error };
  }

  return { success: true };
}

export async function linkParentToPlayer(parentId: string, playerId: string) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();
  
  const { error } = await supabase
    .from('parent_player_links')
    .insert({ parent_id: parentId, player_id: playerId });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function unlinkParentFromPlayer(parentId: string, playerId: string) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();
  
  const { error } = await supabase
    .from('parent_player_links')
    .delete()
    .eq('parent_id', parentId)
    .eq('player_id', playerId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function linkPlayerAccount(playerId: string, userId: string) {
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();
  
  const { error } = await supabase
    .from('players')
    .update({ user_id: userId })
    .eq('id', playerId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function unlinkPlayerAccount(playerId: string) {
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();
  
  const { error } = await supabase
    .from('players')
    .update({ user_id: null })
    .eq('id', playerId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function uploadClubLogo(clubId: string, file: File) {
  const authCheck = await assertClubAdmin(clubId);
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Only JPEG, PNG, WebP, and SVG are allowed.' };
  }

  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { error: 'File size exceeds 5MB limit.' };
  }

  // Get file extension
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `clubs/${clubId}/logo.${ext}`;

  // Delete old logo if exists
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(`clubs/${clubId}`);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `clubs/${clubId}/${f.name}`);
    await supabase.storage.from('avatars').remove(filesToDelete);
  }

  // Upload new logo
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Update club with logo URL
  const { error: updateError } = await supabase
    .from('clubs')
    .update({ logo_url: publicUrl })
    .eq('id', clubId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true, url: publicUrl };
}

export async function removeClubLogo(clubId: string) {
  const authCheck = await assertClubAdmin(clubId);
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();

  // Get current logo URL
  const { data: club } = await supabase
    .from('clubs')
    .select('logo_url')
    .eq('id', clubId)
    .single();

  if (club?.logo_url) {
    // Delete from storage
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(`clubs/${clubId}`);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `clubs/${clubId}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }
  }

  // Update club to remove logo URL
  const { error } = await supabase
    .from('clubs')
    .update({ logo_url: null })
    .eq('id', clubId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function uploadProfileAvatar(profileId: string, file: File) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
  }

  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { error: 'File size exceeds 5MB limit.' };
  }

  // Get file extension
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `profiles/${profileId}/avatar.${ext}`;

  // Delete old avatar if exists
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(`profiles/${profileId}`);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `profiles/${profileId}/${f.name}`);
    await supabase.storage.from('avatars').remove(filesToDelete);
  }

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Update profile with avatar URL
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', profileId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true, url: publicUrl };
}

export async function removeProfileAvatar(profileId: string) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();

  // Get current avatar URL
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', profileId)
    .single();

  if (profile?.avatar_url) {
    // Delete from storage
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(`profiles/${profileId}`);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `profiles/${profileId}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }
  }

  // Update profile to remove avatar URL
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', profileId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function uploadPlayerAvatar(playerId: string, file: File) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' };
  }

  // Validate file size (5MB limit)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { error: 'File size exceeds 5MB limit.' };
  }

  // Get file extension
  const ext = file.name.split('.').pop() || 'jpg';
  const filePath = `players/${playerId}/avatar.${ext}`;

  // Delete old avatar if exists
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(`players/${playerId}`);

  if (existingFiles && existingFiles.length > 0) {
    const filesToDelete = existingFiles.map(f => `players/${playerId}/${f.name}`);
    await supabase.storage.from('avatars').remove(filesToDelete);
  }

  // Upload new avatar
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Update player with avatar URL
  const { error: updateError } = await supabase
    .from('players')
    .update({ avatar_url: publicUrl })
    .eq('id', playerId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true, url: publicUrl };
}

export async function removePlayerAvatar(playerId: string) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();

  // Get current avatar URL
  const { data: player } = await supabase
    .from('players')
    .select('avatar_url')
    .eq('id', playerId)
    .single();

  if (player?.avatar_url) {
    // Delete from storage
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(`players/${playerId}`);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `players/${playerId}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }
  }

  // Update player to remove avatar URL
  const { error } = await supabase
    .from('players')
    .update({ avatar_url: null })
    .eq('id', playerId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Reset user password (wrapper for password-auth function)
 */
export async function resetUserPassword(userId: string) {
  'use server';
  const { resetUserPassword: resetPwd } = await import('@/lib/password-auth');
  return resetPwd(userId);
}

async function userClient() {
  const auth = await getAuthenticatedUser();
  if (auth.error || !auth.user) {
    return { error: auth.error || 'Unauthorized: Not authenticated', supabase: null };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('sb-access-token')?.value;
  if (!token) {
    return { error: 'Unauthorized: Not authenticated', supabase: null };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { error: null, supabase };
}

async function clubAccessError(clubId: string) {
  const access = await getUserClubs();
  if (access.error) return access.error;
  if (access.isPlatformAdmin) return null;
  if (!access.clubIds?.includes(clubId)) return 'Unauthorized: Club admin access required for this club';
  return null;
}

export async function saveClub(input: unknown) {
  const parsed = clubSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const client = await userClient();
  if (client.error || !client.supabase) return { error: client.error || 'Unauthorized' };

  const payload = {
    name: parsed.data.name,
    short_name: parsed.data.short_name || null,
    primary_color: parsed.data.primary_color,
    secondary_color: parsed.data.secondary_color,
  };

  if (parsed.data.id) {
    const denied = await clubAccessError(parsed.data.id);
    const access = await getUserClubs();
    if (!access.isPlatformAdmin && denied) return { error: denied };

    const { error } = await client.supabase.from('clubs').update(payload).eq('id', parsed.data.id);
    if (error) return { error: error.message };
    return { id: parsed.data.id };
  }

  const { data, error } = await client.supabase.from('clubs').insert(payload).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function saveSeason(input: unknown) {
  const parsed = seasonSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const client = await userClient();
  if (client.error || !client.supabase) return { error: client.error || 'Unauthorized' };

  const payload = {
    name: parsed.data.name,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    is_active: parsed.data.is_active,
  };

  if (parsed.data.id) {
    const { error } = await client.supabase.from('seasons').update(payload).eq('id', parsed.data.id);
    if (error) return { error: error.message };
    return { id: parsed.data.id };
  }

  const { data, error } = await client.supabase.from('seasons').insert(payload).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function saveTeam(input: unknown) {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const client = await userClient();
  if (client.error || !client.supabase) return { error: client.error || 'Unauthorized' };

  const access = await getUserClubs();
  if (access.error) return { error: access.error };

  let clubId = parsed.data.club_id || null;
  if (!access.isPlatformAdmin) {
    if (!access.clubIds?.length) return { error: 'Club is required. Please select a club.' };
    if (clubId && !access.clubIds.includes(clubId)) {
      return { error: 'Unauthorized: Club admin access required for this club' };
    }
    clubId = clubId || access.clubIds[0];
  }

  if (!clubId) return { error: 'Club is required. Please select a club.' };

  if (parsed.data.id) {
    const { data: existing, error: existingError } = await client.supabase
      .from('teams')
      .select('club_id')
      .eq('id', parsed.data.id)
      .single();

    if (existingError || !existing) return { error: 'This page does not exist' };
    if (clubId !== existing.club_id) {
      return { error: 'Cannot change team club. Delete and recreate the team if needed.' };
    }
  }

  const coachId = parsed.data.coach_id || null;
  if (coachId) {
    const { data: coachRole, error: coachError } = await client.supabase
      .from('profile_roles')
      .select('profile_id')
      .eq('profile_id', coachId)
      .eq('role', 'coach')
      .eq('club_id', clubId)
      .limit(1);
    if (coachError) return { error: coachError.message };
    if (!coachRole?.length) return { error: 'Team coach must be a user with the coach role in this club' };
  }

  const payload = {
    name: parsed.data.name,
    fiba_short_name: parsed.data.fiba_short_name || null,
    club_id: clubId,
    coach_id: coachId,
    season_id: parsed.data.season_id,
    category: parsed.data.category,
    gender: parsed.data.gender,
  };

  if (parsed.data.id) {
    const { error } = await client.supabase.from('teams').update(payload).eq('id', parsed.data.id);
    if (error) return { error: error.message };
    return { id: parsed.data.id };
  }

  const { data, error } = await client.supabase.from('teams').insert(payload).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function savePlayer(input: unknown) {
  const parsed = playerSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const client = await userClient();
  if (client.error || !client.supabase) return { error: client.error || 'Unauthorized' };

  const { data: team, error: teamError } = await client.supabase
    .from('teams')
    .select('club_id')
    .eq('id', parsed.data.team_id)
    .single();

  if (teamError || !team?.club_id) {
    return { error: 'Selected team has no club. Please select a valid team.' };
  }

  const denied = await clubAccessError(team.club_id);
  if (denied) return { error: denied };

  const payload = {
    full_name: parsed.data.full_name,
    jersey_number: parsed.data.jersey_number,
    team_id: parsed.data.team_id,
    club_id: team.club_id,
    position: parsed.data.position || null,
    date_of_birth: parsed.data.date_of_birth || null,
  };

  if (parsed.data.id) {
    const { error } = await client.supabase.from('players').update(payload).eq('id', parsed.data.id);
    if (error) return { error: error.message };
    return { id: parsed.data.id };
  }

  const { data, error } = await client.supabase.from('players').insert(payload).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function saveGame(input: unknown) {
  const parsed = gameSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const client = await userClient();
  if (client.error || !client.supabase) return { error: client.error || 'Unauthorized' };

  const { data: team, error: teamError } = await client.supabase
    .from('teams')
    .select('club_id')
    .eq('id', parsed.data.team_id)
    .single();

  if (teamError || !team?.club_id) return { error: 'Team not found' };

  const denied = await clubAccessError(team.club_id);
  if (denied) return { error: denied };

  const payload = {
    team_id: parsed.data.team_id,
    opponent_name: parsed.data.opponent_name,
    game_date: new Date(parsed.data.game_date).toISOString(),
    venue: parsed.data.venue || null,
    status: parsed.data.status,
    is_home: parsed.data.is_home,
    official: parsed.data.official,
    kit_color: parsed.data.kit_color,
    opponent_color: parsed.data.opponent_color,
  };

  if (parsed.data.id) {
    const { error } = await client.supabase.from('games').update(payload).eq('id', parsed.data.id);
    if (error) return { error: error.message };
    return { id: parsed.data.id };
  }

  const { data, error } = await client.supabase.from('games').insert(payload).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function createAdminUser(input: unknown) {
  const parsed = userCreateSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const access = await getUserClubs();
  if (access.error) return { error: access.error };

  let clubId = parsed.data.club_id ?? null;
  if (!access.isPlatformAdmin) {
    clubId = access.clubIds?.[0] ?? null;
  }

  const { createUserWithPassword } = await import('@/lib/password-auth');
  return createUserWithPassword({
    email: parsed.data.email,
    full_name: parsed.data.full_name,
    role: parsed.data.roles[0],
    roles: parsed.data.roles,
    club_id: clubId,
  });
}

export async function updateAdminUser(input: unknown) {
  const parsed = userUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const rolesResult = await updateUserRoles(parsed.data.id, parsed.data.roles, parsed.data.club_id ?? null);
  if (rolesResult.error) return { error: rolesResult.error };

  const supabase = getServerSupabase();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', parsed.data.id)
    .single();
  if (profileError || !profile) return { error: profileError?.message || 'User not found' };

  const nextEmail = parsed.data.email.trim();
  if (nextEmail.toLowerCase() !== profile.email.trim().toLowerCase()) {
    const { error: authError } = await supabase.auth.admin.updateUserById(parsed.data.id, {
      email: nextEmail,
      email_confirm: true,
    });
    if (authError) return { error: authError.message };
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name || null,
      email: nextEmail,
    })
    .eq('id', parsed.data.id);

  if (updateError) return { error: updateError.message };
  return { success: true };
}

export async function saveProfileFields(profileId: string, input: unknown) {
  const parsed = profileFieldsSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };
  if (!zUuid(profileId)) return { error: 'This page does not exist' };

  const denied = await profileWriteError(profileId);
  if (denied) return { error: denied };

  const client = await userClient();
  if (client.error || !client.supabase) return { error: client.error || 'Unauthorized' };

  const { error } = await client.supabase
    .from('profiles')
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      locale: parsed.data.locale,
      phone: parsed.data.phone,
    })
    .eq('id', profileId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function saveProfileTheme(profileId: string, input: unknown) {
  const parsed = profileThemeSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };
  if (!zUuid(profileId)) return { error: 'This page does not exist' };

  const denied = await profileWriteError(profileId);
  if (denied) return { error: denied };

  const client = await userClient();
  if (client.error || !client.supabase) return { error: client.error || 'Unauthorized' };

  const { error } = await client.supabase
    .from('profiles')
    .update({ theme: parsed.data.theme })
    .eq('id', profileId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function changeOwnEmail(input: unknown) {
  const parsed = profileEmailSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const { changeEmailWithPassword } = await import('@/lib/password-auth');
  return changeEmailWithPassword(parsed.data.currentPassword, parsed.data.newEmail);
}

export async function changeOwnPassword(input: unknown) {
  const parsed = profilePasswordSchema.safeParse(input);
  if (!parsed.success) return { error: schemaError(parsed.error) };

  const { changePasswordWithCurrent } = await import('@/lib/password-auth');
  return changePasswordWithCurrent(parsed.data.currentPassword, parsed.data.newPassword);
}

function zUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function profileWriteError(profileId: string) {
  const auth = await getAuthenticatedUser();
  if (auth.error || !auth.user) return auth.error || 'Unauthorized: Not authenticated';
  if (auth.user.id === profileId) return null;
  const admin = await assertPlatformAdmin();
  return admin.error;
}
