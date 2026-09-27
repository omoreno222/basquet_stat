-- Migration 018: Password auth flows and must_change_password
-- This migration adds password management support and removes magic link dependencies

-- Add must_change_password flag to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ;

-- Add index for password reset rate limiting
CREATE INDEX IF NOT EXISTS idx_profiles_password_reset_requested 
  ON profiles(password_reset_requested_at) 
  WHERE password_reset_requested_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN profiles.must_change_password IS 'User must change password on next login (set on create/reset)';
COMMENT ON COLUMN profiles.password_reset_requested_at IS 'Timestamp of last password reset request (for rate limiting)';

-- Add i18n keys for password flows
INSERT INTO translations (locale, key, value) VALUES
  -- English
  ('en', 'trke_password_auth_title', 'Password Required'),
  ('en', 'trke_password_auth_description', 'Enter your password to continue'),
  ('en', 'trke_current_password', 'Current Password'),
  ('en', 'trke_new_password', 'New Password'),
  ('en', 'trke_confirm_new_password', 'Confirm New Password'),
  ('en', 'trke_must_change_password', 'You must change your password'),
  ('en', 'trke_must_change_password_desc', 'For security, please set a new password before continuing'),
  ('en', 'trke_forgot_password', 'Forgot Password?'),
  ('en', 'trke_forgot_password_title', 'Reset Password'),
  ('en', 'trke_forgot_password_desc', 'Enter your email address and we''ll send you a password reset link'),
  ('en', 'trke_send_reset_link', 'Send Reset Link'),
  ('en', 'trke_reset_link_sent', 'If an account exists, a reset link has been sent'),
  ('en', 'trke_password_reset_success', 'Password reset successfully'),
  ('en', 'trke_password_changed_success', 'Password changed successfully'),
  ('en', 'trke_email_changed_success', 'Email changed successfully'),
  ('en', 'trke_reset_password', 'Reset Password'),
  ('en', 'trke_reset_user_password', 'Reset User Password'),
  ('en', 'trke_password_reset_sent', 'Password reset email sent'),
  ('en', 'trke_verify_password', 'Verify Current Password'),
  ('en', 'trke_password_incorrect', 'Incorrect password'),
  ('en', 'trke_password_requirements', 'Password must be at least 6 characters'),
  ('en', 'trke_passwords_must_match', 'Passwords must match'),
  ('en', 'trke_rate_limit_password_reset', 'Please wait 15 minutes between password reset requests'),
  
  -- Spanish
  ('es', 'trke_password_auth_title', 'Contraseña Requerida'),
  ('es', 'trke_password_auth_description', 'Ingresa tu contraseña para continuar'),
  ('es', 'trke_current_password', 'Contraseña Actual'),
  ('es', 'trke_new_password', 'Nueva Contraseña'),
  ('es', 'trke_confirm_new_password', 'Confirmar Nueva Contraseña'),
  ('es', 'trke_must_change_password', 'Debes cambiar tu contraseña'),
  ('es', 'trke_must_change_password_desc', 'Por seguridad, establece una nueva contraseña antes de continuar'),
  ('es', 'trke_forgot_password', '¿Olvidaste tu Contraseña?'),
  ('es', 'trke_forgot_password_title', 'Restablecer Contraseña'),
  ('es', 'trke_forgot_password_desc', 'Ingresa tu correo electrónico y te enviaremos un enlace de restablecimiento'),
  ('es', 'trke_send_reset_link', 'Enviar Enlace'),
  ('es', 'trke_reset_link_sent', 'Si existe una cuenta, se ha enviado un enlace de restablecimiento'),
  ('es', 'trke_password_reset_success', 'Contraseña restablecida exitosamente'),
  ('es', 'trke_password_changed_success', 'Contraseña cambiada exitosamente'),
  ('es', 'trke_email_changed_success', 'Correo electrónico cambiado exitosamente'),
  ('es', 'trke_reset_password', 'Restablecer Contraseña'),
  ('es', 'trke_reset_user_password', 'Restablecer Contraseña del Usuario'),
  ('es', 'trke_password_reset_sent', 'Correo de restablecimiento enviado'),
  ('es', 'trke_verify_password', 'Verificar Contraseña Actual'),
  ('es', 'trke_password_incorrect', 'Contraseña incorrecta'),
  ('es', 'trke_password_requirements', 'La contraseña debe tener al menos 6 caracteres'),
  ('es', 'trke_passwords_must_match', 'Las contraseñas deben coincidir'),
  ('es', 'trke_rate_limit_password_reset', 'Espera 15 minutos entre solicitudes de restablecimiento'),
  
  -- Catalan
  ('ca', 'trke_password_auth_title', 'Contrasenya Requerida'),
  ('ca', 'trke_password_auth_description', 'Introdueix la teva contrasenya per continuar'),
  ('ca', 'trke_current_password', 'Contrasenya Actual'),
  ('ca', 'trke_new_password', 'Nova Contrasenya'),
  ('ca', 'trke_confirm_new_password', 'Confirmar Nova Contrasenya'),
  ('ca', 'trke_must_change_password', 'Has de canviar la teva contrasenya'),
  ('ca', 'trke_must_change_password_desc', 'Per seguretat, estableix una nova contrasenya abans de continuar'),
  ('ca', 'trke_forgot_password', 'Has Oblidat la Contrasenya?'),
  ('ca', 'trke_forgot_password_title', 'Restablir Contrasenya'),
  ('ca', 'trke_forgot_password_desc', 'Introdueix el teu correu electrònic i t''enviarem un enllaç de restabliment'),
  ('ca', 'trke_send_reset_link', 'Enviar Enllaç'),
  ('ca', 'trke_reset_link_sent', 'Si existeix un compte, s''ha enviat un enllaç de restabliment'),
  ('ca', 'trke_password_reset_success', 'Contrasenya restablerta exitosament'),
  ('ca', 'trke_password_changed_success', 'Contrasenya canviada exitosament'),
  ('ca', 'trke_email_changed_success', 'Correu electrònic canviat exitosament'),
  ('ca', 'trke_reset_password', 'Restablir Contrasenya'),
  ('ca', 'trke_reset_user_password', 'Restablir Contrasenya de l''Usuari'),
  ('ca', 'trke_password_reset_sent', 'Correu de restabliment enviat'),
  ('ca', 'trke_verify_password', 'Verificar Contrasenya Actual'),
  ('ca', 'trke_password_incorrect', 'Contrasenya incorrecta'),
  ('ca', 'trke_password_requirements', 'La contrasenya ha de tenir almenys 6 caràcters'),
  ('ca', 'trke_passwords_must_match', 'Les contrasenyes han de coincidir'),
  ('ca', 'trke_rate_limit_password_reset', 'Espera 15 minuts entre sol·licituds de restabliment')
ON CONFLICT (locale, key) DO UPDATE
  SET value = EXCLUDED.value;
