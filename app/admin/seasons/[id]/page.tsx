import { z } from 'zod';
import { SeasonForm } from '../season-form';
import { MissingRecord } from '../../missing-record';

export default async function EditSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return <MissingRecord backHref="/admin/seasons" />;
  }
  return <SeasonForm seasonId={id} />;
}