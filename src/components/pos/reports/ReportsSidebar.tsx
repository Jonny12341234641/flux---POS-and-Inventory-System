'use client';

import { Activity, History, Receipt, type LucideIcon } from 'lucide-react';

export type ReportsTab = 'x-report' | 'z-report' | 'activity';

type ReportsSidebarProps = {
  activeTab: ReportsTab;
  onChange: (tab: ReportsTab) => void;
};

const tabs: Array<{
  id: ReportsTab;
  label: string;
  helper: string;
  icon: LucideIcon;
}> = [
  {
    id: 'x-report',
    label: 'Current Shift',
    helper: 'X-Report',
    icon: Receipt,
  },
  {
    id: 'z-report',
    label: 'Shift History',
    helper: 'Z-Reports',
    icon: History,
  },
  {
    id: 'activity',
    label: 'Activity Log',
    helper: 'Audit trail',
    icon: Activity,
  },
];

export function ReportsSidebar({ activeTab, onChange }: ReportsSidebarProps) {
  return (
    <aside className="reports-sidebar space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          The Scoreboard
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-900">
          Cashier Reports
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Shift performance, cash checks, and audit trail.
        </p>
      </div>

      <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <ul className="space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => onChange(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col">
                    <span>{tab.label}</span>
                    <span className="text-xs font-normal text-slate-400">
                      {tab.helper}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
