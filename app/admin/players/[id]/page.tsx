import { z } from 'zod';
import { PlayerForm } from '../player-form';
import { MissingRecord } from '../../missing-record';

export default async function EditPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) {
    return <MissingRecord backHref="/admin/players" />;
  }
  return <PlayerForm playerId={id} startEditing={query.edit === '1'} />;
}