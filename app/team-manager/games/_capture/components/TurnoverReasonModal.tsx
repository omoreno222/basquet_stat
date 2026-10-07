'use client';

import { turnoverStopsClock, type TurnoverReason } from '@/lib/capture/plays';

interface TurnoverReasonModalProps {
  reasons: { id: TurnoverReason; label: string }[];
  cancelLabel: string;
  stopsClockLabel: string;
  runsClockLabel: string;
  disabled: boolean;
  selectedId: TurnoverReason | null;
  onSelect: (reason: TurnoverReason) => void;
  onClose: () => void;
}

const buttonClass = 'min-h-[4.8rem] rounded-xl bg-gray-700 px-5 py-[1.2rem] text-2xl font-bold text-white disabled:opacity-60';

function ClockMark({ stops }: { stops: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-8 w-8 shrink-0 ${stops ? 'text-red-300' : 'text-emerald-300'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="7" />
      <path d="M9 4.5h6" strokeLinecap="round" />
      <path d="M12 4.5V6.5" strokeLinecap="round" />
      {stops ? (
        <>
          <path d="M10.2 10.8v4.4" strokeLinecap="round" />
          <path d="M13.8 10.8v4.4" strokeLinecap="round" />
        </>
      ) : (
        <path d="M10.4 10.4 15 13l-4.6 2.6V10.4Z" fill="currentColor" stroke="none" />
      )}
    </svg>
  );
}

function ReasonButton({
  label,
  clockLabel,
  stops,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  clockLabel: string;
  stops: boolean;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${label}. ${clockLabel}`}
      onClick={onClick}
      className={`flex items-center gap-2 text-left ${buttonClass} ${
        selected ? 'bg-orange-600 ring-2 ring-white' : 'hover:bg-orange-600'
      }`}
    >
      <ClockMark stops={stops} />
      <span className="min-w-0 flex-1 text-center leading-tight">{label}</span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        {selected ? (
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            aria-hidden="true"
          >
            <path d="M5 13l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    </button>
  );
}

export function TurnoverReasonModal({
  reasons,
  cancelLabel,
  stopsClockLabel,
  runsClockLabel,
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
                stops={turnoverStopsClock(reason.id)}
                clockLabel={turnoverStopsClock(reason.id) ? stopsClockLabel : runsClockLabel}
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
                stops={turnoverStopsClock(reason.id)}
                clockLabel={turnoverStopsClock(reason.id) ? stopsClockLabel : runsClockLabel}
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
