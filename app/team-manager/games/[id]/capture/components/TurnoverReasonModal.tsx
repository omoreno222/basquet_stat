'use client';

import type { TurnoverReason } from '@/lib/capture/plays';

interface TurnoverReasonModalProps {
  reasons: { id: TurnoverReason; label: string }[];
  cancelLabel: string;
  disabled: boolean;
  selectedId: TurnoverReason | null;
  onSelect: (reason: TurnoverReason) => void;
  onClose: () => void;
}

const buttonClass = 'min-h-[4.8rem] rounded-xl bg-gray-700 px-5 py-[1.2rem] text-2xl font-bold text-white disabled:opacity-60';

function ReasonButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`relative ${buttonClass} ${
        selected ? 'bg-orange-600 ring-2 ring-white' : 'hover:bg-orange-600'
      }`}
    >
      {label}
      {selected ? (
        <svg
          viewBox="0 0 24 24"
          className="absolute right-4 top-1/2 h-8 w-8 -translate-y-1/2"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          aria-hidden="true"
        >
          <path d="M5 13l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

export function TurnoverReasonModal({
  reasons,
  cancelLabel,
  disabled,
  selectedId,
  onSelect,
  onClose,
}: TurnoverReasonModalProps) {
  const leading = (['bad_pass_lost', 'ball_handling_lost'] as const).flatMap((id) => {
    const reason = reasons.find((item) => item.id === id);
    return reason ? [reason] : [];
  });
  const rest = reasons.filter((reason) => reason.id !== 'bad_pass_lost' && reason.id !== 'ball_handling_lost');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border-2 border-orange-500 bg-gray-800 shadow-2xl">
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {leading.map((reason) => (
              <ReasonButton
                key={reason.id}
                label={reason.label}
                selected={selectedId === reason.id}
                disabled={disabled || (selectedId !== null && selectedId !== reason.id)}
                onClick={() => onSelect(reason.id)}
              />
            ))}
          </div>
          <div className="my-4 border-t-2 border-gray-500" role="separator" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rest.map((reason) => (
              <ReasonButton
                key={reason.id}
                label={reason.label}
                selected={selectedId === reason.id}
                disabled={disabled || (selectedId !== null && selectedId !== reason.id)}
                onClick={() => onSelect(reason.id)}
              />
            ))}
          </div>
        </div>
        <div className="p-4 pt-0">
          <button
            type="button"
            disabled={disabled || selectedId !== null}
            onClick={onClose}
            className={`${buttonClass} w-full hover:bg-gray-600`}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
