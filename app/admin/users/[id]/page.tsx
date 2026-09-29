import { Suspense } from 'react';
import { z } from 'zod';
import { UserForm } from '../user-form';
import { MissingRecord } from '../../missing-record';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return <MissingRecord backHref="/admin/users" />;
  }
  return (
    <Suspense fallback={<p className="p-8">Loading...</p>}>
      <UserForm userId={id} />
    </Suspense>
  );
}
