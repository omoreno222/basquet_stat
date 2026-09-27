'use server';

import { getServerSupabase } from '@/lib/supabase';
import { assertAdmin, assertClubAdmin } from '@/lib/auth-server';

export async function updateUserRoles(userId: string, roles: string[], clubId?: string | null) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();
  
  if (!roles || roles.length === 0) {
    return { error: 'At least one role must be selected' };
  }

  // Use first role as primary role for profiles.role (backward compatibility)
  const primaryRole = roles[0];

  // Update primary role in profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: primaryRole })
    .eq('id', userId);

  if (profileError) {
    return { error: profileError.message };
  }

  // Delete existing roles for this club only (or all if clubId is null and we're managing platform roles)
  let deleteQuery = supabase
    .from('profile_roles')
    .delete()
    .eq('profile_id', userId);

  // If clubId is specified, only delete roles for that club
  if (clubId !== undefined) {
    if (clubId === null) {
      // Managing platform roles - delete only platform admin roles (club_id IS NULL)
      deleteQuery = deleteQuery.is('club_id', null);
    } else {
      // Managing club roles - delete only roles for this specific club
      deleteQuery = deleteQuery.eq('club_id', clubId);
    }
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    return { error: deleteError.message };
  }

  // Insert new roles with appropriate club_id
  // 'admin' role always gets club_id = null (platform admin)
  // Other roles get the specified clubId
  const roleInserts = roles.map(role => ({
    profile_id: userId,
    role: role,
    club_id: role === 'admin' ? null : (clubId || null),
  }));

  const { error: insertError } = await supabase
    .from('profile_roles')
    .insert(roleInserts);

  if (insertError) {
    return { error: insertError.message };
  }

  return { success: true };
}

// Keep old function for backward compatibility, but delegate to updateUserRoles
export async function updateUserRole(userId: string, role: string) {
  return updateUserRoles(userId, [role]);
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
