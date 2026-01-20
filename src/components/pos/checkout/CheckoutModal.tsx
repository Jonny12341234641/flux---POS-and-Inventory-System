'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import type { CartItem, Customer } from '../../../types';
import { PaymentRightPanel } from './PaymentRightPanel';
import type { CheckoutPaymentMethod } from './PaymentRightPanel';
import { PaymentSummary } from './PaymentSummary';

type SaleItemPayload = {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_amount?: number;
};

type BackendPaymentMethod = 'cash' | 'card' | 'bank_transfer';

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

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const mapPaymentMethod = (
  method: CheckoutPaymentMethod
): BackendPaymentMethod => {
  if (method === 'card') return 'card';
  if (method === 'cash') return 'cash';
  return 'bank_transfer';
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
    setSubmitError(null);
    setIsSubmitting(false);
  }, [isOpen, total]);

  const totalDue = roundCurrency(total);
  const taxTotal = useMemo(
    () => saleItems.reduce((sum, item) => sum + (item.tax_amount ?? 0), 0),
    [saleItems]
  );

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

  const handleSubmit = async (
    method: CheckoutPaymentMethod,
    tenderAmount: string
  ) => {
    if (isSubmitting) return;

    const parsed = Number.parseFloat(tenderAmount);
    const amountPaid = roundCurrency(Number.isFinite(parsed) ? parsed : 0);

    if (amountPaid < totalDue) {
      setSubmitError('Paying amount must cover the total payable.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (saleItems.length === 0) {
        throw new Error('No sale items found.');
      }

      const paymentMethod = mapPaymentMethod(method);
      const payload = {
        items: saleItems,
        customer_id: customer?.id ?? null,
        payment_method: paymentMethod,
        payments: [{ method: paymentMethod, amount: amountPaid }],
        amount_paid: amountPaid,
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
      className="fixed inset-0 z-50 bg-slate-100"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div className="relative flex h-full w-full flex-col lg:flex-row">
        <button
          type="button"
          onClick={handleRequestClose}
          className="absolute right-6 top-6 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          aria-label="Close checkout"
        >
          <X className="h-4 w-4" />
        </button>

        <section className="flex w-full flex-col border-b border-slate-200 bg-slate-50 lg:w-[38%] lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Current Bill
            </p>
            <p className="text-sm text-slate-500">
              Review items before checkout
            </p>
          </div>
          <div className="flex-1 p-6">
            <PaymentSummary
              cart={cart}
              total={totalDue}
              tax={roundCurrency(taxTotal)}
              customerName={customer?.name ?? null}
            />
          </div>
        </section>

        <section className="flex w-full flex-1 flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-6">
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {submitError}
              </div>
            ) : null}
            <PaymentRightPanel
              total={totalDue}
              onPaymentSubmit={handleSubmit}
              onHold={handleHold}
              onVoid={handleVoid}
              isSubmitting={isSubmitting}
            />
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
