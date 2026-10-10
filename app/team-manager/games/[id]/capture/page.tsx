import { redirect } from 'next/navigation';

export default async function CaptureRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/team-manager/games/live/${id}`);
}
