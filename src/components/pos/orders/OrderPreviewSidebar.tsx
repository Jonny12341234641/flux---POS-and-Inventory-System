'use client';

import { CreditCard, Receipt, User, Wallet } from 'lucide-react';

export type OrderPreviewItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type OrderPreviewPayment = {
  id: string;
  method: 'cash' | 'card' | 'bank_transfer' | 'split' | 'loyalty';
  amount: number;
  referenceId?: string | null;
};

export type OrderPreviewData = {
  id: string;
  receiptNumber?: string;
  createdAt?: string;
  customerName?: string | null;
  cashierName?: string | null;
  status?: string;
  items: OrderPreviewItem[];
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod?: OrderPreviewPayment['method'];
  amountPaid?: number;
  payments: OrderPreviewPayment[];
};

type OrderPreviewSidebarProps = {
  order: OrderPreviewData | null;
  isLoading?: boolean;
  error?: string | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDateTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const paymentLabels: Record<OrderPreviewPayment['method'], string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  split: 'Split',
  loyalty: 'Loyalty',
};

const getPaymentIcon = (method: OrderPreviewPayment['method']) => {
  if (method === 'card') return CreditCard;
  if (method === 'split' || method === 'loyalty') return Receipt;
  return Wallet;
};

export function OrderPreviewSidebar({
  order,
  isLoading = false,
  error,
}: OrderPreviewSidebarProps) {
  const items = order?.items ?? [];
  const payments = order?.payments ?? [];
  const hasPayments = payments.length > 0;
  const statusLabel =
    order?.status && typeof order.status === 'string'
      ? `${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}`
      : '';

  return (
    <aside className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-100">
            Order Preview
          </h2>
        </div>
        {statusLabel ? (
          <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!order ? (
          isLoading ? (
            <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-400">
              Loading order details...
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-400">
              <Receipt className="h-8 w-8 text-slate-600" />
              <p>Select an order to view details.</p>
            </div>
          )
        ) : (
          <div className="space-y-6">
            {isLoading ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-400">
                Loading latest details...
              </div>
            ) : null}
            {error ? (
              <div className="rounded-lg border border-amber-900/50 bg-amber-900/20 px-3 py-2 text-xs text-amber-400">
                {error}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Receipt
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-100">
                {order.receiptNumber ?? order.id}
              </div>
              {order.createdAt ? (
                <div className="text-xs text-slate-400">
                  {formatDateTime(order.createdAt)}
                </div>
              ) : null}
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-100">
                  {order.customerName ?? 'Walk-in'}
                </span>
              </div>
              {order.cashierName ? (
                <div className="mt-1 text-xs text-slate-500">
                  Cashier: {order.cashierName}
                </div>
              ) : null}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Line Items
              </h3>
              {items.length === 0 ? (
                <div className="mt-2 rounded-lg border border-dashed border-slate-800 bg-slate-900 px-4 py-6 text-center text-xs text-slate-400">
                  No line items available.
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-100">
                        {formatCurrency(item.total)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-100">
                  {formatCurrency(order.subTotal)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Tax</span>
                <span className="font-semibold text-slate-100">
                  {formatCurrency(order.taxTotal)}
                </span>
              </div>
              {order.discountTotal > 0 ? (
                <div className="mt-2 flex items-center justify-between text-red-400">
                  <span>Discount</span>
                  <span className="font-semibold">
                    -{formatCurrency(order.discountTotal)}
                  </span>
                </div>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-800 pt-3 text-base font-semibold text-slate-100">
                <span>Total</span>
                <span>{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Payments
              </div>
              {hasPayments ? (
                <div className="mt-3 space-y-2">
                  {payments.map((payment) => {
                    const Icon = getPaymentIcon(payment.method);
                    return (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Icon className="h-3.5 w-3.5 text-slate-400" />
                          <span>{paymentLabels[payment.method]}</span>
                          {payment.referenceId ? (
                            <span className="text-xs text-slate-500">
                              {payment.referenceId}
                            </span>
                          ) : null}
                        </div>
                        <span className="font-semibold text-slate-100">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Method</span>
                    <span className="font-semibold text-slate-100">
                      {order.paymentMethod
                        ? paymentLabels[order.paymentMethod]
                        : 'Unknown'}
                    </span>
                  </div>
                  {typeof order.amountPaid === 'number' ? (
                    <div className="flex items-center justify-between">
                      <span>Amount Paid</span>
                      <span className="font-semibold text-slate-100">
                        {formatCurrency(order.amountPaid)}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}