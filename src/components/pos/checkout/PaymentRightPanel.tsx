// 'use client';

// import { useMemo, useState } from 'react';
// import { Check, Hand, Trash2 } from 'lucide-react';

// const currencyFormatter = new Intl.NumberFormat('en-US', {
//   style: 'currency',
//   currency: 'USD',
// });

// const formatCurrency = (value: number) => currencyFormatter.format(value);

// const roundCurrency = (value: number) => Math.round(value * 100) / 100;

// const normalizeBuffer = (value: string) => {
//   if (!value) return '0';
//   if (value === '.') return '0.';
//   if (value.startsWith('.')) return `0${value}`;
//   if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
//     const trimmed = value.replace(/^0+/, '');
//     return trimmed.length > 0 ? trimmed : '0';
//   }
//   return value;
// };

// const formatInputValue = (value: number) => {
//   if (!Number.isFinite(value)) return '0';
//   const rounded = roundCurrency(value);
//   return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
// };

// const sanitizeInput = (value: string) => {
//   const cleaned = value.replace(/[^\d.]/g, '');
//   const firstDot = cleaned.indexOf('.');
//   if (firstDot === -1) {
//     return normalizeBuffer(cleaned);
//   }
//   const withoutExtraDots =
//     cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
//   const [whole, decimals = ''] = withoutExtraDots.split('.');
//   return normalizeBuffer(`${whole}.${decimals.slice(0, 2)}`);
// };

// const paymentTabs = [
//   { id: 'cash', label: 'Cash' },
//   { id: 'card', label: 'Card' },
//   { id: 'transfer', label: 'Transfer' },
//   { id: 'cheque', label: 'Cheque' },
//   { id: 'other', label: 'Other' },
// ] as const;

// const quickAmounts = [10, 20, 50, 100, 500, 1000, 5000];

// const numpadKeys = [
//   '1',
//   '2',
//   '3',
//   '4',
//   '5',
//   '6',
//   '7',
//   '8',
//   '9',
//   '.',
//   '0',
//   'backspace',
// ] as const;

// export type CheckoutPaymentMethod = (typeof paymentTabs)[number]['id'];

// type PaymentRightPanelProps = {
//   total: number;
//   onPaymentSubmit: (method: CheckoutPaymentMethod, tenderAmount: string) => void;
//   onHold: () => void | Promise<void>;
//   onVoid: () => void;
//   isSubmitting?: boolean;
// };

// export function PaymentRightPanel({
//   total,
//   onPaymentSubmit,
//   onHold,
//   onVoid,
//   isSubmitting = false,
// }: PaymentRightPanelProps) {
//   const [activeTab, setActiveTab] = useState<CheckoutPaymentMethod>('cash');
//   const [tenderAmount, setTenderAmount] = useState('0');

//   const totalDue = roundCurrency(total);
//   const tenderValue = useMemo(() => {
//     const parsed = Number.parseFloat(tenderAmount);
//     return Number.isFinite(parsed) ? parsed : 0;
//   }, [tenderAmount]);
//   const changeDue = Math.max(roundCurrency(tenderValue - totalDue), 0);
//   const isSubmitDisabled = tenderValue < totalDue;

//   const handleNumpadInput = (value: string) => {
//     if (value === 'backspace') {
//       setTenderAmount((prev) => {
//         const next = prev.length <= 1 ? '0' : prev.slice(0, -1);
//         return normalizeBuffer(next);
//       });
//       return;
//     }

//     if (value === '.') {
//       setTenderAmount((prev) => {
//         if (prev.includes('.')) return prev;
//         return normalizeBuffer(`${prev}.`);
//       });
//       return;
//     }

//     if (!/^\d$/.test(value)) return;

//     setTenderAmount((prev) => {
//       const nextRaw = prev === '0' ? value : `${prev}${value}`;
//       if (nextRaw.includes('.')) {
//         const decimals = nextRaw.split('.')[1] ?? '';
//         if (decimals.length > 2) {
//           return prev;
//         }
//       }
//       return normalizeBuffer(nextRaw);
//     });
//   };

//   const handleQuickAmount = (amount: number) => {
//     const base = Number.parseFloat(tenderAmount);
//     const current = Number.isFinite(base) ? base : 0;
//     const nextValue = current + amount;
//     setTenderAmount(formatInputValue(nextValue));
//   };

//   const handleSubmit = () => {
//     if (isSubmitDisabled || isSubmitting) return;
//     onPaymentSubmit(activeTab, tenderAmount);
//   };

//   return (
//     <div className="flex h-full flex-col gap-6">
//       <div>
//         <h3 className="text-xl font-semibold text-slate-900">
//           Payment Terminal
//         </h3>
//         <p className="text-sm text-slate-500">
//           Select a method and enter the paying amount.
//         </p>
//       </div>

//       <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
//         <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
//           {paymentTabs.map((tab) => {
//             const isActive = activeTab === tab.id;
//             return (
//               <button
//                 key={tab.id}
//                 type="button"
//                 onClick={() => setActiveTab(tab.id)}
//                 className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
//                   isActive
//                     ? 'bg-emerald-500 text-white'
//                     : 'bg-white text-slate-600 hover:bg-slate-100'
//                 }`}
//                 aria-pressed={isActive}
//               >
//                 {tab.label}
//               </button>
//             );
//           })}
//         </div>
//       </div>

//       <div className="grid gap-4 lg:grid-cols-3">
//         <div>
//           <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
//             Total Payable
//           </label>
//           <input
//             readOnly
//             value={formatCurrency(totalDue)}
//             className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
//           />
//         </div>
//         <div>
//           <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
//             Paying Amount
//           </label>
//           <input
//             value={tenderAmount}
//             onChange={(event) => setTenderAmount(sanitizeInput(event.target.value))}
//             inputMode="decimal"
//             className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
//             aria-label="Paying amount"
//           />
//         </div>
//         <div>
//           <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
//             Change Return
//           </label>
//           <input
//             readOnly
//             value={formatCurrency(changeDue)}
//             className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900"
//           />
//         </div>
//       </div>

//       <div>
//         <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
//           Quick Cash
//         </p>
//         <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
//           {quickAmounts.map((amount) => (
//             <button
//               key={amount}
//               type="button"
//               onClick={() => handleQuickAmount(amount)}
//               className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
//             >
//               {formatCurrency(amount)}
//             </button>
//           ))}
//         </div>
//       </div>

//       <div className="flex-1">
//         <div className="grid grid-cols-3 gap-3">
//           {numpadKeys.map((key) => {
//             const label = key === 'backspace' ? 'Del' : key;
//             return (
//               <button
//                 key={key}
//                 type="button"
//                 onClick={() => handleNumpadInput(key)}
//                 className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
//                 aria-label={key === 'backspace' ? 'Backspace' : `Key ${label}`}
//               >
//                 {label}
//               </button>
//             );
//           })}
//         </div>
//       </div>

//       <div className="mt-auto">
//         <div className="flex flex-col gap-3 sm:flex-row">
//           <button
//             type="button"
//             onClick={onHold}
//             disabled={isSubmitting}
//             className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
//           >
//             <Hand className="h-4 w-4" />
//             Hold
//           </button>
//           <button
//             type="button"
//             onClick={onVoid}
//             disabled={isSubmitting}
//             className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
//           >
//             <Trash2 className="h-4 w-4" />
//             Void
//           </button>
//           <button
//             type="button"
//             onClick={handleSubmit}
//             disabled={isSubmitDisabled || isSubmitting}
//             className={`flex flex-[2] items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
//               isSubmitDisabled || isSubmitting
//                 ? 'cursor-not-allowed bg-slate-200 text-slate-400'
//                 : 'bg-emerald-500 hover:bg-emerald-400'
//             }`}
//           >
//             <Check className="h-4 w-4" />
//             {isSubmitting ? 'Processing...' : 'Pay'}
//           </button>
//         </div>
//         {isSubmitDisabled ? (
//           <p className="mt-2 text-xs text-slate-400">
//             Paying amount must cover the total payable.
//           </p>
//         ) : null}
//       </div>
//     </div>
//   );
// }


// import React, { useState, useEffect } from 'react';
// import { CreditCard, Banknote, RefreshCw, FileText, CheckCircle, PauseCircle, Trash2 } from 'lucide-react';
// import { formatCurrency } from '../../../lib/utils';

// interface PaymentControlsProps {
//   total: number;
//   onComplete: (paymentData: any) => void;
//   onHold: () => void;
//   onVoid: () => void;
// }

// const QUICK_AMOUNTS = [10, 20, 50, 100, 500, 1000, 5000];
// const PAYMENT_METHODS = [
//   { id: 'cash', label: 'Cash', icon: Banknote },
//   { id: 'card', label: 'Card', icon: CreditCard },
//   { id: 'transfer', label: 'Transfer', icon: RefreshCw },
//   { id: 'cheque', label: 'Cheque', icon: FileText },
//   { id: 'other', label: 'Other', icon: FileText },
// ];

// export function PaymentControls({ total, onComplete, onHold, onVoid }: PaymentControlsProps) {
//   const [method, setMethod] = useState('cash');
//   const [tenderAmount, setTenderAmount] = useState<string>('');
  
//   // Auto-fill tender amount if Card/Transfer is selected (usually exact payment)
//   useEffect(() => {
//     if (method !== 'cash') {
//       setTenderAmount(total.toString());
//     } else {
//       setTenderAmount(''); // Clear for cash to let user type
//     }
//   }, [method, total]);

//   const handleNumpadInput = (value: string) => {
//     if (value === 'backspace') {
//       setTenderAmount((prev) => prev.slice(0, -1));
//     } else if (value === '.') {
//       if (!tenderAmount.includes('.')) setTenderAmount((prev) => prev + '.');
//     } else {
//       setTenderAmount((prev) => prev + value);
//     }
//   };

//   const handleQuickAdd = (amount: number) => {
//     const currentVal = parseFloat(tenderAmount || '0');
//     setTenderAmount((currentVal + amount).toString());
//   };

//   const paid = parseFloat(tenderAmount || '0');
//   const change = paid > total ? paid - total : 0;
//   const remaining = total > paid ? total - paid : 0;

//   // Render Numpad Button Helper
//   const NumBtn = ({ value, label, span = 1, isAction = false }: any) => (
//     <button
//       onClick={() => handleNumpadInput(value)}
//       className={`
//         flex items-center justify-center rounded-xl text-2xl font-semibold transition-all active:scale-95
//         ${span === 2 ? 'col-span-2' : 'col-span-1'}
//         ${isAction 
//           ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 dark:bg-red-900/20 dark:border-red-800' 
//           : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'}
//         h-14
//       `}
//     >
//       {label || value}
//     </button>
//   );

//   return (
//     <div className="flex flex-1 flex-col bg-white dark:bg-slate-950 h-full">
      
//       {/* 1. Payment Methods Tabs */}
//       <div className="border-b border-slate-200 p-4 dark:border-slate-800">
//         <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
//           {PAYMENT_METHODS.map((m) => {
//             const Icon = m.icon;
//             const isActive = method === m.id;
//             return (
//               <button
//                 key={m.id}
//                 onClick={() => setMethod(m.id)}
//                 className={`
//                   flex min-w-[100px] flex-1 flex-col items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-all
//                   ${isActive 
//                     ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900' 
//                     : 'bg-slate-50 text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'}
//                 `}
//               >
//                 <Icon className="h-5 w-5" />
//                 {m.label}
//               </button>
//             );
//           })}
//         </div>
//       </div>

//       <div className="flex flex-1 gap-6 p-6 overflow-y-auto">
//         {/* Left Side of Controls: Inputs & Quick Cash */}
//         <div className="flex flex-1 flex-col gap-6">
          
//           {/* Inputs */}
//           <div className="space-y-4">
//             <div>
//               <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
//                 Paying Amount
//               </label>
//               <div className="relative">
//                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">$</span>
//                 <input
//                   type="text"
//                   value={tenderAmount}
//                   readOnly
//                   placeholder="0.00"
//                   className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50/50 p-4 pl-8 text-right text-3xl font-bold text-emerald-900 outline-none focus:ring-0 dark:bg-emerald-900/10 dark:text-emerald-400"
//                 />
//               </div>
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <label className="mb-1 block text-xs font-medium text-slate-500">Change Return</label>
//                 <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-right text-xl font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
//                   {formatCurrency(change)}
//                 </div>
//               </div>
//               <div>
//                 <label className="mb-1 block text-xs font-medium text-slate-500">Remaining</label>
//                 <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-right text-xl font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
//                   {formatCurrency(remaining)}
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Quick Cash Grid */}
//           <div>
//             <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
//               Quick Cash
//             </label>
//             <div className="grid grid-cols-4 gap-3">
//               {QUICK_AMOUNTS.map((amt) => (
//                 <button
//                   key={amt}
//                   onClick={() => handleQuickAdd(amt)}
//                   className="rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-transform hover:scale-105 hover:border-emerald-200 hover:bg-emerald-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
//                 >
//                   +{amt}
//                 </button>
//               ))}
//             </div>
//           </div>
//         </div>

//         {/* Right Side of Controls: Numpad */}
//         <div className="w-[280px]">
//            <div className="grid h-full grid-cols-3 gap-3">
//               {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
//                 <NumBtn key={n} value={n.toString()} />
//               ))}
//               <NumBtn value="." label="." />
//               <NumBtn value="0" label="0" />
//               <NumBtn value="backspace" label={<Trash2 className="h-6 w-6"/>} isAction />
//            </div>
//         </div>
//       </div>

//       {/* Footer Actions */}
//       <div className="grid grid-cols-4 gap-4 border-t border-slate-200 p-4 dark:border-slate-800">
//         <button 
//           onClick={onHold}
//           className="col-span-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-amber-100 py-3 font-bold text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
//         >
//           <PauseCircle className="h-6 w-6" />
//           HOLD
//         </button>
        
//         <button 
//           onClick={onVoid}
//           className="col-span-1 flex flex-col items-center justify-center gap-1 rounded-xl bg-red-100 py-3 font-bold text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
//         >
//           <Trash2 className="h-6 w-6" />
//           VOID
//         </button>

//         <button
//           onClick={() => onComplete({
//              method,
//              amount_paid: paid,
//              change_given: change,
//              // If payment is split, you would send an array here.
//              // For this UI, we assume one primary method unless extended.
//              payments: [{ method, amount: paid }]
//           })}
//           disabled={remaining > 0} // Disable if not fully paid
//           className={`
//             col-span-2 flex items-center justify-center gap-3 rounded-xl py-3 text-xl font-bold text-white shadow-lg transition-all
//             ${remaining > 0 
//               ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800' 
//               : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 active:scale-[0.98]'}
//           `}
//         >
//           <CheckCircle className="h-8 w-8" />
//           {remaining > 0 ? `PAY ${formatCurrency(remaining)}` : 'COMPLETE SALE'}
//         </button>
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Banknote, 
  RefreshCw, 
  Gift, 
  Split, 
  Printer, 
  StickyNote, 
  PauseCircle, 
  Trash2, 
  CheckCircle,
  X
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { PaymentRecord } from '../../../types/payment';

interface PaymentRightPanelProps {
  total: number;
  onComplete: (paymentData: any) => void;
  onHold: () => void;
  onVoid: () => void;
  onBack: () => void; // To go back to grid
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 500, 1000, 5000];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'transfer', label: 'Transfer', icon: RefreshCw },
  { id: 'split', label: 'Split Payment', icon: Split },
  { id: 'gift_card', label: 'Gift Card', icon: Gift },
];

export function PaymentRightPanel({ total, onComplete, onHold, onVoid, onBack }: PaymentRightPanelProps) {
  const [method, setMethod] = useState('cash');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]); // For Split Logic
  const [billNote, setBillNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Derived Values
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const currentEntry = parseFloat(tenderAmount || '0');
  
  // Logic: For single payment modes (Cash/Card), existingPaid is 0. 
  // For Split, existingPaid is the sum of the list.
  const remaining = Math.max(0, total - totalPaid - (method !== 'split' ? currentEntry : 0));
  const change = method !== 'split' ? Math.max(0, currentEntry - (total - totalPaid)) : 0;

  // Auto-fill logic
  useEffect(() => {
    if (method === 'card' || method === 'transfer') {
      setTenderAmount((total - totalPaid).toString());
    } else {
      setTenderAmount('');
    }
  }, [method, total, totalPaid]);

  const handleNumpadInput = (value: string) => {
    if (value === 'backspace') {
      setTenderAmount((prev) => prev.slice(0, -1));
    } else if (value === '.') {
      if (!tenderAmount.includes('.')) setTenderAmount((prev) => prev + '.');
    } else {
      setTenderAmount((prev) => prev + value);
    }
  };

  const handleQuickAdd = (amount: number) => {
    const currentVal = parseFloat(tenderAmount || '0');
    setTenderAmount((currentVal + amount).toString());
  };

  const handleAddSplitPayment = () => {
    if (currentEntry <= 0) return;
    const newPayment = { method: 'cash', amount: currentEntry }; // Default to cash for split entry
    setPayments([...payments, newPayment as any]);
    setTenderAmount('');
  };

  const removePayment = (index: number) => {
    const newPayments = [...payments];
    newPayments.splice(index, 1);
    setPayments(newPayments);
  };

  const isComplete = (method === 'split' ? totalPaid : currentEntry) >= total;

  // Numpad Button
  const NumBtn = ({ value, label, span = 1, isAction = false }: any) => (
    <button
      onClick={() => handleNumpadInput(value)}
      className={`
        flex items-center justify-center rounded-xl text-3xl font-medium transition-all active:scale-95
        ${span === 2 ? 'col-span-2' : 'col-span-1'}
        ${isAction 
          ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 dark:bg-red-900/20 dark:border-red-800' 
          : 'bg-white text-slate-700 shadow-sm hover:bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'}
        h-20
      `}
    >
      {label || value}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col bg-slate-100 dark:bg-slate-900 h-full overflow-hidden">
      
      {/* 1. Header & Tabs */}
      <div className="bg-white p-4 shadow-sm z-10 dark:bg-slate-950">
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            const isActive = method === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={`
                  flex min-w-[110px] flex-1 flex-col items-center justify-center gap-2 rounded-xl py-4 text-sm font-semibold transition-all
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 transform scale-105' 
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'}
                `}
              >
                <Icon className="h-6 w-6" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 gap-6 p-6 overflow-hidden">
        
        {/* LEFT COLUMN: Inputs & Split List */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
          
          {/* Split Payment List (Only visible if Split is active or payments exist) */}
          {(method === 'split' || payments.length > 0) && (
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm dark:bg-slate-950 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Partial Payments</h3>
              <div className="space-y-2">
                {payments.length === 0 && <p className="text-slate-400 text-sm italic">No payments added yet.</p>}
                {payments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg dark:bg-slate-900">
                    <span className="font-medium text-slate-700 capitalize dark:text-slate-300">{p.method}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600">{formatCurrency(p.amount)}</span>
                      <button onClick={() => removePayment(i)} className="text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between dark:border-slate-800">
                <span className="font-bold text-slate-600">Total Paid</span>
                <span className="font-bold text-blue-600">{formatCurrency(totalPaid)}</span>
              </div>
            </div>
          )}

          {/* Main Input Display */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 dark:bg-slate-950 dark:border-slate-800">
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-bold text-slate-400 uppercase">Tendered Amount</label>
              {method === 'split' && (
                <button onClick={handleAddSplitPayment} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 font-bold">
                  + Add Partial
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold text-slate-300">$</span>
              <input
                type="text"
                value={tenderAmount}
                readOnly
                placeholder="0.00"
                className="w-full rounded-xl bg-slate-50 p-6 pl-12 text-right text-5xl font-black text-slate-800 outline-none placeholder:text-slate-200 dark:bg-slate-900 dark:text-white"
              />
            </div>
            
            {/* Calculation Row */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className={`p-4 rounded-xl border ${remaining > 0 ? 'bg-red-50 border-red-100 text-red-700' : 'bg-green-50 border-green-100 text-green-700'}`}>
                <div className="text-xs font-bold uppercase opacity-60">Remaining Due</div>
                <div className="text-2xl font-black">{formatCurrency(remaining)}</div>
              </div>
              <div className="p-4 rounded-xl border bg-blue-50 border-blue-100 text-blue-700">
                <div className="text-xs font-bold uppercase opacity-60">Change Return</div>
                <div className="text-2xl font-black">{formatCurrency(change)}</div>
              </div>
            </div>
          </div>

          {/* Quick Cash Grid */}
          <div className="grid grid-cols-4 gap-3">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => handleQuickAdd(amt)}
                className="bg-white border border-slate-200 rounded-xl py-4 font-bold text-slate-600 shadow-sm hover:border-blue-500 hover:text-blue-600 hover:shadow-md transition-all dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400"
              >
                +{amt}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Numpad */}
        <div className="w-[320px] flex flex-col gap-4">
           <div className="grid grid-cols-3 gap-3 flex-1">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <NumBtn key={n} value={n.toString()} />
              ))}
              <NumBtn value="." label="." />
              <NumBtn value="0" label="0" />
              <NumBtn value="backspace" label={<Trash2 className="h-8 w-8"/>} isAction />
           </div>
           
           {/* Additional Function Buttons */}
           <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowNoteInput(!showNoteInput)}
                className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl py-4 font-bold text-slate-600 hover:bg-slate-50"
              >
                <StickyNote className="h-5 w-5" /> Bill Note
              </button>
              <button className="flex items-center justify-center gap-2 bg-white border border-slate-200 rounded-xl py-4 font-bold text-slate-600 hover:bg-slate-50">
                <Printer className="h-5 w-5" /> Print Bill
              </button>
           </div>
           {showNoteInput && (
             <textarea 
               className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
               placeholder="Type note here..."
               rows={2}
               value={billNote}
               onChange={(e) => setBillNote(e.target.value)}
             />
           )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="grid grid-cols-12 gap-4 border-t border-slate-200 bg-white p-5 dark:bg-slate-950 dark:border-slate-800">
        <button onClick={onBack} className="col-span-2 rounded-xl border border-slate-300 font-bold text-slate-500 hover:bg-slate-50">
          BACK
        </button>
        <button onClick={onVoid} className="col-span-2 rounded-xl bg-red-100 font-bold text-red-600 hover:bg-red-200">
          VOID
        </button>
        <button onClick={onHold} className="col-span-2 rounded-xl bg-amber-100 font-bold text-amber-700 hover:bg-amber-200">
          HOLD
        </button>
        
        <button
          onClick={() => onComplete({
             payment_method: method === 'split' ? 'split' : method,
             amount_paid: method === 'split' ? totalPaid : currentEntry,
             change_given: change,
             payments: method === 'split' ? payments : [{ method, amount: currentEntry }],
             notes: billNote
          })}
          disabled={!isComplete} 
          className={`
            col-span-6 flex items-center justify-center gap-3 rounded-xl text-2xl font-black text-white shadow-xl transition-all
            ${!isComplete 
              ? 'cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800' 
              : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 active:scale-[0.98] shadow-emerald-500/30'}
          `}
        >
          <CheckCircle className="h-8 w-8" />
          {isComplete ? 'FINALIZE SALE' : `PAY ${formatCurrency(remaining)}`}
        </button>
      </div>
    </div>
  );
}