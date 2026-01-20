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
  cartItems: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerName?: string | null;
};

export function PaymentSummary({
  cartItems,
  subtotal,
  tax,
  discount,
  total,
  customerName,
}: PaymentSummaryProps) {
  const billTo = customerName?.trim() || 'Walk-in Customer';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Total Due
        </p>
        <p className="mt-4 text-4xl font-bold text-white">
          {formatCurrency(total)}
        </p>
        <p className="mt-4 text-sm text-slate-300">
          Bill to: <span className="font-semibold text-white">{billTo}</span>
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto py-6">
        {cartItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center text-sm text-slate-500">
            No items in the cart.
          </div>
        ) : (
          cartItems.map((item) => {
            const quantity = parseNumber(item.quantity, 0);
            const unitPrice = parseNumber(item.product.price, 0);
            const lineTotal = unitPrice * quantity;

            return (
              <div
                key={item.product.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {quantity} {item.product.unit || 'qty'} x{' '}
                      {formatCurrency(unitPrice)}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {formatCurrency(lineTotal)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-800 pt-4 text-sm text-slate-300">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="text-white">{formatCurrency(subtotal)}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span>Discount</span>
          <span className="text-white">-{formatCurrency(discount)}</span>
        </div>
        <div className="mt-2 flex justify-between">
          <span>Tax</span>
          <span className="text-white">{formatCurrency(tax)}</span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-dashed border-slate-800 pt-4">
          <span className="text-sm font-semibold text-slate-200">Total</span>
          <span className="text-xl font-bold text-white">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
