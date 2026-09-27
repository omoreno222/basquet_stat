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

-- Backfill locale from language where locale is null
UPDATE profiles SET locale = language WHERE locale IS NULL AND language IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.first_name IS 'User first name';
COMMENT ON COLUMN profiles.last_name IS 'User last name';
COMMENT ON COLUMN profiles.phone IS 'User phone number (optional)';
COMMENT ON COLUMN profiles.locale IS 'User preferred language for UI (en/es/ca)';

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
  ('trke_update', 'ca', 'Actualitzar')

ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
