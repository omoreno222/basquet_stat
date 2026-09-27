'use client';

import { ChooseSideModal } from '@/app/team-manager/games/[id]/capture/components/ChooseSideModal';

export default function ChooseSideDemoPage() {
  return (
    <div className="fixed inset-0 bg-gray-900">
      <ChooseSideModal
        onChoose={(attackRight) => {
          console.log('Chose:', attackRight ? 'Right' : 'Left');
        }}
      />
    </div>
  );
}
