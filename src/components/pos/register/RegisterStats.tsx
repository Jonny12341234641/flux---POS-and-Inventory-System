'use client';

import {
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

type RegisterStatsProps = {
  startCash: number;
  salesTotal: number;
  dropsTotal: number;
};

type StatCardProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  iconClassName: string;
  helper?: string;
  valueClassName?: string;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const StatCard = ({
  label,
  value,
  icon: Icon,
  iconClassName,
  helper,
  valueClassName,
}: StatCardProps) => {
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p
            className={`mt-2 text-2xl font-semibold text-slate-900 ${
              valueClassName ?? ''
            }`}
          >
            {formatCurrency(safeValue)}
          </p>
          {helper ? (
            <p className="mt-1 text-xs text-slate-500">{helper}</p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <Icon className={`h-5 w-5 ${iconClassName}`} />
        </div>
      </div>
    </div>
  );
};

export function RegisterStats({
  startCash,
  salesTotal,
  dropsTotal,
}: RegisterStatsProps) {
  const safeStartCash = Number.isFinite(startCash) ? startCash : 0;
  const safeSalesTotal = Number.isFinite(salesTotal) ? salesTotal : 0;
  const safeDropsTotal = Number.isFinite(dropsTotal) ? dropsTotal : 0;
  const theoreticalBalance =
    safeStartCash + safeSalesTotal - safeDropsTotal;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Starting Cash"
        value={safeStartCash}
        icon={Wallet}
        iconClassName="text-slate-500"
      />
      <StatCard
        label="Cash Sales"
        value={safeSalesTotal}
        icon={ArrowUpCircle}
        iconClassName="text-emerald-500"
      />
      <StatCard
        label="Cash Drops"
        value={safeDropsTotal}
        icon={ArrowDownCircle}
        iconClassName="text-red-500"
      />
      <StatCard
        label="Theoretical Balance"
        value={theoreticalBalance}
        icon={History}
        iconClassName="text-slate-500"
        helper="Start + Sales - Drops"
        valueClassName="text-3xl leading-tight"
      />
    </div>
  );
}
