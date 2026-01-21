'use client';

import type { SalePayment, SaleWithDetails, ShiftSession } from '../../../types';

type XReportPreviewProps = {
  sales: SaleWithDetails[];
  shift: ShiftSession | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDateTime = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toCents = (value: unknown) => Math.round(parseNumber(value, 0) * 100);

const formatCents = (value: number) => formatCurrency(value / 100);

const resolvePaymentTotals = (sales: SaleWithDetails[]) => {
  let cash = 0;
  let card = 0;
  let storeCredit = 0;

  sales.forEach((sale) => {
    const status = sale.status;
    if (status !== 'completed' && status !== 'refunded') return;

    const direction = status === 'refunded' ? -1 : 1;
    const total = toCents(sale.grand_total);
    const payments = Array.isArray(sale.payments)
      ? (sale.payments as SalePayment[])
      : Array.isArray((sale as { sale_payments?: unknown }).sale_payments)
        ? ((sale as { sale_payments?: unknown }).sale_payments as SalePayment[])
        : [];

    if (payments.length > 0) {
      payments.forEach((payment) => {
        const amount = toCents(payment.amount) * direction;
        if (payment.method === 'cash') {
          cash += amount;
        } else {
          card += amount;
        }
      });
      return;
    }

    if (sale.payment_method === 'cash') {
      cash += total * direction;
    } else if (
      sale.payment_method === 'card' ||
      sale.payment_method === 'bank_transfer'
    ) {
      card += total * direction;
    } else if (sale.payment_method === 'loyalty') {
      storeCredit += total * direction;
    } else if (sale.payment_method === 'split') {
      const half = Math.round(total / 2);
      cash += half * direction;
      card += (total - half) * direction;
    }
  });

  return { cash, card, storeCredit };
};

const resolveTopMovers = (sales: SaleWithDetails[]) => {
  const totals = new Map<string, number>();

  sales.forEach((sale) => {
    if (sale.status !== 'completed') return;

    const rawItems =
      Array.isArray((sale as { sale_items?: unknown }).sale_items)
        ? ((sale as { sale_items?: unknown }).sale_items as Array<
            Record<string, unknown>
          >)
        : Array.isArray((sale as { items?: unknown }).items)
          ? ((sale as { items?: unknown }).items as Array<
              Record<string, unknown>
            >)
          : [];

    rawItems.forEach((item) => {
      const quantity = parseNumber(item.quantity, 0);
      if (quantity <= 0) return;

      const product =
        item.product && typeof item.product === 'object'
          ? (item.product as Record<string, unknown>)
          : null;
      const name =
        typeof item.product_name === 'string' && item.product_name.trim()
          ? item.product_name
          : typeof product?.name === 'string' && product.name.trim()
            ? product.name
            : 'Item';

      totals.set(name, (totals.get(name) ?? 0) + quantity);
    });
  });

  return Array.from(totals.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
};

export function XReportPreview({ sales, shift }: XReportPreviewProps) {
  const grossSales = sales.reduce((sum, sale) => {
    if (sale.status !== 'completed') return sum;
    return sum + toCents(sale.grand_total);
  }, 0);

  const returnsTotal = sales.reduce((sum, sale) => {
    if (sale.status !== 'refunded') return sum;
    return sum + toCents(sale.grand_total);
  }, 0);

  const netSales = grossSales - returnsTotal;

  const taxCollected =
    sales.reduce((sum, sale) => {
      if (sale.status !== 'completed') return sum;
      return sum + toCents(sale.tax_total);
    }, 0) -
    sales.reduce((sum, sale) => {
      if (sale.status !== 'refunded') return sum;
      return sum + toCents(sale.tax_total);
    }, 0);

  const paymentTotals = resolvePaymentTotals(sales);
  const topMovers = resolveTopMovers(sales);
  const transactionCount = sales.filter(
    (sale) => sale.status === 'completed'
  ).length;

  const reportTitle =
    shift?.status === 'closed' ? 'Z-REPORT (Closed)' : 'X-REPORT (Interim)';
  const reportTime = formatDateTime(new Date().toISOString());
  const shiftStart = shift?.start_time
    ? formatDateTime(shift.start_time)
    : 'Unknown';
  const shiftEnd = shift
    ? shift.end_time
      ? formatDateTime(shift.end_time)
      : 'Active'
    : 'Unknown';

  return (
    <article className="print-area w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-lg">
      <header className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500">
          {reportTitle}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">
          Cashier Scoreboard
        </h2>
        <p className="mt-1 text-xs text-slate-400">{reportTime}</p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-800 px-3 py-2 text-[11px] text-slate-400">
          <div className="flex items-center justify-between">
            <span>Shift Start</span>
            <span className="font-semibold text-slate-300">{shiftStart}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Shift End</span>
            <span className="font-semibold text-slate-300">{shiftEnd}</span>
          </div>
        </div>
      </header>

      <section className="mt-6 border-t border-dashed border-slate-800 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Sales Summary
        </p>
        <div className="mt-3 space-y-2 text-sm text-slate-400">
          <div className="flex items-center justify-between">
            <span>Transactions</span>
            <span className="font-semibold text-slate-100">
              {transactionCount}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Gross Sales</span>
            <span className="font-semibold text-slate-100">
              {formatCents(grossSales)}
            </span>
          </div>
          <div className="flex items-center justify-between text-red-400">
            <span>Returns</span>
            <span className="font-semibold">
              -{formatCents(returnsTotal)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-dashed border-slate-800 pt-2 text-base font-semibold text-slate-100">
            <span>Net Sales</span>
            <span>{formatCents(netSales)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>Tax Collected</span>
            <span className="font-semibold text-slate-100">
              {formatCents(taxCollected)}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6 border-t border-dashed border-slate-800 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Payment Breakdown
        </p>
        <div className="mt-3 space-y-2 text-sm text-slate-400">
          <div className="flex items-center justify-between">
            <span>Cash</span>
            <span className="font-semibold text-slate-100">
              {formatCents(paymentTotals.cash)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Card</span>
            <span className="font-semibold text-slate-100">
              {formatCents(paymentTotals.card)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Store Credit</span>
            <span className="font-semibold text-slate-100">
              {formatCents(paymentTotals.storeCredit)}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6 border-t border-dashed border-slate-800 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Top Movers
        </p>
        {topMovers.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950 px-3 py-4 text-center text-xs text-slate-400">
            No item data available yet.
          </div>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {topMovers.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between"
              >
                <span className="truncate text-slate-300">{item.name}</span>
                <span className="font-semibold text-slate-100">
                  {item.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!shift ? (
        <div className="mt-6 rounded-lg border border-amber-900/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-400">
          No active shift loaded yet.
        </div>
      ) : null}
    </article>
  );
}
