'use server';

import { getServerSupabase } from '@/lib/supabase';
import { assertAdmin, assertClubAdmin, getAuthenticatedUser } from '@/lib/auth-server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Generate a secure random password
 */
function generatePassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(x => charset[x % charset.length])
    .join('');
}

/**
 * Send welcome email with temporary password
 * Password is never stored/logged/shown except in email
 */
async function sendWelcomeEmail(email: string, fullName: string, tempPassword: string, clubName?: string) {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SeasonMath <onboarding@seasonmath.com>',
    to: email,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: `Welcome to SeasonMath${clubName ? ` - ${clubName}` : ''}`,
    html: `
      <h2>Welcome to SeasonMath</h2>
      <p>Hi ${fullName},</p>
      ${clubName ? `<p>You've been added to <strong>${clubName}</strong>.</p>` : ''}
      <p>Your account has been created. Here are your login credentials:</p>
      <p><strong>Email:</strong> ${email}<br/>
      <strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
      <p><strong>Important:</strong> You will be required to change your password on first login.</p>
      <p>Login at: <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://seasonmath.com'}/login">${process.env.NEXT_PUBLIC_SITE_URL || 'https://seasonmath.com'}/login</a></p>
      <p>If you have any questions, please reply to this email.</p>
    `,
  });

  return { data, error };
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email: string, fullName: string, tempPassword: string) {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SeasonMath <onboarding@seasonmath.com>',
    to: email,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: 'Your Password Has Been Reset - SeasonMath',
    html: `
      <h2>Password Reset</h2>
      <p>Hi ${fullName},</p>
      <p>Your password has been reset by an administrator. Here is your new temporary password:</p>
      <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
      <p><strong>Important:</strong> You will be required to change your password on next login.</p>
      <p>Login at: <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://seasonmath.com'}/login">${process.env.NEXT_PUBLIC_SITE_URL || 'https://seasonmath.com'}/login</a></p>
      <p>If you did not request this reset, please contact support immediately.</p>
    `,
  });

  return { data, error };
}

/**
 * Create user with password (admin/club_admin only)
 * Generates temporary password, sends welcome email, sets must_change_password
 */
export async function createUserWithPassword(formData: {
  email: string;
  full_name: string;
  role: string;
  roles?: string[];
  club_id?: string | null;
}) {
  // Verify caller is admin
  const authCheck = await assertAdmin();
  if (authCheck.error) {
    return { error: authCheck.error };
  }

  const supabase = getServerSupabase();

  // Generate temporary password (never logged/shown except in email)
  const tempPassword = generatePassword(12);

  // Create user with password
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: formData.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError) {
    return { error: authError.message };
  }

  if (authData.user) {
    const rolesToAssign = formData.roles && formData.roles.length > 0 
      ? formData.roles 
      : [formData.role];
    
    const primaryRole = rolesToAssign[0];

    // Create profile with must_change_password flag
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: formData.email,
        full_name: formData.full_name,
        role: primaryRole,
        language: 'en',
        must_change_password: true,
      });

    if (profileError) {
      return { error: profileError.message };
    }

    // Insert roles
    const roleInserts = rolesToAssign.map(role => ({
      user_id: authData.user.id,
      role: role,
      club_id: formData.club_id || null,
    }));

    const { error: rolesError } = await supabase
      .from('profile_roles')
      .insert(roleInserts);

    if (rolesError) {
      return { error: rolesError.message };
    }

    // Get club name if provided
    let clubName: string | undefined;
    if (formData.club_id) {
      const { data: club } = await supabase
        .from('clubs')
        .select('name')
        .eq('id', formData.club_id)
        .single();
      clubName = club?.name;
    }

    // Send welcome email with temporary password
    const emailResult = await sendWelcomeEmail(
      formData.email,
      formData.full_name,
      tempPassword,
      clubName
    );

    if (emailResult.error) {
      return { 
        error: `User created but email failed: ${emailResult.error.message}. Use 'Reset Password' to send a new password.`,
        userId: authData.user.id,
        emailFailed: true,
      };
    }

    return { success: true, userId: authData.user.id };
  }

  return { error: 'Failed to create user' };
}

/**
 * Reset user password (admin only)
 * Generates new password, sends email, sets must_change_password
 */
export async function resetUserPassword(userId: string, clubId?: string | null) {
  // Verify authorization (platform admin or club admin for that club)
  if (clubId) {
    const authCheck = await assertClubAdmin(clubId);
    if (authCheck.error) {
      return { error: authCheck.error };
    }
  } else {
    const authCheck = await assertAdmin();
    if (authCheck.error) {
      return { error: authCheck.error };
    }
  }

  const supabase = getServerSupabase();

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { error: 'User not found' };
  }

  // Generate new temporary password
  const tempPassword = generatePassword(12);

  // Update user password
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    userId,
    { password: tempPassword }
  );

  if (updateError) {
    return { error: updateError.message };
  }

  // Set must_change_password flag
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', userId);

  if (profileError) {
    return { error: profileError.message };
  }

  // Send password reset email
  const emailResult = await sendPasswordResetEmail(
    profile.email,
    profile.full_name || profile.email,
    tempPassword
  );

  if (emailResult.error) {
    return { 
      error: `Password reset but email failed: ${emailResult.error.message}. Try resetting again.`,
      emailFailed: true,
    };
  }

  return { success: true };
}

/**
 * Forgot password (public, rate-limited)
 * Generic response to prevent user enumeration
 */
export async function forgotPassword(email: string) {
  const supabase = getServerSupabase();

  // Generic response regardless of whether user exists
  const genericResponse = { 
    success: true, 
    message: 'If an account with that email exists, a password reset link has been sent.' 
  };

  // Check if user exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, password_reset_requested_at')
    .eq('email', email)
    .single();

  if (!profile) {
    // User doesn't exist - return generic response (no enumeration)
    return genericResponse;
  }

  // Rate limiting: 15 minutes between requests
  if (profile.password_reset_requested_at) {
    const lastRequest = new Date(profile.password_reset_requested_at);
    const now = new Date();
    const minutesSinceLastRequest = (now.getTime() - lastRequest.getTime()) / 1000 / 60;

    if (minutesSinceLastRequest < 15) {
      // Rate limited - but still return generic response (no enumeration)
      return genericResponse;
    }
  }

  // Generate new temporary password
  const tempPassword = generatePassword(12);

  // Update user password
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    profile.id,
    { password: tempPassword }
  );

  if (updateError) {
    // Return generic response even on error
    return genericResponse;
  }

  // Update password_reset_requested_at and set must_change_password
  await supabase
    .from('profiles')
    .update({ 
      must_change_password: true,
      password_reset_requested_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  // Send password reset email
  await sendPasswordResetEmail(
    profile.email,
    profile.full_name || profile.email,
    tempPassword
  );

  // Always return generic response
  return genericResponse;
}

/**
 * Change email with password verification
 * Requires current password, updates email, sends notices to both addresses
 */
export async function changeEmailWithPassword(
  currentPassword: string,
  newEmail: string
) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const supabase = getServerSupabase();

  // Get current email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'Profile not found' };
  }

  const oldEmail = profile.email;

  // Verify current password by attempting sign-in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: oldEmail,
    password: currentPassword,
  });

  if (signInError || !signInData.user) {
    return { error: 'Incorrect password' };
  }

  // Update email
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { 
      email: newEmail,
      email_confirm: true,
    }
  );

  if (updateError) {
    return { error: updateError.message };
  }

  // Update email in profiles table if it exists
  await supabase
    .from('profiles')
    .update({ email: newEmail })
    .eq('id', user.id);

  // Send notice to old email
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SeasonMath <onboarding@seasonmath.com>',
    to: oldEmail,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: 'Email Address Changed - SeasonMath',
    html: `
      <h2>Email Address Changed</h2>
      <p>Hi ${profile.full_name || 'there'},</p>
      <p>Your email address has been changed from <strong>${oldEmail}</strong> to <strong>${newEmail}</strong>.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    `,
  });

  // Send notice to new email
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SeasonMath <onboarding@seasonmath.com>',
    to: newEmail,
    replyTo: process.env.EMAIL_REPLY_TO,
    subject: 'Email Address Changed - SeasonMath',
    html: `
      <h2>Email Address Changed</h2>
      <p>Hi ${profile.full_name || 'there'},</p>
      <p>Your email address has been successfully changed to <strong>${newEmail}</strong>.</p>
      <p>You can now use this email address to log in.</p>
    `,
  });

  return { success: true };
}

/**
 * Change password with current password verification
 */
export async function changePasswordWithCurrent(
  currentPassword: string,
  newPassword: string
) {
  const { user, error: authError } = await getAuthenticatedUser();
  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  if (newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  const supabase = getServerSupabase();

  // Get current email
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: 'Profile not found' };
  }

  // Verify current password
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });

  if (signInError || !signInData.user) {
    return { error: 'Incorrect current password' };
  }

  // Update password
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    return { error: updateError.message };
  }

  // Clear must_change_password flag if set
  await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id);

  return { success: true };
}
