import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import type { CartItem, Customer } from '../../../types';
import { PaymentSummary, DiscountState } from './PaymentSummary';
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

const roundCurrency = (value: number) => Math.round((value || 0) * 100) / 100;

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
  total: initialTotal,
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

  // Discount States
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, DiscountState>>({});
  const [billDiscount, setBillDiscount] = useState<DiscountState | null>(null);

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
    // Reset discounts on open? Maybe preserve if user closes and re-opens?
    // For now, let's keep them. If `cart` changes, we might want to validate keys.
  }, [isOpen, initialTotal]);

  // Recalculate Totals based on local discounts
  const { totalDue, subtotal, taxTotal, discountTotal, processedItems } = useMemo(() => {
    let calcSubtotal = 0;
    let calcTax = 0;
    let calcDiscount = 0;
    const hasLineDiscounts = Object.keys(lineDiscounts).length > 0;

    const items = saleItems.map((item) => {
      const quantity = parseNumber(item.quantity, 0);
      const unitPrice = parseNumber(item.unit_price, 0);
      const originalTax = parseNumber(item.tax_amount, 0);
      const originalItemTotal = unitPrice * quantity;
      
      // Calculate implied tax rate (safe math)
      // If originalItemTotal is 0, taxRate is 0.
      const taxRate = originalItemTotal > 0 ? originalTax / originalItemTotal : 0;

      let itemDiscount = 0;

      // Apply Line Discount
      if (hasLineDiscounts) {
        const discountConfig = lineDiscounts[item.product_id];
        if (discountConfig) {
           if (discountConfig.type === 'percent') {
             itemDiscount = originalItemTotal * (discountConfig.value / 100);
           } else {
             itemDiscount = discountConfig.value; // Fixed amount per line? Or per unit? Assuming per line total.
           }
        }
      }

      // Safe check
      if (itemDiscount > originalItemTotal) itemDiscount = originalItemTotal;
      if (itemDiscount < 0) itemDiscount = 0;

      const taxableAmount = Math.max(0, originalItemTotal - itemDiscount);
      const itemTax = taxableAmount * taxRate;

      calcSubtotal += originalItemTotal; // Subtotal usually reflects gross price before discount? Or after? 
      // Usually: Subtotal = sum(price*qty). Discount is separate. 
      // User prompt: "Update cartTotal calculation... First apply specific lineDiscounts... If no line discounts, apply billDiscount".
      
      calcDiscount += itemDiscount;
      calcTax += itemTax;

      return {
        ...item,
        discount: itemDiscount,
        tax_amount: itemTax,
        // We might need to adjust unit_price or keep it and send discount?
        // API usually expects unit_price and discount amount.
      };
    });

    // Apply Bill Discount if applicable
    if (!hasLineDiscounts && billDiscount) {
      // Calculate total gross (subtotal)
      // Calculate discount amount
      let globalDiscountAmount = 0;
      if (billDiscount.type === 'percent') {
        globalDiscountAmount = calcSubtotal * (billDiscount.value / 100);
      } else {
        globalDiscountAmount = billDiscount.value;
      }

      // Cap discount
      if (globalDiscountAmount > calcSubtotal) globalDiscountAmount = calcSubtotal;
      
      calcDiscount = globalDiscountAmount;

      // Re-calculate tax proportionally?
      // If we have a global discount, tax base is reduced.
      // We need to reduce tax by the discount ratio.
      // effectiveTax = currentTax * (1 - (discount / subtotal))
      if (calcSubtotal > 0) {
        const reductionRatio = 1 - (globalDiscountAmount / calcSubtotal);
        calcTax = calcTax * Math.max(0, reductionRatio);
      }
      
      // We should distribute this discount to items for the payload, 
      // but for now let's just use the global numbers for display.
      // The payload generation will need to handle this distribution if the backend requires per-item discount.
    }

    const finalTotal = Math.max(0, calcSubtotal - calcDiscount + calcTax);

    return {
      processedItems: items,
      subtotal: roundCurrency(calcSubtotal),
      taxTotal: roundCurrency(calcTax),
      discountTotal: roundCurrency(calcDiscount),
      totalDue: roundCurrency(finalTotal),
    };
  }, [saleItems, lineDiscounts, billDiscount]);

  const handleUpdateLineDiscount = (itemId: string, discount: DiscountState | null) => {
    setLineDiscounts((prev) => {
      const next = { ...prev };
      if (discount === null) {
        delete next[itemId];
      } else {
        next[itemId] = discount;
      }
      return next;
    });
    // Ensure mutual exclusivity
    if (discount !== null) {
      setBillDiscount(null);
    }
  };

  const handleUpdateBillDiscount = (discount: DiscountState | null) => {
    setBillDiscount(discount);
    // Ensure mutual exclusivity
    if (discount !== null) {
      setLineDiscounts({});
    }
  };

  // Renamed to handlePrintDraft (Action: save with status: 'draft')
  const handlePrintDraft = async () => {
    if (isSubmitting) return;
    setSubmitError(null);
    try {
      // onHold is passed from parent, assuming it saves as draft.
      // We should ideally pass the updated items/totals to it.
      // But onHold usually grabs the current state from context or parent?
      // Wait, onHold in props is `() => void | Promise<void>`.
      // It doesn't take arguments. This implies the parent (POS Page) reads the state.
      // PROBLEM: The parent (POS Page) doesn't know about our local `lineDiscounts` or `billDiscount`.
      // If we just call `onHold()`, it will save the ORIGINAL cart without discounts.
      
      // SOLUTION: We must use the `onComplete` flow but with a 'draft' flag? 
      // Or we can't fully support saving the *discounted* draft if the parent controls state.
      // However, the prompt implies this logic handles the checkout.
      // If `onHold` is rigid, we might need to modify how we call it or use a custom fetch here similar to `handleSubmit`.
      
      // Let's assume for this task we use `handleComplete` logic but send status='draft'.
      // But `handleComplete` calls `/api/sales` with POST. A draft might be a different endpoint or field.
      // Given the constraints and likely structure, `onHold` in the parent probably saves the `cart` state. 
      // If we can't update parent state, the draft won't have discounts.
      
      // ALTERNATIVE: Use the same logic as `handleSubmit` but add `status: 'draft'` to payload.
      // The prompt says: "Action: The 'Print Draft' button should trigger an order save with status: 'draft'".
      // This implies creating a sale record with draft status.
      
      await performCheckout({ status: 'draft' }); // We'll modify handleComplete to support this or create a shared function
      
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

  // Shared Checkout Logic
  const performCheckout = async (extraData: { status?: 'completed' | 'draft', paymentData?: CheckoutCompletionPayload } = {}) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (processedItems.length === 0) {
        throw new Error('No sale items found.');
      }

      const status = extraData.status || 'completed';
      const paymentData = extraData.paymentData || {};

      // Prepare Payload
      // We need to distribute Bill Discount to items if it exists, because backend likely calculates total from items.
      // Or we assume backend accepts `discount_amount` on the sale level.
      // Let's look at `processedItems` - they have line discounts applied.
      // If we have `billDiscount`, `processedItems` (from memo) currently DO NOT have the discount distributed in their `discount` field
      // because we only calculated the totals globally in the memo for `billDiscount`.
      
      let finalItems = [...processedItems];
      if (billDiscount && !Object.keys(lineDiscounts).length) {
         // Distribute bill discount to items
         const totalVal = processedItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
         if (totalVal > 0) {
            finalItems = processedItems.map(item => {
               const itemTotal = item.unit_price * item.quantity;
               const ratio = itemTotal / totalVal;
               const shareOfDiscount = discountTotal * ratio;
               return {
                 ...item,
                 discount: roundCurrency(shareOfDiscount),
                 tax_amount: roundCurrency(item.tax_amount * (1 - (discountTotal/totalVal))) // Reduce tax proportional to discount
               };
            });
         }
      }

      const normalizedPayments = normalizePayments(paymentData.payments);
      const parsedPaid = parseNumber(paymentData.amount_paid, Number.NaN);
      const amountPaidRaw = Number.isFinite(parsedPaid)
        ? parsedPaid
        : normalizedPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const amountPaid = roundCurrency(amountPaidRaw);

      // Validation for 'completed' orders
      if (status === 'completed' && amountPaid < totalDue - 0.01) { // 0.01 tolerance
        throw new Error('Paying amount must cover the total payable.');
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
      
      const notes = typeof paymentData.notes === 'string' ? paymentData.notes.trim() : '';

      const payload = {
        items: finalItems,
        customer_id: customer?.id ?? null,
        payment_method: paymentMethod,
        payments,
        amount_paid: amountPaid,
        change_given: changeGiven,
        notes: notes || undefined,
        status: status, // Send status
        // Add total fields if backend supports them to verify
        total_amount: totalDue,
        discount_amount: discountTotal,
        tax_amount: taxTotal
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

      if (status === 'completed') {
        window.alert('Sale processed successfully!');
        onComplete();
      } else {
        window.alert('Draft saved successfully!');
        onClose(); // Close on draft save
      }
      
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Checkout failed'
      );
      throw error; // Re-throw to stop callers if needed
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = (paymentData: CheckoutCompletionPayload) => {
     performCheckout({ status: 'completed', paymentData });
  };

  if (!mounted || !isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      <div className="relative flex h-full w-full flex-col lg:flex-row">
        <button
          type="button"
          onClick={handleRequestClose}
          className="absolute right-6 top-6 z-50 rounded-full border border-slate-700 bg-slate-800 p-2 text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
          aria-label="Close checkout"
        >
          <X className="h-4 w-4" />
        </button>

        {/* LEFT PANEL: Summary */}
        <section className="flex w-full flex-col border-b border-slate-800 bg-slate-950 lg:w-[38%] lg:border-b-0 lg:border-r">
          <PaymentSummary
            cart={cart}
            subtotal={subtotal}
            tax={taxTotal}
            discount={discountTotal}
            total={totalDue}
            customer={customer}
            // Pass Discount Props
            lineDiscounts={lineDiscounts}
            billDiscount={billDiscount}
            onUpdateLineDiscount={handleUpdateLineDiscount}
            onUpdateBillDiscount={handleUpdateBillDiscount}
          />
        </section>

        {/* RIGHT PANEL: Controls */}
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
              onPrintDraft={handlePrintDraft}
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

// Simple wrapper if needed, but CheckoutModal is the main actor.
export function CheckoutInterface(props: CheckoutInterfaceProps) {
  // This component seems to be a static view in some contexts.
  // We will leave it as is or update it to match the modal style if it's used as a page.
  // Since the user focused on functionality which resides in the Modal usually (popups),
  // and the file contained CheckoutModal, I prioritized that.
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
          lineDiscounts={{}}
          billDiscount={null}
          onUpdateLineDiscount={() => {}}
          onUpdateBillDiscount={() => {}}
        />
      </div>

      {/* Right Panel: Controls (65%) */}
      <div className="flex-1 h-full bg-slate-900">
        <PaymentRightPanel 
          total={props.total}
          onComplete={props.onCheckout}
          onPrintDraft={props.onHold}
          onVoid={props.onVoid}
          onBack={props.onBack}
        />
      </div>
    </div>
  );
}