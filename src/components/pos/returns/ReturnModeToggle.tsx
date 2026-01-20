'use client';

import { PackageSearch, Receipt } from 'lucide-react';

export type ReturnMode = 'receipt' | 'manual';

type ReturnModeToggleProps = {
  mode: ReturnMode;
  onChange: (mode: ReturnMode) => void;
};

const modes: Array<{
  id: ReturnMode;
  label: string;
  description: string;
  icon: typeof Receipt;
}> = [
  {
    id: 'receipt',
    label: 'Return by Receipt',
    description: 'Lookup a past order and select items.',
    icon: Receipt,
  },
  {
    id: 'manual',
    label: 'Manual Item Return',
    description: 'Return items without a bill or receipt.',
    icon: PackageSearch,
  },
];

export function ReturnModeToggle({ mode, onChange }: ReturnModeToggleProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-slate-900">
          Sales Return Mode
        </h2>
        <p className="text-xs text-slate-500">
          Choose the workflow that matches the customer situation.
        </p>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {modes.map((option) => {
          const Icon = option.icon;
          const isActive = mode === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={isActive}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isActive
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span className="block text-xs text-slate-500">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
