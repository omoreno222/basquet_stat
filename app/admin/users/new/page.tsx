import { Suspense } from 'react';
import { UserForm } from '../user-form';

export default function NewUserPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading...</p>}>
      <UserForm />
    </Suspense>
  );
}
