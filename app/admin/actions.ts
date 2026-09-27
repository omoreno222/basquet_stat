'use server';

import { getServerSupabase } from '@/lib/supabase';
import { assertAdmin, assertClubAdmin } from '@/lib/auth-server';

export async function updateUserRoles(userId: string, roles: string[], clubId?: string | null) {
  const supabase = getServerSupabase();
  
  if (!roles || roles.length === 0) {
    return { error: 'At least one role must be selected' };
  }

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
