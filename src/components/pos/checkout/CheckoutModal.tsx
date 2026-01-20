'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import type { CartItem, Customer } from '../../../types';
import type { PaymentMethod, PaymentRecord } from '../../../types/payment';
import { PaymentControls } from './PaymentControls';
import { PaymentSummary } from './PaymentSummary';

type SaleItemPayload = {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_amount?: number;
};

type BackendPaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'split';

type CheckoutModalProps = {
  isOpen: boolean;
  cartItems: CartItem[];
  saleItems: SaleItemPayload[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customer: Customer | null;
  onClose: () => void;
  onComplete: () => void;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const normalizeBuffer = (value: string) => {
  if (!value) return '0';
  if (value === '.') return '0.';
  if (value.startsWith('.')) return `0${value}`;
  if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
    const trimmed = value.replace(/^0+/, '');
    return trimmed.length > 0 ? trimmed : '0';
  }
  return value;
};

const formatInputValue = (value: number) => {
  if (!Number.isFinite(value)) return '0';
  const rounded = roundCurrency(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const mapPrimaryMethod = (method: PaymentMethod): BackendPaymentMethod => {
  if (method === 'other') return 'bank_transfer';
  if (method === 'split') return 'split';
  return method;
};

const mapPaymentMethod = (
  method: PaymentMethod
): Exclude<BackendPaymentMethod, 'split'> => {
  if (method === 'other') return 'bank_transfer';
  if (method === 'split') return 'cash';
  return method;
};

export function CheckoutModal({
  isOpen,
  cartItems,
  saleItems,
  subtotal,
  tax,
  discount,
  total,
  customer,
  onClose,
  onComplete,
}: CheckoutModalProps) {
  const [mounted, setMounted] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tenderInput, setTenderInput] = useState('0');
  const [selectedMethod, setSelectedMethod] =
    useState<PaymentMethod>('cash');
  const [isFreshInput, setIsFreshInput] = useState(true);
  const [inputError, setInputError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPayments([]);
    setTenderInput('0');
    setSelectedMethod('cash');
    setIsFreshInput(true);
    setInputError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [isOpen, total]);

  const totalPaid = useMemo(() => {
    const sum = payments.reduce((acc, payment) => acc + payment.amount, 0);
    return roundCurrency(sum);
  }, [payments]);

  const totalDue = roundCurrency(total);
  const remainingDue = Math.max(roundCurrency(totalDue - totalPaid), 0);
  const changeDue = Math.max(roundCurrency(totalPaid - totalDue), 0);
  const isComplete = payments.length > 0 && totalPaid >= totalDue;

  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setInputError(null);
  };

  const handleInput = (value: string) => {
    setInputError(null);

    if (value === 'backspace') {
      setTenderInput((prev) => {
        const next = prev.length <= 1 ? '0' : prev.slice(0, -1);
        return normalizeBuffer(next);
      });
      setIsFreshInput(false);
      return;
    }

    if (value === '.') {
      setTenderInput((prev) => {
        if (prev.includes('.')) return prev;
        return normalizeBuffer(`${prev}.`);
      });
      setIsFreshInput(false);
      return;
    }

    if (!/^\d$/.test(value)) return;

    setTenderInput((prev) => {
      const shouldReplace = isFreshInput || prev === '0';
      const nextRaw = shouldReplace ? value : `${prev}${value}`;
      if (nextRaw.includes('.')) {
        const decimals = nextRaw.split('.')[1] ?? '';
        if (decimals.length > 2) {
          return prev;
        }
      }
      return normalizeBuffer(nextRaw);
    });
    setIsFreshInput(false);
  };

  const handleClearTender = () => {
    setTenderInput('0');
    setIsFreshInput(true);
    setInputError(null);
  };

  const handleQuickTender = (value: number | 'exact') => {
    const nextValue = value === 'exact' ? remainingDue : value;
    setTenderInput(formatInputValue(nextValue));
    setIsFreshInput(true);
    setInputError(null);
  };

  const handleAddPayment = () => {
    if (isSubmitting) return;

    const parsed = Number.parseFloat(tenderInput);
    const tenderAmount = roundCurrency(
      Number.isFinite(parsed) ? parsed : 0
    );

    if (tenderAmount <= 0) {
      setInputError('Enter a tendered amount.');
      return;
    }

    if (selectedMethod !== 'cash' && tenderAmount > remainingDue) {
      setInputError('Non-cash payments cannot exceed the remaining due.');
      return;
    }

    setPayments((prev) => [
      ...prev,
      { method: selectedMethod, amount: tenderAmount },
    ]);
    setTenderInput('0');
    setIsFreshInput(true);
    setInputError(null);
  };

  const handleCompleteSale = async () => {
    if (!isComplete || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (saleItems.length === 0) {
        throw new Error('No sale items found.');
      }

      const primaryMethod =
        payments.length > 1
          ? 'split'
          : mapPrimaryMethod(payments[0]?.method ?? 'cash');

      const payload = {
        items: saleItems,
        customer_id: customer?.id ?? null,
        payment_method: primaryMethod,
        payments: payments.map((payment) => ({
          amount: payment.amount,
          method: mapPaymentMethod(payment.method),
        })),
        amount_paid: totalPaid,
        change_given: changeDue,
        discount_total: discount,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Checkout failed');
      }

      window.alert('Sale processed successfully!');
      onComplete();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Checkout failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleRequestClose}
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-slate-900 shadow-2xl ring-1 ring-slate-800/60 max-h-[90vh] lg:h-[720px] lg:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleRequestClose}
          className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
          aria-label="Close checkout modal"
        >
          <X className="h-4 w-4" />
        </button>

        <section className="flex w-full flex-col border-b border-slate-800 bg-slate-950 lg:w-1/2 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-800 px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Payment Summary
            </p>
            <p className="text-sm text-slate-300">
              Review items before completing payment
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-8">
            <PaymentSummary
              cartItems={cartItems}
              subtotal={subtotal}
              tax={tax}
              discount={discount}
              total={totalDue}
              customerName={customer?.name ?? null}
            />
          </div>
        </section>

        <section className="flex w-full flex-col bg-slate-900/40 lg:w-1/2">
          <div className="flex-1 overflow-y-auto p-8">
            <PaymentControls
              selectedMethod={selectedMethod}
              tenderInput={tenderInput}
              payments={payments}
              totalPaid={totalPaid}
              remainingDue={remainingDue}
              changeDue={changeDue}
              onSelectMethod={handleSelectMethod}
              onInput={handleInput}
              onConfirmPayment={handleAddPayment}
              onClearInput={handleClearTender}
              onQuickTender={handleQuickTender}
              errorMessage={inputError}
            />
          </div>
          <div className="border-t border-slate-800 bg-slate-950/60 p-6">
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {submitError}
              </div>
            ) : null}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Total Paid
                </p>
                <p className="text-lg font-semibold text-white">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={!isComplete || isSubmitting}
                className={`h-12 rounded-xl px-6 text-sm font-semibold transition ${
                  isComplete
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-400'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                {isSubmitting ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
            {changeDue > 0 ? (
              <div className="mt-4 text-sm text-emerald-200">
                Change due: {formatCurrency(changeDue)}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
