'use server';

import { getServerSupabase } from '@/lib/supabase';

export async function createUser(formData: {
  email: string;
  password: string;
  full_name: string;
  role: string;
}) {
  const supabase = getServerSupabase();
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: formData.email,
    password: formData.password,
    email_confirm: true,
  });

  if (authError) {
    return { error: authError.message };
  }

  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
        language: 'en',
      });

    if (profileError) {
      return { error: profileError.message };
    }

    return { success: true, userId: authData.user.id };
  }

  return { error: 'Failed to create user' };
}

export async function updateUserRole(userId: string, role: string) {
  const supabase = getServerSupabase();
  
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function linkParentToPlayer(parentId: string, playerId: string) {
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
