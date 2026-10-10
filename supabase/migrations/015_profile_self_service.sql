-- Migration 015: Profile Self-Service
-- Enables users to manage their own profile: name, avatar, language, phone, password

-- Add first_name and last_name columns (keeping full_name for backward compatibility)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Add phone column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add locale column (separate from language for explicit i18n preference)
-- Reuse existing language column as locale if we want to consolidate
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale TEXT 
  CHECK (locale IN ('en', 'es', 'ca')) 
  DEFAULT 'en';

-- Add must_change_password flag for forced password changes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;

-- Add password_reset_requested_at for rate limiting
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ;

-- Add theme preference (light/dark only, no system option)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light'
  CHECK (theme IN ('light', 'dark'));

-- Backfill locale from language where locale is null
UPDATE profiles SET locale = language WHERE locale IS NULL AND language IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.phone IS 'User phone number (optional)';
COMMENT ON COLUMN profiles.locale IS 'User preferred language for UI (en/es/ca)';
COMMENT ON COLUMN profiles.must_change_password IS 'Flag to force password change on next login (set after password reset or initial creation)';
COMMENT ON COLUMN profiles.password_reset_requested_at IS 'Timestamp of last password reset request (for rate limiting)';
COMMENT ON COLUMN profiles.theme IS 'User theme preference (light/dark)';

-- RLS Policy: Allow users to update their own profile (safe columns only)
-- This policy allows users to update first_name, last_name, avatar_url, locale, phone
-- It does NOT allow changing roles, email, or id
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
  ON profiles 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to prevent users from escalating their own roles or changing protected fields
-- This ensures that even with UPDATE policy, users cannot modify role-related data
CREATE OR REPLACE FUNCTION prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If the user is updating their own profile
  IF OLD.id = auth.uid() THEN
    -- Check if user is an admin
    IF NOT EXISTS (SELECT 1 FROM profile_roles WHERE profile_id = auth.uid() AND role = 'admin') THEN
      -- Non-admins cannot change their role via profiles.role (legacy column)
      IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Users cannot change their own role';
      END IF;
      
      -- Non-admins cannot change their id
      IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Users cannot change their own id';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_self_profile_limits ON profiles;
CREATE TRIGGER enforce_self_profile_limits
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_role_escalation();

-- Translation keys for profile page
INSERT INTO translations (key, locale, value)
VALUES
  -- Profile page title and navigation
  ('trke_profile', 'en', 'Profile'),
  ('trke_profile', 'es', 'Perfil'),
  ('trke_profile', 'ca', 'Perfil'),
  
  ('trke_my_profile', 'en', 'My Profile'),
  ('trke_my_profile', 'es', 'Mi Perfil'),
  ('trke_my_profile', 'ca', 'El Meu Perfil'),
  
  ('trke_sign_out', 'en', 'Sign Out'),
  ('trke_sign_out', 'es', 'Cerrar Sesión'),
  ('trke_sign_out', 'ca', 'Tancar Sessió'),
  
  -- Photo section
  ('trke_profile_photo', 'en', 'Profile Photo'),
  ('trke_profile_photo', 'es', 'Foto de Perfil'),
  ('trke_profile_photo', 'ca', 'Foto de Perfil'),
  
  ('trke_upload_photo', 'en', 'Upload Photo'),
  ('trke_upload_photo', 'es', 'Subir Foto'),
  ('trke_upload_photo', 'ca', 'Pujar Foto'),
  
  ('trke_replace_photo', 'en', 'Replace Photo'),
  ('trke_replace_photo', 'es', 'Reemplazar Foto'),
  ('trke_replace_photo', 'ca', 'Reemplaçar Foto'),
  
  -- Name section
  ('trke_first_name', 'en', 'First Name'),
  ('trke_first_name', 'es', 'Nombre'),
  ('trke_first_name', 'ca', 'Nom'),
  
  ('trke_last_name', 'en', 'Last Name'),
  ('trke_last_name', 'es', 'Apellido'),
  ('trke_last_name', 'ca', 'Cognom'),
  
  ('trke_full_name', 'en', 'Full Name'),
  ('trke_full_name', 'es', 'Nombre Completo'),
  ('trke_full_name', 'ca', 'Nom Complet'),
  
  -- Language section
  ('trke_language', 'en', 'Language'),
  ('trke_language', 'es', 'Idioma'),
  ('trke_language', 'ca', 'Idioma'),
  
  ('trke_language_preference', 'en', 'Language Preference'),
  ('trke_language_preference', 'es', 'Preferencia de Idioma'),
  ('trke_language_preference', 'ca', 'Preferència d''Idioma'),
  
  -- Email section
  ('trke_email', 'en', 'Email'),
  ('trke_email', 'es', 'Correo Electrónico'),
  ('trke_email', 'ca', 'Correu Electrònic'),
  
  ('trke_email_address', 'en', 'Email Address'),
  ('trke_email_address', 'es', 'Dirección de Correo'),
  ('trke_email_address', 'ca', 'Adreça de Correu'),
  
  ('trke_change_email', 'en', 'Change Email'),
  ('trke_change_email', 'es', 'Cambiar Correo'),
  ('trke_change_email', 'ca', 'Canviar Correu'),
  
  ('trke_new_email', 'en', 'New Email'),
  ('trke_new_email', 'es', 'Nuevo Correo'),
  ('trke_new_email', 'ca', 'Nou Correu'),
  
  ('trke_email_change_info', 'en', 'You will receive a confirmation email. The change will apply after you confirm.'),
  ('trke_email_change_info', 'es', 'Recibirás un correo de confirmación. El cambio se aplicará después de confirmar.'),
  ('trke_email_change_info', 'ca', 'Rebràs un correu de confirmació. El canvi s''aplicarà després de confirmar.'),
  
  -- Password section
  ('trke_password', 'en', 'Password'),
  ('trke_password', 'es', 'Contraseña'),
  ('trke_password', 'ca', 'Contrasenya'),
  
  ('trke_change_password', 'en', 'Change Password'),
  ('trke_change_password', 'es', 'Cambiar Contraseña'),
  ('trke_change_password', 'ca', 'Canviar Contrasenya'),
  
  ('trke_new_password', 'en', 'New Password'),
  ('trke_new_password', 'es', 'Nueva Contraseña'),
  ('trke_new_password', 'ca', 'Nova Contrasenya'),
  
  ('trke_confirm_password', 'en', 'Confirm Password'),
  ('trke_confirm_password', 'es', 'Confirmar Contraseña'),
  ('trke_confirm_password', 'ca', 'Confirmar Contrasenya'),
  
  ('trke_password_min_length', 'en', 'Password must be at least 8 characters'),
  ('trke_password_min_length', 'es', 'La contraseña debe tener al menos 8 caracteres'),
  ('trke_password_min_length', 'ca', 'La contrasenya ha de tenir almenys 8 caràcters'),
  
  ('trke_passwords_must_match', 'en', 'Passwords must match'),
  ('trke_passwords_must_match', 'es', 'Las contraseñas deben coincidir'),
  ('trke_passwords_must_match', 'ca', 'Les contrasenyes han de coincidir'),
  
  -- Phone section
  ('trke_phone', 'en', 'Phone'),
  ('trke_phone', 'es', 'Teléfono'),
  ('trke_phone', 'ca', 'Telèfon'),
  
  ('trke_phone_number', 'en', 'Phone Number'),
  ('trke_phone_number', 'es', 'Número de Teléfono'),
  ('trke_phone_number', 'ca', 'Número de Telèfon'),
  
  ('trke_phone_optional', 'en', 'Phone (optional)'),
  ('trke_phone_optional', 'es', 'Teléfono (opcional)'),
  ('trke_phone_optional', 'ca', 'Telèfon (opcional)'),
  
  -- My teams section
  ('trke_my_teams', 'en', 'My Teams'),
  ('trke_my_teams', 'es', 'Mis Equipos'),
  ('trke_my_teams', 'ca', 'Els Meus Equips'),
  
  ('trke_linked_players', 'en', 'Linked Players'),
  ('trke_linked_players', 'es', 'Jugadores Vinculados'),
  ('trke_linked_players', 'ca', 'Jugadors Vinculats'),
  
  ('trke_jersey_number', 'en', 'Jersey #'),
  ('trke_jersey_number', 'es', 'Dorsal #'),
  ('trke_jersey_number', 'ca', 'Dorsal #'),
  
  ('trke_all_teams', 'en', 'All Teams'),
  ('trke_all_teams', 'es', 'Todos los Equipos'),
  ('trke_all_teams', 'ca', 'Tots els Equips'),
  
  -- Sign out section
  ('trke_sign_out_all_devices', 'en', 'Sign Out All Devices'),
  ('trke_sign_out_all_devices', 'es', 'Cerrar Sesión en Todos los Dispositivos'),
  ('trke_sign_out_all_devices', 'ca', 'Tancar Sessió en Tots els Dispositius'),
  
  ('trke_sign_out_all_confirm', 'en', 'Are you sure you want to sign out from all devices?'),
  ('trke_sign_out_all_confirm', 'es', '¿Estás seguro de que quieres cerrar sesión en todos los dispositivos?'),
  ('trke_sign_out_all_confirm', 'ca', 'Estàs segur que vols tancar sessió en tots els dispositius?'),
  
  -- Role pills
  ('trke_role_admin', 'en', 'Admin'),
  ('trke_role_admin', 'es', 'Admin'),
  ('trke_role_admin', 'ca', 'Admin'),
  
  ('trke_role_team_manager', 'en', 'Team Manager'),
  ('trke_role_team_manager', 'es', 'Director de Equipo'),
  ('trke_role_team_manager', 'ca', 'Director d''Equip'),
  
  ('trke_role_coach', 'en', 'Coach'),
  ('trke_role_coach', 'es', 'Entrenador'),
  ('trke_role_coach', 'ca', 'Entrenador'),
  
  ('trke_role_parent', 'en', 'Parent'),
  ('trke_role_parent', 'es', 'Padre/Madre'),
  ('trke_role_parent', 'ca', 'Pare/Mare'),
  
  ('trke_role_player', 'en', 'Player'),
  ('trke_role_player', 'es', 'Jugador'),
  ('trke_role_player', 'ca', 'Jugador'),
  
  -- Success/error messages
  ('trke_profile_updated', 'en', 'Profile updated successfully'),
  ('trke_profile_updated', 'es', 'Perfil actualizado exitosamente'),
  ('trke_profile_updated', 'ca', 'Perfil actualitzat amb èxit'),
  
  ('trke_email_updated', 'en', 'Email update sent. Check your inbox to confirm.'),
  ('trke_email_updated', 'es', 'Actualización de correo enviada. Revisa tu bandeja de entrada para confirmar.'),
  ('trke_email_updated', 'ca', 'Actualització de correu enviada. Revisa la teva safata d''entrada per confirmar.'),
  
  ('trke_password_updated', 'en', 'Password updated successfully'),
  ('trke_password_updated', 'es', 'Contraseña actualizada exitosamente'),
  ('trke_password_updated', 'ca', 'Contrasenya actualitzada amb èxit'),
  
  ('trke_update_failed', 'en', 'Update failed'),
  ('trke_update_failed', 'es', 'Actualización fallida'),
  ('trke_update_failed', 'ca', 'Actualització fallida'),
  
  -- Actions
  ('trke_save', 'en', 'Save'),
  ('trke_save', 'es', 'Guardar'),
  ('trke_save', 'ca', 'Desar'),
  
  ('trke_cancel', 'en', 'Cancel'),
  ('trke_cancel', 'es', 'Cancelar'),
  ('trke_cancel', 'ca', 'Cancel·lar'),
  
  ('trke_update', 'en', 'Update'),
  ('trke_update', 'es', 'Actualizar'),
  ('trke_update', 'ca', 'Actualitzar'),
  
  -- Forgot password
  ('trke_forgot_password', 'en', 'Forgot Password'),
  ('trke_forgot_password', 'es', 'Olvidé mi Contraseña'),
  ('trke_forgot_password', 'ca', 'He Oblidat la Contrasenya'),
  
  ('trke_forgot_password_instructions', 'en', 'Enter your email address and we will send you a new password.'),
  ('trke_forgot_password_instructions', 'es', 'Introduce tu dirección de correo y te enviaremos una nueva contraseña.'),
  ('trke_forgot_password_instructions', 'ca', 'Introdueix la teva adreça de correu i t''enviarem una nova contrasenya.'),
  
  ('trke_send_password', 'en', 'Send New Password'),
  ('trke_send_password', 'es', 'Enviar Nueva Contraseña'),
  ('trke_send_password', 'ca', 'Enviar Nova Contrasenya'),
  
  ('trke_password_reset_sent', 'en', 'If an account exists with that email, a new password has been sent.'),
  ('trke_password_reset_sent', 'es', 'Si existe una cuenta con ese correo, se ha enviado una nueva contraseña.'),
  ('trke_password_reset_sent', 'ca', 'Si existeix un compte amb aquest correu, s''ha enviat una nova contrasenya.'),
  
  ('trke_rate_limit_exceeded', 'en', 'Too many requests. Please try again later.'),
  ('trke_rate_limit_exceeded', 'es', 'Demasiadas solicitudes. Por favor intenta más tarde.'),
  ('trke_rate_limit_exceeded', 'ca', 'Massa sol·licituds. Si us plau, prova més tard.'),
  
  -- Password change required
  ('trke_must_change_password', 'en', 'You must change your password'),
  ('trke_must_change_password', 'es', 'Debes cambiar tu contraseña'),
  ('trke_must_change_password', 'ca', 'Has de canviar la teva contrasenya'),
  
  ('trke_current_password', 'en', 'Current Password'),
  ('trke_current_password', 'es', 'Contraseña Actual'),
  ('trke_current_password', 'ca', 'Contrasenya Actual'),
  
  ('trke_current_password_required', 'en', 'Current password is required'),
  ('trke_current_password_required', 'es', 'Se requiere la contraseña actual'),
  ('trke_current_password_required', 'ca', 'Es requereix la contrasenya actual'),
  
  ('trke_incorrect_password', 'en', 'Incorrect password'),
  ('trke_incorrect_password', 'es', 'Contraseña incorrecta'),
  ('trke_incorrect_password', 'ca', 'Contrasenya incorrecta'),
  
  -- Admin user creation
  ('trke_create_user', 'en', 'Create User'),
  ('trke_create_user', 'es', 'Crear Usuario'),
  ('trke_create_user', 'ca', 'Crear Usuari'),
  
  ('trke_user_created', 'en', 'User created and welcome email sent'),
  ('trke_user_created', 'es', 'Usuario creado y correo de bienvenida enviado'),
  ('trke_user_created', 'ca', 'Usuari creat i correu de benvinguda enviat'),
  
  ('trke_email_send_failed', 'en', 'User created but email failed to send'),
  ('trke_email_send_failed', 'es', 'Usuario creado pero el correo no se pudo enviar'),
  ('trke_email_send_failed', 'ca', 'Usuari creat però el correu no s''ha pogut enviar'),
  
  ('trke_resend_password', 'en', 'Resend Password'),
  ('trke_resend_password', 'es', 'Reenviar Contraseña'),
  ('trke_resend_password', 'ca', 'Reenviar Contrasenya'),
  
  ('trke_reset_user_password', 'en', 'Reset Password'),
  ('trke_reset_user_password', 'es', 'Restablecer Contraseña'),
  ('trke_reset_user_password', 'ca', 'Restablir Contrasenya'),
  
  ('trke_password_reset_confirm', 'en', 'Generate new password and email to user?'),
  ('trke_password_reset_confirm', 'es', '¿Generar nueva contraseña y enviarla al usuario?'),
  ('trke_password_reset_confirm', 'ca', 'Generar nova contrasenya i enviar-la a l''usuari?'),
  
  ('trke_email_not_configured', 'en', 'Email service not configured. Please contact support.'),
  ('trke_email_not_configured', 'es', 'Servicio de correo no configurado. Por favor contacta a soporte.'),
  ('trke_email_not_configured', 'ca', 'Servei de correu no configurat. Si us plau, contacta amb suport.'),
  
  -- Theme
  ('trke_theme', 'en', 'Theme'),
  ('trke_theme', 'es', 'Tema'),
  ('trke_theme', 'ca', 'Tema'),
  
  ('trke_theme_preference', 'en', 'Theme Preference'),
  ('trke_theme_preference', 'es', 'Preferencia de Tema'),
  ('trke_theme_preference', 'ca', 'Preferència de Tema'),
  
  ('trke_light_mode', 'en', 'Light Mode'),
  ('trke_light_mode', 'es', 'Modo Claro'),
  ('trke_light_mode', 'ca', 'Mode Clar'),
  
  ('trke_dark_mode', 'en', 'Dark Mode'),
  ('trke_dark_mode', 'es', 'Modo Oscuro'),
  ('trke_dark_mode', 'ca', 'Mode Fosc'),
  
  -- Additional password auth keys
  ('trke_password_auth_title', 'en', 'Password Required'),
  ('trke_password_auth_title', 'es', 'Contraseña Requerida'),
  ('trke_password_auth_title', 'ca', 'Contrasenya Requerida'),
  
  ('trke_password_auth_description', 'en', 'Enter your password to continue'),
  ('trke_password_auth_description', 'es', 'Ingresa tu contraseña para continuar'),
  ('trke_password_auth_description', 'ca', 'Introdueix la teva contrasenya per continuar'),
  
  ('trke_confirm_new_password', 'en', 'Confirm New Password'),
  ('trke_confirm_new_password', 'es', 'Confirmar Nueva Contraseña'),
  ('trke_confirm_new_password', 'ca', 'Confirmar Nova Contrasenya'),
  
  ('trke_must_change_password_desc', 'en', 'For security, please set a new password before continuing'),
  ('trke_must_change_password_desc', 'es', 'Por seguridad, establece una nueva contraseña antes de continuar'),
  ('trke_must_change_password_desc', 'ca', 'Per seguretat, estableix una nova contrasenya abans de continuar'),
  
  ('trke_forgot_password_title', 'en', 'Reset Password'),
  ('trke_forgot_password_title', 'es', 'Restablecer Contraseña'),
  ('trke_forgot_password_title', 'ca', 'Restablir Contrasenya'),
  
  ('trke_forgot_password_desc', 'en', 'Enter your email address and we will send you a new password'),
  ('trke_forgot_password_desc', 'es', 'Ingresa tu correo electrónico y te enviaremos una nueva contraseña'),
  ('trke_forgot_password_desc', 'ca', 'Introdueix el teu correu electrònic i t''enviarem una nova contrasenya'),
  
  ('trke_send_reset_link', 'en', 'Send New Password'),
  ('trke_send_reset_link', 'es', 'Enviar Nueva Contraseña'),
  ('trke_send_reset_link', 'ca', 'Enviar Nova Contrasenya'),
  
  ('trke_reset_link_sent', 'en', 'If an account exists with that email, a new password has been sent'),
  ('trke_reset_link_sent', 'es', 'Si existe una cuenta con ese correo, se ha enviado una nueva contraseña'),
  ('trke_reset_link_sent', 'ca', 'Si existeix un compte amb aquest correu, s''ha enviat una nova contrasenya'),
  
  ('trke_password_reset_success', 'en', 'Password reset successfully'),
  ('trke_password_reset_success', 'es', 'Contraseña restablecida exitosamente'),
  ('trke_password_reset_success', 'ca', 'Contrasenya restablerta exitosament'),
  
  ('trke_password_changed_success', 'en', 'Password changed successfully'),
  ('trke_password_changed_success', 'es', 'Contraseña cambiada exitosamente'),
  ('trke_password_changed_success', 'ca', 'Contrasenya canviada exitosament'),
  
  ('trke_email_changed_success', 'en', 'Email changed successfully'),
  ('trke_email_changed_success', 'es', 'Correo electrónico cambiado exitosamente'),
  ('trke_email_changed_success', 'ca', 'Correu electrònic canviat exitosament'),
  
  ('trke_reset_password', 'en', 'Reset Password'),
  ('trke_reset_password', 'es', 'Restablecer Contraseña'),
  ('trke_reset_password', 'ca', 'Restablir Contrasenya'),
  
  ('trke_verify_password', 'en', 'Verify Current Password'),
  ('trke_verify_password', 'es', 'Verificar Contraseña Actual'),
  ('trke_verify_password', 'ca', 'Verificar Contrasenya Actual'),
  
  ('trke_password_incorrect', 'en', 'Incorrect password'),
  ('trke_password_incorrect', 'es', 'Contraseña incorrecta'),
  ('trke_password_incorrect', 'ca', 'Contrasenya incorrecta'),
  
  ('trke_password_requirements', 'en', 'Password must be at least 6 characters'),
  ('trke_password_requirements', 'es', 'La contraseña debe tener al menos 6 caracteres'),
  ('trke_password_requirements', 'ca', 'La contrasenya ha de tenir almenys 6 caràcters'),
  
  ('trke_rate_limit_password_reset', 'en', 'Please wait 15 minutes between password reset requests'),
  ('trke_rate_limit_password_reset', 'es', 'Espera 15 minutos entre solicitudes de restablecimiento'),
  ('trke_rate_limit_password_reset', 'ca', 'Espera 15 minuts entre sol·licituds de restabliment'),
  
  -- Theme variations (light/dark instead of light_mode/dark_mode)
  ('trke_light_theme', 'en', 'Light'),
  ('trke_light_theme', 'es', 'Claro'),
  ('trke_light_theme', 'ca', 'Clar'),
  
  ('trke_dark_theme', 'en', 'Dark'),
  ('trke_dark_theme', 'es', 'Oscuro'),
  ('trke_dark_theme', 'ca', 'Fosc'),
  
  ('trke_theme_updated', 'en', 'Theme updated successfully'),
  ('trke_theme_updated', 'es', 'Tema actualizado exitosamente'),
  ('trke_theme_updated', 'ca', 'Tema actualitzat exitosament')

ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
