'use client';

import { Bell, ChevronDown, Menu, User } from 'lucide-react';

import { cn } from '../../lib/utils';

type PosHeaderProps = {
  onOpenSidebar?: () => void;
  className?: string;
};

export default function PosHeader({ onOpenSidebar, className }: PosHeaderProps) {
  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 shadow-sm md:px-6',
        className
      )}
    >
      <div className="flex items-center gap-3 md:gap-4">
        {onOpenSidebar ? (
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-emerald-500">D-POS</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            CLOUD
          </span>
        </div>
        <span className="hidden text-sm font-medium text-slate-100 md:inline">
          Office Jewellery
        </span>
      </div>
      <div className="flex items-center gap-4 md:gap-6">
        <span className="hidden text-sm font-medium text-slate-100 lg:inline">
          Jan 7, 2024 | Sales - 1
        </span>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500" />
        </button>
        <button
          type="button"
          aria-label="User menu"
          className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950 px-2 py-1 text-sm font-medium text-slate-100 shadow-sm hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-900/30 text-emerald-500">
            <User className="h-4 w-4" />
          </span>
          <span className="hidden sm:inline">K. Perera</span>
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </button>
      </div>
    </header>
  );
}