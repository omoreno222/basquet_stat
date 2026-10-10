import { z } from 'zod';
import { TeamForm } from '../team-form';
import { MissingRecord } from '../../missing-record';

export default async function EditTeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) {
    return <MissingRecord backHref="/admin/teams" />;
  }
  return <TeamForm teamId={id} startEditing={query.edit === '1'} />;
}