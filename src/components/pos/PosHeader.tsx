'use client';

import { ChevronDown, Menu, User } from 'lucide-react';
import { useState, useEffect } from 'react';

import { cn } from '../../lib/utils';

type PosHeaderProps = {
  onOpenSidebar?: () => void;
  className?: string;
};

export default function PosHeader({ onOpenSidebar, className }: PosHeaderProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header
      className={cn(
        'flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 shadow-sm md:px-6 relative',
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
        
        {/* Logo Replacement */}
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20">
            <span className="text-sm font-bold text-white">F</span>
          </div>
          <div className="flex flex-col">
            <span className="whitespace-nowrap text-sm font-bold tracking-wide text-white">
              FLUX POS
            </span>
            <span className="whitespace-nowrap text-[10px] uppercase tracking-wider text-slate-500">
              Management
            </span>
          </div>
        </div>
      </div>

      {/* Real-Time Clock (Top Center) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
        <span className="text-xl font-mono font-medium text-slate-200">
          {currentTime ? currentTime.toLocaleTimeString([], { hour12: false }) : ''}
        </span>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        {/* Real-Time Date */}
        <span className="hidden text-sm font-medium text-slate-100 lg:inline">
          {currentTime ? currentTime.toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }) : ''}
        </span>
        
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
