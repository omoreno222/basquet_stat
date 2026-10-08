'use client';

interface PeriodInboundModalProps {
  proposal: string;
  question: string;
  yesLabel: string;
  noLabel: string;
  flipped: string | null;
  okLabel: string;
  onNo: () => void;
  onYes: () => void;
  onAck: () => void;
}

export function PeriodInboundModal({
  proposal,
  question,
  yesLabel,
  noLabel,
  flipped,
  okLabel,
  onNo,
  onYes,
  onAck,
}: PeriodInboundModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-inbound-title"
        className="w-full max-w-md border border-neutral-300 bg-white p-6 text-neutral-900 shadow-2xl"
      >
        {flipped ? (
          <>
            <p id="period-inbound-title" className="text-center text-lg font-black">
              {flipped}
            </p>
            <button
              type="button"
              onClick={onAck}
              className="mt-6 w-full bg-neutral-900 py-3 text-sm font-black text-white hover:bg-black"
              style={{ minHeight: '48px' }}
            >
              {okLabel}
            </button>
          </>
        ) : (
          <>
            <h2 id="period-inbound-title" className="text-center text-lg font-black">
              {proposal}
            </h2>
            <p className="mt-3 text-center text-sm font-medium text-neutral-600">{question}</p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onNo}
                className="flex-1 border-2 border-neutral-900 bg-white py-3 text-sm font-black text-neutral-900 hover:bg-neutral-100"
                style={{ minHeight: '48px' }}
              >
                {noLabel}
              </button>
              <button
                type="button"
                onClick={onYes}
                className="flex-1 border-2 border-neutral-900 bg-white py-3 text-sm font-black text-neutral-900 hover:bg-neutral-100"
                style={{ minHeight: '48px' }}
              >
                {yesLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
