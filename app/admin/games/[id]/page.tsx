import { z } from 'zod';
import { GameForm } from '../game-form';
import { MissingRecord } from '../../missing-record';

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return <MissingRecord backHref="/admin/games" />;
  }
  return <GameForm gameId={id} />;
}