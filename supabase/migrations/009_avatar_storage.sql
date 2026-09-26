-- Migration 009: Avatar/Photo upload for profiles and players
-- Add avatar_url columns and create storage bucket with RLS policies

-- Add avatar_url column to profiles
ALTER TABLE profiles ADD COLUMN avatar_url TEXT;

-- Add avatar_url column to players
ALTER TABLE players ADD COLUMN avatar_url TEXT;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for avatars bucket

-- Allow authenticated users to read all avatars
CREATE POLICY "Anyone authenticated can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- Allow admins to upload avatars for any profile or player
CREATE POLICY "Admins can upload any avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  is_admin()
);

-- Allow admins to update any avatar
CREATE POLICY "Admins can update any avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND is_admin())
WITH CHECK (bucket_id = 'avatars' AND is_admin());

-- Allow admins to delete any avatar
CREATE POLICY "Admins can delete any avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND is_admin());

-- Optional: Allow users to update their own profile avatar
-- Path format: profiles/{user_id}/avatar.jpg
CREATE POLICY "Users can upload their own profile avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profiles' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can update their own profile avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profiles' AND
  (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profiles' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users can delete their own profile avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = 'profiles' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Add comments for documentation
COMMENT ON COLUMN profiles.avatar_url IS 'URL to user avatar in storage bucket avatars, path format: profiles/{profile_id}/avatar.jpg';
COMMENT ON COLUMN players.avatar_url IS 'URL to player avatar in storage bucket avatars, path format: players/{player_id}/avatar.jpg';

-- Add i18n translations for avatar upload
INSERT INTO translations (key, locale, value)
VALUES
  -- Avatar upload labels
  ('trke_admin_add_photo', 'en', 'Add Photo'),
  ('trke_admin_add_photo', 'es', 'Añadir Foto'),
  ('trke_admin_add_photo', 'ca', 'Afegir Foto'),
  
  ('trke_admin_change_photo', 'en', 'Change Photo'),
  ('trke_admin_change_photo', 'es', 'Cambiar Foto'),
  ('trke_admin_change_photo', 'ca', 'Canviar Foto'),
  
  ('trke_admin_remove_photo', 'en', 'Remove Photo'),
  ('trke_admin_remove_photo', 'es', 'Eliminar Foto'),
  ('trke_admin_remove_photo', 'ca', 'Eliminar Foto'),
  
  ('trke_admin_uploading', 'en', 'Uploading...'),
  ('trke_admin_uploading', 'es', 'Subiendo...'),
  ('trke_admin_uploading', 'ca', 'Pujant...'),
  
  -- Success/error messages
  ('trke_admin_avatar_uploaded', 'en', 'Avatar uploaded successfully'),
  ('trke_admin_avatar_uploaded', 'es', 'Avatar subido exitosamente'),
  ('trke_admin_avatar_uploaded', 'ca', 'Avatar pujat amb èxit'),
  
  ('trke_admin_avatar_removed', 'en', 'Avatar removed successfully'),
  ('trke_admin_avatar_removed', 'es', 'Avatar eliminado exitosamente'),
  ('trke_admin_avatar_removed', 'ca', 'Avatar eliminat amb èxit'),
  
  ('trke_admin_invalid_file_type', 'en', 'Invalid file type. Only JPEG, PNG, and WebP are allowed.'),
  ('trke_admin_invalid_file_type', 'es', 'Tipo de archivo inválido. Solo se permiten JPEG, PNG y WebP.'),
  ('trke_admin_invalid_file_type', 'ca', 'Tipus de fitxer invàlid. Només es permeten JPEG, PNG i WebP.'),
  
  ('trke_admin_file_too_large', 'en', 'File size exceeds 5MB limit.'),
  ('trke_admin_file_too_large', 'es', 'El tamaño del archivo excede el límite de 5MB.'),
  ('trke_admin_file_too_large', 'ca', 'La mida del fitxer excedeix el límit de 5MB.'),
  
  ('trke_admin_remove_avatar_confirm', 'en', 'Are you sure you want to remove this avatar?'),
  ('trke_admin_remove_avatar_confirm', 'es', '¿Estás seguro de que quieres eliminar este avatar?'),
  ('trke_admin_remove_avatar_confirm', 'ca', 'Estàs segur que vols eliminar aquest avatar?')

ON CONFLICT (key, locale) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
