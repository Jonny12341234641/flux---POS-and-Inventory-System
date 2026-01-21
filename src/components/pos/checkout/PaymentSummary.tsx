import React, { useState } from 'react';
import { User, ShoppingCart, Percent, DollarSign, Tag } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import type { CartItem, Customer } from '../../../types';

// Types for discounts
export type DiscountType = 'percent' | 'fixed';

export interface DiscountState {
  type: DiscountType;
  value: number;
}

interface PaymentSummaryProps {
  cart: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customer: Customer | null;
  // New props for discount handling
  lineDiscounts: Record<string, DiscountState>;
  billDiscount: DiscountState | null;
  onUpdateLineDiscount: (itemId: string, discount: DiscountState | null) => void;
  onUpdateBillDiscount: (discount: DiscountState | null) => void;
}

export function PaymentSummary({
  cart,
  subtotal,
  tax,
  discount,
  total,
  customer,
  lineDiscounts,
  billDiscount,
  onUpdateLineDiscount,
  onUpdateBillDiscount,
}: PaymentSummaryProps) {
  const [activeRowDiscount, setActiveRowDiscount] = useState<string | null>(null);
  const [billDiscountInput, setBillDiscountInput] = useState<{ value: string, type: DiscountType }>({ value: '', type: 'fixed' });

  // Helper to handle bill discount input changes
  const handleBillDiscountChange = (val: string, type: DiscountType) => {
    setBillDiscountInput({ value: val, type });
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal > 0) {
      onUpdateBillDiscount({ type, value: numVal });
    } else {
      onUpdateBillDiscount(null);
    }
  };

  const hasLineDiscounts = Object.keys(lineDiscounts).length > 0;
  const hasBillDiscount = billDiscount !== null;

  return (
    <div className="flex w-full md:w-[35%] lg:w-[400px] flex-col border-r border-slate-800 bg-slate-950 h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-white">Current Bill</h2>
          <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
            <User className="h-4 w-4" />
            <span>{customer?.name || 'Walk-in Customer'}</span>
          </div>
        </div>
        <div className="rounded-full bg-slate-900 p-3 text-emerald-400">
          <ShoppingCart className="h-6 w-6" />
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-slate-700">
        <div className="space-y-3">
          {cart.map((item, index) => {
            const itemId = item.product?.id || `item-${index}`;
            const lineDiscount = lineDiscounts[itemId];
            
            // Local state for row input (simplified: just using a direct popover-like toggle inline)
            const isEditing = activeRowDiscount === itemId;
            
            // Disable row discount if bill discount is active
            const isRowDisabled = hasBillDiscount && !lineDiscount;

            return (
              <div 
                key={itemId} 
                className="flex flex-col rounded-xl bg-slate-900 p-4 shadow-sm ring-1 ring-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800 text-slate-400 font-bold">
                      {item.quantity || 0}x
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200 text-lg line-clamp-1">
                        {item.product?.name || 'Unknown Item'}
                      </div>
                      <div className="text-sm text-slate-400">
                        @ {formatCurrency((item.unit_price || 0))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                     <div className="font-bold text-white text-lg">
                        {/* We display the original subtotal here, global calc handles the final total */}
                        {formatCurrency((item.unit_price || 0) * (item.quantity || 0))}
                     </div>
                     {lineDiscount && (
                       <div className="text-xs text-emerald-400">
                         -{lineDiscount.type === 'percent' ? `${lineDiscount.value}%` : formatCurrency(lineDiscount.value)}
                       </div>
                     )}
                  </div>
                </div>

                {/* Row Discount Controls */}
                <div className="mt-2 flex items-center gap-2">
                   {!isEditing && (
                     <button
                       onClick={() => setActiveRowDiscount(itemId)}
                       disabled={isRowDisabled}
                       className={`text-xs flex items-center gap-1 px-2 py-1 rounded ${
                         isRowDisabled 
                           ? 'text-slate-600 cursor-not-allowed' 
                           : lineDiscount 
                             ? 'bg-emerald-900/30 text-emerald-400' 
                             : 'text-slate-500 hover:text-slate-300'
                       }`}
                     >
                       <Tag className="h-3 w-3" />
                       {lineDiscount ? 'Edit Discount' : 'Add Discount'}
                     </button>
                   )}
                   
                   {isEditing && (
                     <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                        <div className="flex bg-slate-800 rounded-md overflow-hidden border border-slate-700">
                          <button 
                             onClick={() => onUpdateLineDiscount(itemId, { type: 'percent', value: 0 })}
                             className={`px-2 py-1 text-xs ${lineDiscount?.type === 'percent' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                          >
                            %
                          </button>
                          <button 
                             onClick={() => onUpdateLineDiscount(itemId, { type: 'fixed', value: 0 })}
                             className={`px-2 py-1 text-xs ${lineDiscount?.type === 'fixed' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                          >
                            $
                          </button>
                        </div>
                        <input
                          type="number"
                          className="w-16 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                          placeholder="0"
                          value={lineDiscount?.value || ''}
                          onChange={(e) => {
                             const val = parseFloat(e.target.value);
                             onUpdateLineDiscount(itemId, { 
                               type: lineDiscount?.type || 'fixed', 
                               value: isNaN(val) ? 0 : val 
                             });
                          }}
                        />
                        <button onClick={() => setActiveRowDiscount(null)} className="text-xs text-slate-400 hover:text-white">
                          Done
                        </button>
                        {lineDiscount && (
                           <button onClick={() => { onUpdateLineDiscount(itemId, null); setActiveRowDiscount(null); }} className="text-xs text-red-400 hover:text-red-300">
                             Clear
                           </button>
                        )}
                     </div>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals Footer */}
      <div className="border-t border-slate-800 bg-slate-950 p-6 z-10">
        
        {/* Bill Discount Section */}
        <div className="mb-4">
           <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Bill Discount</label>
              {hasLineDiscounts && <span className="text-xs text-red-400">Disabled (Item discounts active)</span>}
           </div>
           <div className={`flex gap-2 ${hasLineDiscounts ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex bg-slate-900 rounded-lg border border-slate-800 p-1">
                 <button
                    onClick={() => handleBillDiscountChange(billDiscountInput.value, 'percent')}
                    className={`p-2 rounded-md transition-all ${billDiscountInput.type === 'percent' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                 >
                    <Percent className="h-4 w-4" />
                 </button>
                 <button
                    onClick={() => handleBillDiscountChange(billDiscountInput.value, 'fixed')}
                    className={`p-2 rounded-md transition-all ${billDiscountInput.type === 'fixed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                 >
                    <DollarSign className="h-4 w-4" />
                 </button>
              </div>
              <input 
                 type="number" 
                 placeholder="Discount Amount"
                 className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                 value={billDiscountInput.value}
                 onChange={(e) => handleBillDiscountChange(e.target.value, billDiscountInput.type)}
              />
           </div>
        </div>

        <div className="space-y-3 text-base">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal || 0)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Discount</span>
            <span className="text-red-400">-{formatCurrency(discount || 0)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Tax</span>
            <span>{formatCurrency(tax || 0)}</span>
          </div>
        </div>
        <div className="my-6 h-px w-full bg-slate-800" />
        <div className="flex items-end justify-between">
          <div>
            <span className="block text-sm text-slate-400 mb-1">Total Payable</span>
            <span className="text-4xl font-black text-white">
              {formatCurrency(total || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
