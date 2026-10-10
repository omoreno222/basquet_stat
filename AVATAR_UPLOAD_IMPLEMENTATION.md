# Avatar Upload Implementation

## Overview
This document describes the avatar/photo upload feature implementation for the basquet_stat application. This feature allows admins to upload, change, and remove photos for players and user profiles.

## Implementation Summary

### 1. Database Changes (Migration 009)

#### Schema Updates
- Added `avatar_url TEXT` column to `profiles` table (nullable)
- Added `avatar_url TEXT` column to `players` table (nullable)

#### Storage Bucket
- Created public bucket named `avatars` in Supabase Storage
- Path convention:
  - User profiles: `profiles/{profile_id}/avatar.{ext}`
  - Players: `players/{player_id}/avatar.{ext}`

#### RLS Policies
The following Row Level Security policies were implemented:

**Read Access:**
- Any authenticated user can view all avatars

**Write Access (Admin Only):**
- Admins can upload/update/delete any avatar (checked via `is_admin()` function)

**User Self-Service (Optional):**
- Users can manage their own profile avatar at path `profiles/{user_id}/*`
- Separate policies for INSERT, UPDATE, and DELETE operations

### 2. Server Actions

Four new server actions were added to `/app/admin/actions.ts`:

#### `uploadProfileAvatar(profileId: string, file: File)`
- Validates file type (JPEG/PNG/WebP only)
- Validates file size (5MB max)
- Deletes old avatar if exists
- Uploads new avatar to storage
- Updates `profiles.avatar_url` with public URL
- Returns `{ success: true, url: string }` or `{ error: string }`

#### `removeProfileAvatar(profileId: string)`
- Deletes avatar files from storage
- Sets `profiles.avatar_url` to `NULL`
- Returns `{ success: true }` or `{ error: string }`

#### `uploadPlayerAvatar(playerId: string, file: File)`
- Same validation as profile avatar
- Uploads to `players/{player_id}/` path
- Updates `players.avatar_url`

#### `removePlayerAvatar(playerId: string)`
- Deletes player avatar from storage
- Sets `players.avatar_url` to `NULL`

### 3. Admin UI Updates

#### Users Page (`/app/admin/users/page.tsx`)
- Added avatar thumbnail display (48x48 rounded circle)
- Shows user initials as fallback when no avatar exists
- "Add Photo" / "Change Photo" button (changes based on whether avatar exists)
- "Remove" button (only shown when avatar exists)
- File input hidden, triggered programmatically
- Upload status indicator ("Uploading...")
- Success/error notification messages
- Uses Next.js Image component for optimized loading

#### Players Page (`/app/admin/players/page.tsx`)
- Same UI pattern as Users page
- Avatar thumbnail with player's first initial as fallback
- Upload/change/remove buttons
- Status indicators and notifications

### 4. Type Updates

Updated TypeScript interfaces in `/types/database.ts`:

```typescript
export interface Profile {
  // ... existing fields ...
  avatar_url: string | null;
}

export interface Player {
  // ... existing fields ...
  avatar_url: string | null;
}
```

### 5. Internationalization

Added translations in EN/ES/CA for:
- `trke_admin_add_photo` - "Add Photo" / "Añadir Foto" / "Afegir Foto"
- `trke_admin_change_photo` - "Change Photo" / "Cambiar Foto" / "Canviar Foto"
- `trke_admin_remove_photo` - "Remove Photo" / "Eliminar Foto" / "Eliminar Foto"
- `trke_admin_uploading` - "Uploading..." / "Subiendo..." / "Pujant..."
- Success/error messages for upload/remove operations
- File validation error messages

### 6. Next.js Configuration

Updated `next.config.js` to allow Next.js Image optimization for Supabase Storage:

```javascript
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};
```

## Setup Instructions

### 1. Apply Migration
Run the migration script:
```bash
npm run db:migrate
```

Or manually via Supabase Dashboard SQL editor:
- Navigate to SQL Editor
- Run the contents of `supabase/migrations/009_avatar_storage.sql`

### 2. Verify Storage Bucket
If the bucket wasn't created automatically via SQL:
1. Go to Supabase Dashboard → Storage
2. Create new bucket named `avatars`
3. Set as **Public bucket**
4. RLS policies are already created by the migration

### 3. Restart Development Server
```bash
npm run dev
```

## Testing Checklist

- [ ] Navigate to `/admin/users` as admin
- [ ] Click "Add Photo" for a user
- [ ] Select a valid JPEG/PNG/WebP file (< 5MB)
- [ ] Verify upload completes and thumbnail appears
- [ ] Click "Change Photo" to replace the avatar
- [ ] Verify old avatar is replaced
- [ ] Click "Remove" to delete avatar
- [ ] Verify avatar is removed and fallback initial appears
- [ ] Test with invalid file type (e.g., .txt) - should show error
- [ ] Test with file > 5MB - should show error
- [ ] Repeat same tests on `/admin/players` page
- [ ] Verify avatar URLs are properly stored in database
- [ ] Check that storage bucket contains uploaded files
- [ ] Verify RLS policies prevent non-admin uploads (if testing as non-admin)

## Security Considerations

1. **Authentication Required**: All storage operations require authenticated users
2. **Admin-Only Uploads**: Only admins can upload/delete avatars (enforced via `is_admin()` RLS policy)
3. **File Validation**: Server-side validation of file type and size
4. **Service Role Protection**: Service role key only used in server actions (protected by Next.js)
5. **No Secrets in Repository**: All sensitive keys remain in environment variables
6. **Path Isolation**: User avatars stored in separate folders per user/player
7. **Automatic Cleanup**: Old avatars automatically deleted when uploading new ones

## File Structure

```
basquet_stat/
├── app/admin/
│   ├── actions.ts                    # Server actions for avatar upload/remove
│   ├── users/page.tsx                # Users admin page with avatar UI
│   └── players/page.tsx              # Players admin page with avatar UI
├── supabase/migrations/
│   └── 009_avatar_storage.sql        # Migration for avatars
├── types/
│   └── database.ts                   # Updated type definitions
├── lib/
│   ├── supabase.ts                   # Supabase client setup
│   └── i18n.ts                       # i18n utilities
└── next.config.js                    # Next.js config for images
```

## Future Enhancements

Possible improvements for future iterations:
- Image cropping/resizing UI before upload
- Drag-and-drop upload interface
- Preview before upload
- Image compression on client-side
- Bulk avatar upload for multiple users
- Avatar display in more locations (game capture, rosters, etc.)
- Support for additional formats (GIF, SVG)
- Avatar history/versioning
- Integration with profile/player detail pages

## Troubleshooting

### Issue: Images not loading
**Solution**: 
- Verify `next.config.js` includes Supabase domain
- Check browser console for CORS errors
- Restart Next.js dev server after config changes

### Issue: Upload fails with permission error
**Solution**:
- Verify user has admin role
- Check RLS policies are applied
- Confirm `is_admin()` function exists in database

### Issue: Storage bucket not found
**Solution**:
- Manually create bucket in Supabase Dashboard
- Ensure bucket name is exactly `avatars`
- Set bucket as public

### Issue: File size validation not working
**Solution**:
- Validation is server-side only
- Client file input doesn't enforce size limit
- Error message should appear after upload attempt

## References

- Supabase Storage Documentation: https://supabase.com/docs/guides/storage
- Next.js Image Optimization: https://nextjs.org/docs/pages/building-your-application/optimizing/images
- Supabase RLS Policies: https://supabase.com/docs/guides/auth/row-level-security
