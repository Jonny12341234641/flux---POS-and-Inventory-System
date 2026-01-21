import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Banknote, 
  Split, 
  Printer, 
  Trash2, 
  CheckCircle,
  X,
  StickyNote
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { PaymentRecord } from '../../../types/payment';

interface PaymentRightPanelProps {
  total: number;
  onComplete: (paymentData: any) => void;
  onPrintDraft: () => void; // Renamed/New prop for "Print Draft"
  onVoid: () => void;
  onBack: () => void;
}

const QUICK_AMOUNTS = [10, 20, 50, 100, 500, 1000, 5000];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'split', label: 'Split Payment', icon: Split },
];

export function PaymentRightPanel({ total, onComplete, onPrintDraft, onVoid, onBack }: PaymentRightPanelProps) {
  const [method, setMethod] = useState('cash');
  const [tenderAmount, setTenderAmount] = useState<string>('');
  const [splitPayments, setSplitPayments] = useState<{ type: 'cash' | 'card', amount: number }[]>([]);
  const [billNote, setBillNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  
  // Split Logic State
  const [splitInputType, setSplitInputType] = useState<'cash' | 'card'>('cash');

  // Derived Values
  const totalPaidInSplit = splitPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const currentEntry = parseFloat(tenderAmount || '0');
  
  // Logic: For single payment modes, existingPaid is 0. 
  // For Split, existingPaid is the sum of the list.
  const totalPaid = method === 'split' ? totalPaidInSplit : 0;
  const effectivePaid = method === 'split' ? totalPaid : currentEntry;
  
  const remaining = Math.max(0, (total || 0) - totalPaid - (method !== 'split' ? currentEntry : 0));
  const change = method !== 'split' ? Math.max(0, currentEntry - ((total || 0) - totalPaid)) : 0;

  // Auto-fill logic
  useEffect(() => {
    if (method === 'card') {
      setTenderAmount((total || 0).toString());
    } else if (method === 'split') {
      setTenderAmount('');
    } else {
      setTenderAmount('');
    }
  }, [method, total]);

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
    setTenderAmount(((currentVal || 0) + amount).toString());
  };

  const handleAddSplitPayment = () => {
    if (currentEntry <= 0) return;
    const newPayment = { type: splitInputType, amount: currentEntry };
    setSplitPayments([...splitPayments, newPayment]);
    setTenderAmount('');
  };

  const removeSplitPayment = (index: number) => {
    const newPayments = [...splitPayments];
    newPayments.splice(index, 1);
    setSplitPayments(newPayments);
  };

  const isComplete = effectivePaid >= (total || 0);
  // Split validation: Must exactly match total to pay? Usually >= total.
  // The user prompt said: "Validation: Show a warning or disable the 'Pay' button if (Cash + Card) != CartTotal."
  // So exact match or covered.
  const isSplitValid = method === 'split' ? Math.abs(totalPaidInSplit - (total || 0)) < 0.01 : true;

  // Numpad Button
  const NumBtn = ({ value, label, span = 1, isAction = false }: any) => (
    <button
      onClick={() => handleNumpadInput(value)}
      className={`
        flex items-center justify-center rounded-xl text-3xl font-medium transition-all active:scale-95
        ${span === 2 ? 'col-span-2' : 'col-span-1'}
        ${isAction 
          ? 'bg-red-900/20 text-red-500 hover:bg-red-900/30 border border-red-800' 
          : 'bg-slate-800 text-slate-200 shadow-sm hover:bg-slate-700 border border-slate-700'}
        h-20
      `}
    >
      {label || value}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col bg-slate-900 h-full overflow-hidden">
      
      {/* 1. Header & Tabs */}
      <div className="bg-slate-950 p-4 shadow-sm z-10 border-b border-slate-800">
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
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'}
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
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto pr-2">
          
          {/* Split Payment Interface */}
          {method === 'split' && (
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Split Payments</h3>
              
              {/* Split Entry Form */}
              <div className="flex gap-2 mb-4">
                 <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                    <button 
                      onClick={() => setSplitInputType('cash')}
                      className={`px-4 py-2 rounded-md text-sm font-bold ${splitInputType === 'cash' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                    >
                      Cash
                    </button>
                    <button 
                      onClick={() => setSplitInputType('card')}
                      className={`px-4 py-2 rounded-md text-sm font-bold ${splitInputType === 'card' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
                    >
                      Card
                    </button>
                 </div>
                 <div className="flex-1" />
              </div>

              <div className="space-y-2 mb-4">
                {splitPayments.length === 0 && <p className="text-slate-600 text-sm italic">No split payments added.</p>}
                {splitPayments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-2">
                       {p.type === 'cash' ? <Banknote className="h-4 w-4 text-emerald-500"/> : <CreditCard className="h-4 w-4 text-blue-500"/>}
                       <span className="font-medium text-slate-300 capitalize">{p.type} Amount</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-white">{formatCurrency(p.amount)}</span>
                      <button onClick={() => removeSplitPayment(i)} className="text-red-400 hover:text-red-300">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                <span className="font-bold text-slate-400">Total Split Paid</span>
                <span className={`font-bold text-xl ${isSplitValid ? 'text-emerald-400' : 'text-red-400'}`}>
                   {formatCurrency(totalPaidInSplit)} / {formatCurrency(total || 0)}
                </span>
              </div>
              {!isSplitValid && (
                 <p className="text-xs text-red-500 mt-1 text-right">Must equal total bill</p>
              )}
            </div>
          )}

          {/* Main Input Display */}
          <div className="bg-slate-950 rounded-2xl p-6 shadow-sm border border-slate-800">
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-bold text-slate-500 uppercase">
                 {method === 'split' ? `Enter ${splitInputType} Amount` : 'Tendered Amount'}
              </label>
              {method === 'split' && (
                <button onClick={handleAddSplitPayment} className="text-xs bg-emerald-900/30 text-emerald-400 px-3 py-2 rounded-lg hover:bg-emerald-900/50 font-bold border border-emerald-900/50">
                  + Add to Split
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl font-bold text-slate-600">$</span>
              <input
                type="text"
                value={tenderAmount}
                readOnly
                placeholder="0.00"
                className="w-full rounded-xl bg-slate-900 p-6 pl-12 text-right text-5xl font-black text-white outline-none placeholder:text-slate-700 border border-slate-800 focus:border-slate-700"
              />
            </div>
            
            {/* Calculation Row */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className={`p-4 rounded-xl border ${remaining > 0 ? 'bg-red-900/10 border-red-900/30 text-red-400' : 'bg-green-900/10 border-green-900/30 text-green-400'}`}>
                <div className="text-xs font-bold uppercase opacity-60">Remaining Due</div>
                <div className="text-2xl font-black">{formatCurrency(remaining)}</div>
              </div>
              <div className="p-4 rounded-xl border bg-blue-900/10 border-blue-900/30 text-blue-400">
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
                className="bg-slate-950 border border-slate-800 rounded-xl py-4 font-bold text-slate-400 shadow-sm hover:border-blue-600 hover:text-blue-500 transition-all"
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
                className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 rounded-xl py-4 font-bold text-slate-300 hover:bg-slate-700"
              >
                <StickyNote className="h-5 w-5" /> Bill Note
              </button>
              <button 
                onClick={onPrintDraft} // New Handler
                className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 rounded-xl py-4 font-bold text-slate-300 hover:bg-slate-700"
              >
                <Printer className="h-5 w-5" /> Print Draft
              </button>
           </div>
           {showNoteInput && (
             <textarea 
               className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
               placeholder="Type note here..."
               rows={2}
               value={billNote}
               onChange={(e) => setBillNote(e.target.value)}
             />
           )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="grid grid-cols-12 gap-4 border-t border-slate-800 bg-slate-950 p-5">
        <button onClick={onBack} className="col-span-2 rounded-xl border border-slate-700 font-bold text-slate-400 hover:bg-slate-800">
          BACK
        </button>
        <button onClick={onVoid} className="col-span-2 rounded-xl bg-red-900/20 font-bold text-red-500 hover:bg-red-900/30">
          VOID
        </button>
        {/* REMOVED HOLD BUTTON per instructions */}
        
        <button
          onClick={() => {
             // Construct payment data
             const payload = {
                 payment_method: method,
                 amount_paid: method === 'split' ? totalPaidInSplit : currentEntry,
                 change_given: change,
                 payments: method === 'split' 
                    ? splitPayments.map(p => ({ method: p.type, amount: p.amount }))
                    : [{ method, amount: currentEntry }],
                 notes: billNote
             };
             onComplete(payload);
          }}
          // Disable conditions: 
          // 1. If split, must be valid (exact match). 
          // 2. If normal, paid must cover total.
          disabled={method === 'split' ? !isSplitValid : !isComplete} 
          className={`
            col-span-8 flex items-center justify-center gap-3 rounded-xl text-2xl font-black text-white shadow-xl transition-all
            ${(method === 'split' ? !isSplitValid : !isComplete) 
              ? 'cursor-not-allowed bg-slate-800 text-slate-600' 
              : 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-[0.98] shadow-emerald-500/30'}
          `}
        >
          <CheckCircle className="h-8 w-8" />
          {(method === 'split' ? isSplitValid : isComplete) ? 'FINALIZE SALE' : `PAY ${formatCurrency(remaining)}`}
        </button>
      </div>
    </div>
  );
}
