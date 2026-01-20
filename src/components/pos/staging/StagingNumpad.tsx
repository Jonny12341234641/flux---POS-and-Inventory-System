'use client';

import { Check, Delete, X } from 'lucide-react';

type StagingNumpadProps = {
  value: string;
  onInput: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  mode: 'add' | 'edit';
  errorMessage?: string | null;
};

const keypadLayout = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '.',
  '0',
  'backspace',
];

export function StagingNumpad({
  value,
  onInput,
  onConfirm,
  onCancel,
  mode,
  errorMessage,
}: StagingNumpadProps) {
  const confirmLabel = mode === 'edit' ? 'Update Item' : 'Add to Cart';
  const hasError = Boolean(errorMessage);

  return (
    <div className="flex h-full flex-col gap-5">
      <div>
        <input
          readOnly
          value={value}
          inputMode="decimal"
          aria-label="Quantity input"
          className={`w-full rounded-2xl border bg-slate-950 px-4 py-5 text-right text-5xl font-semibold text-white shadow-inner outline-none ${
            hasError
              ? 'border-red-500 text-red-100'
              : 'border-slate-700 text-white'
          }`}
        />
        {hasError ? (
          <p className="mt-2 text-xs font-semibold text-red-400">
            {errorMessage}
          </p>
        ) : null}
      </div>
      <div className="grid flex-1 grid-cols-3 gap-3">
        {keypadLayout.map((key) => {
          const isBackspace = key === 'backspace';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onInput(key)}
              className="flex h-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl font-semibold text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200 active:scale-95"
              aria-label={isBackspace ? 'Backspace' : `Input ${key}`}
            >
              {isBackspace ? <Delete className="h-6 w-6" /> : key}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
        >
          <Check className="h-4 w-4" />
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
