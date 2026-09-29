import { z } from 'zod';
import { ClubForm } from '../club-form';
import { MissingRecord } from '../../missing-record';

export default async function EditClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return <MissingRecord backHref="/admin/clubs" />;
  }
  return <ClubForm clubId={id} />;
}
