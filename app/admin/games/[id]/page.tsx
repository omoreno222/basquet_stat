import { z } from 'zod';
import { GameForm } from '../game-form';
import { MissingRecord } from '../../missing-record';

export default async function EditGamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) {
    return <MissingRecord backHref="/admin/games" />;
  }
  return <GameForm gameId={id} returnTo={returnTo} />;
}