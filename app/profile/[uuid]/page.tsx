import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { assertPlatformAdmin, getAuthenticatedUser } from '@/lib/auth-server';
import { ProfileEditor } from './profile-editor';

export default async function ProfileByIdPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  if (!z.string().uuid().safeParse(uuid).success) notFound();

  const { user, error } = await getAuthenticatedUser();
  if (error || !user) redirect('/login');

  if (user.id !== uuid) {
    const admin = await assertPlatformAdmin();
    if (admin.error) notFound();
  }

  return <ProfileEditor profileId={uuid} />;
}
