'use client';

interface CaptureNoticeModalProps {
  title?: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
}

export function CaptureNoticeModal({
  title,
  body,
  confirmLabel,
  onConfirm,
}: CaptureNoticeModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'capture-notice-title' : undefined}
        className="w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-2xl"
      >
        {title ? (
          <h2 id="capture-notice-title" className="mb-3 text-center text-2xl font-bold text-white">
            {title}
          </h2>
        ) : null}
        <p className="whitespace-pre-line text-center text-lg text-gray-200">{body}</p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-6 w-full rounded-lg bg-white py-3 text-lg font-black text-black"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
