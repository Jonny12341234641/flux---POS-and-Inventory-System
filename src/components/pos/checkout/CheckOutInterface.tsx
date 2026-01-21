// 'use client';

// import { useEffect, useMemo, useState } from 'react';
// import { createPortal } from 'react-dom';
// import { X } from 'lucide-react';

// import type { CartItem, Customer } from '../../../types';
// import { PaymentRightPanel } from './PaymentRightPanel';
// import type { CheckoutPaymentMethod } from './PaymentRightPanel';
// import { PaymentSummary } from './PaymentSummary';

// type SaleItemPayload = {
//   product_id: string;
//   quantity: number;
//   unit_price: number;
//   discount?: number;
//   tax_amount?: number;
// };

// type BackendPaymentMethod = 'cash' | 'card' | 'bank_transfer';

// type CheckoutModalProps = {
//   isOpen: boolean;
//   cart: CartItem[];
//   total: number;
//   customer: Customer | null;
//   saleItems: SaleItemPayload[];
//   onClose: () => void;
//   onComplete: () => void;
//   onHold: () => void | Promise<void>;
//   onVoid: () => void;
// };

// const roundCurrency = (value: number) => Math.round(value * 100) / 100;

// const mapPaymentMethod = (
//   method: CheckoutPaymentMethod
// ): BackendPaymentMethod => {
//   if (method === 'card') return 'card';
//   if (method === 'cash') return 'cash';
//   return 'bank_transfer';
// };

// export function CheckoutModal({
//   isOpen,
//   cart,
//   total,
//   customer,
//   saleItems,
//   onClose,
//   onComplete,
//   onHold,
//   onVoid,
// }: CheckoutModalProps) {
//   const [mounted, setMounted] = useState(false);
//   const [submitError, setSubmitError] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   useEffect(() => {
//     if (!isOpen) return undefined;
//     document.body.classList.add('overflow-hidden');
//     return () => {
//       document.body.classList.remove('overflow-hidden');
//     };
//   }, [isOpen]);

//   useEffect(() => {
//     if (!isOpen) return;
//     setSubmitError(null);
//     setIsSubmitting(false);
//   }, [isOpen, total]);

//   const totalDue = roundCurrency(total);
//   const taxTotal = useMemo(
//     () => saleItems.reduce((sum, item) => sum + (item.tax_amount ?? 0), 0),
//     [saleItems]
//   );

//   const handleHold = async () => {
//     if (isSubmitting) return;
//     setSubmitError(null);
//     try {
//       await onHold();
//       onClose();
//     } catch (error) {
//       setSubmitError(
//         error instanceof Error ? error.message : 'Draft save failed'
//       );
//     }
//   };

//   const handleVoid = () => {
//     if (isSubmitting) return;
//     onVoid();
//     onClose();
//   };

//   const handleSubmit = async (
//     method: CheckoutPaymentMethod,
//     tenderAmount: string
//   ) => {
//     if (isSubmitting) return;

//     const parsed = Number.parseFloat(tenderAmount);
//     const amountPaid = roundCurrency(Number.isFinite(parsed) ? parsed : 0);

//     if (amountPaid < totalDue) {
//       setSubmitError('Paying amount must cover the total payable.');
//       return;
//     }

//     setIsSubmitting(true);
//     setSubmitError(null);

//     try {
//       if (saleItems.length === 0) {
//         throw new Error('No sale items found.');
//       }

//       const paymentMethod = mapPaymentMethod(method);
//       const payload = {
//         items: saleItems,
//         customer_id: customer?.id ?? null,
//         payment_method: paymentMethod,
//         payments: [{ method: paymentMethod, amount: amountPaid }],
//         amount_paid: amountPaid,
//       };

//       const res = await fetch('/api/sales', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload),
//       });

//       if (!res.ok) {
//         const data = await res.json();
//         throw new Error(data.error || 'Checkout failed');
//       }

//       window.alert('Sale processed successfully!');
//       onComplete();
//     } catch (error) {
//       setSubmitError(
//         error instanceof Error ? error.message : 'Checkout failed'
//       );
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   const handleRequestClose = () => {
//     if (isSubmitting) return;
//     onClose();
//   };

//   if (!mounted || !isOpen) {
//     return null;
//   }

//   return createPortal(
//     <div
//       className="fixed inset-0 z-50 bg-slate-100"
//       role="dialog"
//       aria-modal="true"
//       aria-label="Checkout"
//     >
//       <div className="relative flex h-full w-full flex-col lg:flex-row">
//         <button
//           type="button"
//           onClick={handleRequestClose}
//           className="absolute right-6 top-6 rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
//           aria-label="Close checkout"
//         >
//           <X className="h-4 w-4" />
//         </button>

//         <section className="flex w-full flex-col border-b border-slate-200 bg-slate-50 lg:w-[38%] lg:border-b-0 lg:border-r">
//           <div className="border-b border-slate-200 px-6 py-4">
//             <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
//               Current Bill
//             </p>
//             <p className="text-sm text-slate-500">
//               Review items before checkout
//             </p>
//           </div>
//           <div className="flex-1 p-6">
//             <PaymentSummary
//               cart={cart}
//               total={totalDue}
//               tax={roundCurrency(taxTotal)}
//               customerName={customer?.name ?? null}
//             />
//           </div>
//         </section>

//         <section className="flex w-full flex-1 flex-col bg-white">
//           <div className="flex-1 overflow-y-auto p-6">
//             {submitError ? (
//               <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
//                 {submitError}
//               </div>
//             ) : null}
//             <PaymentRightPanel
//               total={totalDue}
//               onPaymentSubmit={handleSubmit}
//               onHold={handleHold}
//               onVoid={handleVoid}
//               isSubmitting={isSubmitting}
//             />
//           </div>
//         </section>
//       </div>
//     </div>,
//     document.body
//   );
// }


// import React from 'react';
// import { X } from 'lucide-react';
// import { PaymentSummary } from './PaymentSummary';
// import { PaymentControls } from './PaymentRightPanel';

// interface CheckoutModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   cart: any[]; // Replace 'any' with CartItem type
//   subtotal: number;
//   tax: number;
//   discount: number;
//   total: number;
//   customer: any | null;
//   onCheckout: (data: any) => void;
//   onHold: () => void;
//   onVoid: () => void;
// }

// export function CheckoutModal({
//   isOpen,
//   onClose,
//   cart,
//   subtotal,
//   tax,
//   discount,
//   total,
//   customer,
//   onCheckout,
//   onHold,
//   onVoid,
// }: CheckoutModalProps) {
//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
//       {/* Main Container: 
//         Matches the layout in your zip: 
//         - Centered
//         - Max width 6xl (wide)
//         - Fixed height (85% of screen)
//         - Rounded corners
//       */}
//       <div className="relative flex h-[85vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800 animate-in zoom-in-95 duration-200">
        
//         {/* Close Button (Absolute Top Right) */}
//         <button 
//           onClick={onClose}
//           className="absolute right-4 top-4 z-10 rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400"
//         >
//           <X className="h-5 w-5" />
//         </button>

//         {/* Left Side: Bill Summary (approx 35%) */}
//         <div className="w-[35%] hidden md:block h-full">
//           <PaymentSummary 
//             cart={cart}
//             subtotal={subtotal}
//             tax={tax}
//             discount={discount}
//             total={total}
//             customer={customer}
//           />
//         </div>

//         {/* Right Side: Payment Terminal (approx 65%) */}
//         <div className="flex-1 h-full">
//           <PaymentControls 
//             total={total}
//             onComplete={onCheckout}
//             onHold={onHold}
//             onVoid={() => {
//               onVoid();
//               onClose();
//             }}
//           />
//         </div>

//       </div>
//     </div>
//   );
// }


import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import type { CartItem, Customer } from '../../../types';
import { PaymentSummary } from './PaymentSummary';
import { PaymentRightPanel } from './PaymentRightPanel';

type SaleItemPayload = {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_amount?: number;
};

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

type CheckoutCompletionPayload = {
  payment_method?: string;
  amount_paid?: number;
  change_given?: number;
  payments?: Array<{ method?: string; amount?: number }>;
  notes?: string;
};

type BackendPaymentMethod =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'split'
  | 'loyalty';

type BackendPaymentRecordMethod = 'cash' | 'card' | 'bank_transfer';

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapPaymentMethod = (method?: string): BackendPaymentMethod => {
  if (
    method === 'cash' ||
    method === 'card' ||
    method === 'split' ||
    method === 'loyalty'
  ) {
    return method;
  }
  if (method === 'gift_card') {
    return 'loyalty';
  }
  return 'bank_transfer';
};

const mapPaymentRecordMethod = (method?: string): BackendPaymentRecordMethod => {
  if (method === 'cash' || method === 'card') {
    return method;
  }
  return 'bank_transfer';
};

const normalizePayments = (
  payments: Array<{ method?: string; amount?: number }> | undefined
) => {
  if (!payments) return [];
  return payments
    .map((payment) => ({
      method: mapPaymentRecordMethod(payment.method),
      amount: roundCurrency(parseNumber(payment.amount, 0)),
    }))
    .filter((payment) => payment.amount > 0);
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

  const summary = useMemo(
    () =>
      saleItems.reduce(
        (acc, item) => {
          const quantity = parseNumber(item.quantity, 0);
          const unitPrice = parseNumber(item.unit_price, 0);
          acc.subtotal += unitPrice * quantity;
          acc.discount += parseNumber(item.discount, 0);
          acc.tax += parseNumber(item.tax_amount, 0);
          return acc;
        },
        { subtotal: 0, discount: 0, tax: 0 }
      ),
    [saleItems]
  );

  const totalDue = roundCurrency(total);

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

  const handleRequestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleComplete = async (paymentData: CheckoutCompletionPayload) => {
    if (isSubmitting) return;

    const normalizedPayments = normalizePayments(paymentData.payments);
    const parsedPaid = parseNumber(paymentData.amount_paid, Number.NaN);
    const amountPaidRaw = Number.isFinite(parsedPaid)
      ? parsedPaid
      : normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const amountPaid = roundCurrency(amountPaidRaw);

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

      const paymentMethod = mapPaymentMethod(paymentData.payment_method);
      const payments =
        normalizedPayments.length > 0
          ? normalizedPayments
          : [
              {
                method: mapPaymentRecordMethod(paymentData.payment_method),
                amount: amountPaid,
              },
            ];
      const parsedChange = parseNumber(paymentData.change_given, Number.NaN);
      const changeGiven = roundCurrency(
        Number.isFinite(parsedChange)
          ? parsedChange
          : Math.max(amountPaid - totalDue, 0)
      );
      const notes =
        typeof paymentData.notes === 'string'
          ? paymentData.notes.trim()
          : '';

      const payload = {
        items: saleItems,
        customer_id: customer?.id ?? null,
        payment_method: paymentMethod,
        payments,
        amount_paid: amountPaid,
        change_given: changeGiven,
        notes: notes || undefined,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let message = 'Checkout failed';
        try {
          const data = await res.json();
          message = data.error || message;
        } catch (error) {
          if (error instanceof Error && error.message) {
            message = error.message;
          }
        }
        throw new Error(message);
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

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900 dark"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div className="relative flex h-full w-full flex-col lg:flex-row">
        <button
          type="button"
          onClick={handleRequestClose}
          className="absolute right-6 top-6 rounded-full border border-slate-700 bg-slate-800 p-2 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          aria-label="Close checkout"
        >
          <X className="h-4 w-4" />
        </button>

        <section className="flex w-full flex-col border-b border-slate-800 bg-slate-950 lg:w-[38%] lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-800 px-6 py-4">
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
              subtotal={roundCurrency(summary.subtotal)}
              tax={roundCurrency(summary.tax)}
              discount={roundCurrency(summary.discount)}
              total={totalDue}
              customer={customer}
            />
          </div>
        </section>

        <section className="flex w-full flex-1 flex-col bg-slate-900">
          <div className="flex-1 overflow-y-auto p-6">
            {submitError ? (
              <div className="mb-4 rounded-xl border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
                {submitError}
              </div>
            ) : null}
            <PaymentRightPanel
              total={totalDue}
              onComplete={handleComplete}
              onHold={handleHold}
              onVoid={handleVoid}
              onBack={handleRequestClose}
            />
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}

interface CheckoutInterfaceProps {
  cart: any[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customer: any | null;
  onCheckout: (data: any) => void;
  onHold: () => void;
  onVoid: () => void;
  onBack: () => void;
}

export function CheckoutInterface(props: CheckoutInterfaceProps) {
  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen overflow-hidden bg-slate-900 animate-in slide-in-from-bottom-10 duration-300 dark">
      {/* Left Panel: Summary (35%) */}
      <div className="h-full border-r border-slate-800 bg-slate-950 shadow-xl z-20 hidden lg:block">
        <PaymentSummary 
          cart={props.cart}
          subtotal={props.subtotal}
          tax={props.tax}
          discount={props.discount}
          total={props.total}
          customer={props.customer}
        />
      </div>

      {/* Right Panel: Controls (65%) */}
      <div className="flex-1 h-full bg-slate-900">
        <PaymentRightPanel 
          total={props.total}
          onComplete={props.onCheckout}
          onHold={props.onHold}
          onVoid={props.onVoid}
          onBack={props.onBack}
        />
      </div>
    </div>
  );
}
