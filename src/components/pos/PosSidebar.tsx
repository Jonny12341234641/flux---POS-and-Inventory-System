'use client';

import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FileText,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  Wallet,
  X,
} from 'lucide-react';

import { cn } from '../../lib/utils';

const navItems = [
  { label: 'Sales', href: '/pos', icon: ShoppingCart },
  { label: 'Order/Debt', href: '/pos/orders', icon: Receipt },
  { label: 'Cash Register', href: '/pos/register', icon: Wallet },
  { label: 'Quotation', href: '/pos/quotes', icon: FileText },
  { label: 'Sales Return', href: '/pos/returns', icon: RotateCcw },
  { label: 'Reports', href: '/pos/reports', icon: BarChart3 },
  { label: 'Settings', href: '/pos/settings', icon: Settings },
];

type PosSidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export default function PosSidebar({
  isOpen = false,
  onClose,
}: PosSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'fixed left-0 top-14 z-50 flex h-[calc(100dvh-3.5rem)] w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-200 shadow-sm transition-transform duration-200 ease-out',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        'md:translate-x-0'
      )}
    >
      <div className="flex items-center justify-between px-4 pt-4 md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-emerald-500">D-POS</span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            CLOUD
          </span>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href !== '#' && pathname === item.href;

            return (
              <li key={item.label}>
                <a
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                    isActive
                      ? 'bg-slate-800/50 text-emerald-400'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5',
                      isActive
                        ? 'text-emerald-500'
                        : 'text-slate-500 group-hover:text-slate-300'
                    )}
                  />
                  <span>{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-slate-800 p-4 text-xs font-medium text-slate-500">
        Shift: Open
      </div>
    </aside>
  );
}