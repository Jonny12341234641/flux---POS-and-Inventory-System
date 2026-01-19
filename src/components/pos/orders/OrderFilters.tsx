'use client';

import { Search } from 'lucide-react';

export type OrderTab = 'held' | 'debt' | 'history';

type OrderFiltersProps = {
  activeTab: OrderTab;
  onTabChange: (tab: OrderTab) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
};

const tabs: { id: OrderTab; label: string }[] = [
  { id: 'held', label: 'Held Orders' },
  { id: 'debt', label: 'Debt/Credit' },
  { id: 'history', label: 'History' },
];

export function OrderFilters({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}: OrderFiltersProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-pressed={isActive}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by Order # or Customer Name"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
        />
      </div>
    </div>
  );
}
