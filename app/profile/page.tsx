import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/auth-server';

export default async function ProfilePage() {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) redirect('/login');
  redirect(`/profile/${user.id}`);
}
