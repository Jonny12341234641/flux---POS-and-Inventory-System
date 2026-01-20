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
  cart: CartItem[];
  total: number;
  customer: Customer | null;
  saleItems: SaleItemPayload[];
  onClose: () => void;
  onComplete: () => void;
  onHold: () => void | Promise<void>;
  onVoid: () => void;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const mapPaymentMethod = (
  method: PaymentMethod
): Exclude<BackendPaymentMethod, 'split'> => {
  if (method === 'card') return 'card';
  if (method === 'transfer' || method === 'cheque') return 'bank_transfer';
  return 'cash';
};

export function CheckoutModal({
  isOpen,
  cart,
  total,
  customer,
  saleItems,
  onClose,
  onComplete,
  onHold,
  onVoid,
}: CheckoutModalProps) {
  const [mounted, setMounted] = useState(false);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tenderAmount, setTenderAmount] = useState('0');
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
    setTenderAmount('0');
    setInputError(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, [isOpen, total]);


  const totalPaid = useMemo(() => {
    const sum = payments.reduce((acc, payment) => acc + payment.amount, 0);
    return roundCurrency(sum);
  }, [payments]);

  const totalDue = roundCurrency(total);
  const remaining = Math.max(roundCurrency(totalDue - totalPaid), 0);
  const changeDue = Math.max(roundCurrency(totalPaid - totalDue), 0);
  const isSubmitDisabled = payments.length === 0 || totalPaid < totalDue;

  const handleAddPayment = (method: PaymentMethod) => {
    if (isSubmitting) return;

    const parsed = Number.parseFloat(tenderAmount);
    const amount = roundCurrency(Number.isFinite(parsed) ? parsed : 0);

    if (amount <= 0) {
      setInputError('Enter a valid paying amount.');
      return;
    }

    if (remaining <= 0) {
      setInputError('Payment is already complete.');
      return;
    }

    const isNonCash =
      method === 'card' || method === 'transfer' || method === 'cheque';
    if (isNonCash && amount > remaining) {
      setInputError('Non-cash payments cannot exceed the remaining balance.');
      return;
    }

    setPayments((prev) => [...prev, { method, amount }]);
    setTenderAmount('0');
    setInputError(null);
    setSubmitError(null);
  };

  const clearInputError = () => {
    setInputError(null);
  };

  const handleHold = async () => {
    if (isSubmitting) return;
    setSubmitError(null);
    try {
      await onHold();
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Draft save failed'
      );
    }
  };

  const handleVoid = () => {
    if (isSubmitting) return;
    onVoid();
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitDisabled || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (saleItems.length === 0) {
        throw new Error('No sale items found.');
      }

      const paymentMethod: BackendPaymentMethod =
        payments.length > 1
          ? 'split'
          : mapPaymentMethod(payments[0]?.method ?? 'cash');

      const payload = {
        items: saleItems,
        customer_id: customer?.id ?? null,
        payment_method: paymentMethod,
        payments: payments.map((payment) => ({
          amount: payment.amount,
          method: mapPaymentMethod(payment.method),
        })),
        amount_paid: totalPaid,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={handleRequestClose}
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div
        className="relative flex h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl lg:flex-row"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleRequestClose}
          className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          aria-label="Close checkout modal"
        >
          <X className="h-4 w-4" />
        </button>

        <section className="flex w-full flex-col border-b border-slate-200 bg-white lg:w-2/5 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Bill Summary
            </p>
            <p className="text-sm text-slate-500">
              Review items before checkout
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <PaymentSummary
              cart={cart}
              total={totalDue}
              customerName={customer?.name ?? null}
            />
          </div>
        </section>

        <section className="flex w-full flex-col bg-slate-50 lg:w-3/5">
          <div className="border-b border-slate-200 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Payment Terminal
                </h3>
                <p className="text-sm text-slate-500">
                  Accept split payments and finalize the sale
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Remaining
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(remaining)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {submitError}
              </div>
            ) : null}
            <PaymentControls
              total={totalDue}
              remaining={remaining}
              tenderAmount={tenderAmount}
              setTenderAmount={setTenderAmount}
              onAddPayment={handleAddPayment}
              onComplete={handleSubmit}
              onHold={handleHold}
              onVoid={handleVoid}
              isSubmitDisabled={isSubmitDisabled}
              errorMessage={inputError}
              isSubmitting={isSubmitting}
              onClearError={clearInputError}
            />
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>Total Paid</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(totalPaid)}
              </span>
            </div>
            {changeDue > 0 ? (
              <div className="mt-2 flex items-center justify-between text-emerald-600">
                <span>Change Due</span>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(changeDue)}
                </span>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
