'use client';

import type { CartItem } from '../../../types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

type PaymentSummaryProps = {
  cart: CartItem[];
  total: number;
  customerName?: string | null;
};

export function PaymentSummary({
  cart,
  total,
  customerName,
}: PaymentSummaryProps) {
  const displayName = customerName?.trim() || 'Walking Customer';
  const totalItems = cart.reduce(
    (sum, item) => sum + parseNumber(item.quantity, 0),
    0
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-900">Current Bill</h2>
        <p className="text-sm text-slate-500">{displayName}</p>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <span>Item</span>
          <span>Total</span>
        </div>
        {cart.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            No items in the cart.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {cart.map((item) => {
              const quantity = parseNumber(item.quantity, 0);
              const unitPrice = parseNumber(item.product.price, 0);
              const lineTotal = unitPrice * quantity;

              return (
                <div
                  key={item.product.id}
                  className="flex items-start justify-between gap-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {quantity} {item.product.unit || 'qty'} x{' '}
                      {formatCurrency(unitPrice)}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatCurrency(lineTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Total Items</span>
          <span className="font-semibold text-slate-900">{totalItems}</span>
        </div>
        <div className="mt-3 flex items-end justify-between">
          <span className="text-sm text-slate-600">Total Payable</span>
          <span className="text-2xl font-semibold text-slate-900">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
