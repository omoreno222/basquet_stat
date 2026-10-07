import { redirect } from 'next/navigation';

export default async function CaptureRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ entry?: string | string[] }>;
}) {
  const { id } = await params;
  const { entry } = await searchParams;
  const deferred = entry === 'deferred' || (Array.isArray(entry) && entry.includes('deferred'));
  redirect(deferred
    ? `/team-manager/games/deferred/${id}`
    : `/team-manager/games/live/${id}`);
}
