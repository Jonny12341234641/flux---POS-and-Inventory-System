'use client';

import { Minus, Plus, Trash2, UserPlus, UserSearch, X } from 'lucide-react';
import { useMemo } from 'react';

import type { CartItem, Customer } from '../../types';

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

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const resolveTaxRate = (value: unknown, fallback: number) => {
  const parsed = parseNumber(value, Number.NaN);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  const fallbackParsed = parseNumber(fallback, 0);
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

type PosCartProps = {
  items: CartItem[];
  onRemove: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onEditItem: (item: CartItem) => void;
  onPay: () => void;
  onHold: () => void;
  taxRate?: number;
  customerQuery: string;
  customerResults: Customer[];
  selectedCustomer: Customer | null;
  isCustomerLoading: boolean;
  onCustomerQueryChange: (value: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  onClearCustomer: () => void;
  onAddCustomer: () => void;
};

export function PosCart({
  items,
  onRemove,
  onUpdateQuantity,
  onEditItem,
  onPay,
  onHold,
  taxRate = 0,
  customerQuery,
  customerResults,
  selectedCustomer,
  isCustomerLoading,
  onCustomerQueryChange,
  onSelectCustomer,
  onClearCustomer,
  onAddCustomer,
}: PosCartProps) {
  const summary = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const quantity = parseNumber(item.quantity, 0);
        const unitPrice = parseNumber(item.product.price, 0);
        const subTotal = unitPrice * quantity;
        const discountPercent = clampNumber(
          parseNumber(item.discount_percent, 0),
          0,
          100
        );
        const discountAmount = Math.min(
          subTotal,
          (subTotal * discountPercent) / 100
        );
        const itemTaxRate = resolveTaxRate(item.product.tax_rate, taxRate);
        const taxableAmount = Math.max(subTotal - discountAmount, 0);
        const taxAmount = itemTaxRate > 0 ? taxableAmount * itemTaxRate : 0;

        acc.subTotal += subTotal;
        acc.tax += taxAmount;
        acc.total += taxableAmount + taxAmount;
        acc.itemCount += quantity;

        return acc;
      },
      { subTotal: 0, tax: 0, total: 0, itemCount: 0 }
    );
  }, [items, taxRate]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 bg-slate-950/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Current Bill</h2>
            <p className="text-xs text-slate-500">
              {summary.itemCount} items
            </p>
          </div>
          <button
            type="button"
            onClick={onClearCustomer}
            className="max-w-[160px] rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200"
            title={selectedCustomer?.name ?? 'Walk-in Customer'}
          >
            <span className="block truncate">
              {selectedCustomer?.name ?? 'Walk-in Customer'}
            </span>
          </button>
        </div>
        <div className="mt-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Customer
          </label>
          <div className="relative">
            <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone or email..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-3 pl-10 pr-12 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              value={customerQuery}
              onChange={(event) => onCustomerQueryChange(event.target.value)}
            />
            <button
              type="button"
              onClick={onAddCustomer}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition hover:text-white"
              aria-label="Add customer"
            >
              <UserPlus className="h-4 w-4" />
            </button>
            {customerQuery.trim().length > 0 && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
                {isCustomerLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    Searching customers...
                  </div>
                ) : customerResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">
                    No customers found.
                  </div>
                ) : (
                  customerResults.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => onSelectCustomer(customer)}
                      className="flex w-full items-center justify-between gap-4 border-b border-slate-800 px-4 py-3 text-left text-sm transition hover:bg-slate-900"
                    >
                      <div>
                        <div className="font-semibold text-slate-100">
                          {customer.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {customer.phone}
                        </div>
                      </div>
                      <div className="text-xs text-emerald-400">
                        {customer.loyalty_points} pts
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {selectedCustomer ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-semibold text-white">
                {getInitials(selectedCustomer.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">
                  {selectedCustomer.name}
                </div>
                <div className="text-xs text-slate-400">
                  {selectedCustomer.phone}
                </div>
              </div>
              <button
                type="button"
                onClick={onClearCustomer}
                className="rounded-full p-1 text-slate-400 transition hover:text-red-400"
                aria-label="Remove customer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center text-sm text-slate-500">
            Add products to begin a sale.
          </div>
        ) : (
          items.map((item) => {
            const quantity = parseNumber(item.quantity, 0);
            const unitPrice = parseNumber(item.product.price, 0);
            const lineTotal = unitPrice * quantity;

            return (
              <div
                key={item.product.id}
                className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-3 transition hover:border-emerald-400/60"
                role="button"
                tabIndex={0}
                onClick={() => onEditItem(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onEditItem(item);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatCurrency(unitPrice)}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {formatCurrency(lineTotal)}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const nextQuantity = quantity - 1;
                        if (nextQuantity <= 0) {
                          onRemove(item.product.id);
                          return;
                        }
                        onUpdateQuantity(item.product.id, nextQuantity);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
                      aria-label={`Decrease ${item.product.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-slate-200">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onUpdateQuantity(item.product.id, quantity + 1);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-200 transition hover:border-emerald-400 hover:text-emerald-300"
                      aria-label={`Increase ${item.product.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-slate-500">
                      {item.product.unit || 'qty'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(item.product.id);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-400 transition hover:border-red-400 hover:text-red-300"
                    aria-label={`Remove ${item.product.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-800 bg-slate-950/80 p-4">
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="text-white">
              {formatCurrency(summary.subTotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span className="text-white">{formatCurrency(summary.tax)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-800 pt-3">
          <span className="text-sm font-semibold text-slate-200">Total</span>
          <span className="text-xl font-bold text-white">
            {formatCurrency(summary.total)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onHold}
            disabled={items.length === 0}
            className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Hold
          </button>
          <button
            type="button"
            onClick={onPay}
            disabled={items.length === 0}
            className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            PAY
          </button>
        </div>
      </div>
    </div>
  );
}
