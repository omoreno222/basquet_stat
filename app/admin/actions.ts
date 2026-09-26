'use server';

import { getServerSupabase } from '@/lib/supabase';
import { assertAdmin } from '@/lib/auth-server';

export async function createUser(formData: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  roles?: string[];
}) {
  // SECURITY: Verify caller is admin before using service role
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

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
    // Determine roles: use roles array if provided, otherwise fall back to single role
    const rolesToAssign = formData.roles && formData.roles.length > 0 
      ? formData.roles 
      : [formData.role];
    
    // Use first role as primary role for profiles.role (backward compatibility)
    const primaryRole = rolesToAssign[0];

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: formData.email,
        full_name: formData.full_name,
        role: primaryRole,
        language: 'en',
      });

    if (profileError) {
      return { error: profileError.message };
    }

    // Insert all roles into profile_roles table
    const roleInserts = rolesToAssign.map(role => ({
      profile_id: authData.user.id,
      role: role,
    }));

    const { error: rolesError } = await supabase
      .from('profile_roles')
      .insert(roleInserts);

    if (rolesError) {
      return { error: rolesError.message };
    }

    return { success: true, userId: authData.user.id };
  }

  return { error: 'Failed to create user' };
}

export async function updateUserRoles(userId: string, roles: string[]) {
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

  // Delete existing roles
  const { error: deleteError } = await supabase
    .from('profile_roles')
    .delete()
    .eq('profile_id', userId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  // Insert new roles
  const roleInserts = roles.map(role => ({
    profile_id: userId,
    role: role,
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
