'use client';

import { AlertCircle, DollarSign } from 'lucide-react';

type ActivityEvent = {
  id: string;
  type: 'sale' | 'cash' | 'alert' | 'shift';
  title: string;
  detail: string;
  time: string;
};

const events: ActivityEvent[] = [
  {
    id: 'event-1',
    type: 'shift',
    title: 'Shift Opened',
    detail: 'Starting cash: $250.00',
    time: '09:02 AM',
  },
  {
    id: 'event-2',
    type: 'sale',
    title: 'Sale #101',
    detail: 'Card payment: $64.20',
    time: '09:18 AM',
  },
  {
    id: 'event-3',
    type: 'cash',
    title: 'Cash Drop',
    detail: 'Safe drop: $200.00',
    time: '11:05 AM',
  },
  {
    id: 'event-4',
    type: 'alert',
    title: 'Drawer Variance',
    detail: 'Alert flagged: -$4.50',
    time: '12:30 PM',
  },
];

const iconMap: Record<ActivityEvent['type'], typeof AlertCircle> = {
  sale: DollarSign,
  cash: DollarSign,
  alert: AlertCircle,
  shift: AlertCircle,
};

const toneMap: Record<ActivityEvent['type'], string> = {
  sale: 'bg-emerald-50 text-emerald-600',
  cash: 'bg-emerald-50 text-emerald-600',
  alert: 'bg-amber-50 text-amber-600',
  shift: 'bg-slate-100 text-slate-500',
};

export function ActivityLog() {
  return (
    <article className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Activity Log
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            Shift Timeline
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Live
        </span>
      </header>

      <div className="relative mt-6">
        <div className="absolute left-3 top-0 h-full w-px bg-slate-200" />
        <ul className="space-y-6">
          {events.map((event) => {
            const Icon = iconMap[event.type];
            return (
              <li key={event.id} className="relative pl-10">
                <div
                  className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full ${toneMap[event.type]}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold uppercase tracking-[0.2em]">
                    {event.type}
                  </span>
                  <span>{event.time}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {event.title}
                </p>
                <p className="text-xs text-slate-500">{event.detail}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}
