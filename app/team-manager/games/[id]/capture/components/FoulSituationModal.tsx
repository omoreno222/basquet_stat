'use client';

interface FoulChoice<T extends string> {
  id: T;
  label: string;
}

interface FoulSituationModalProps<T extends string> {
  choices: FoulChoice<T>[];
  cancelLabel: string;
  disabled: boolean;
  selectedId: T | null;
  onSelect: (id: T) => void;
  onClose: () => void;
}

const buttonClass = 'min-h-[4.8rem] rounded-xl bg-gray-700 px-5 py-[1.2rem] text-2xl font-bold text-white disabled:opacity-60';

export function FoulSituationModal<T extends string>({
  choices,
  cancelLabel,
  disabled,
  selectedId,
  onSelect,
  onClose,
}: FoulSituationModalProps<T>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border-2 border-orange-500 bg-gray-800 shadow-2xl">
        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {choices.map((choice) => {
              const selected = selectedId === choice.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  disabled={disabled || (selectedId !== null && !selected)}
                  aria-pressed={selected}
                  onClick={() => onSelect(choice.id)}
                  className={`relative ${buttonClass} ${selected ? 'bg-orange-600 ring-2 ring-white' : 'hover:bg-orange-600'}`}
                >
                  {choice.label}
                </button>
              );
            })}
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
