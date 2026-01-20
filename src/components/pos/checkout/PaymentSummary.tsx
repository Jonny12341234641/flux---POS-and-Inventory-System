// 'use client';

// import type { CartItem } from '../../../types';

// const currencyFormatter = new Intl.NumberFormat('en-US', {
//   style: 'currency',
//   currency: 'USD',
// });

// const formatCurrency = (value: number) => currencyFormatter.format(value);

// const parseNumber = (value: unknown, fallback = 0) => {
//   const parsed =
//     typeof value === 'number'
//       ? value
//       : typeof value === 'string'
//         ? Number(value)
//         : Number.NaN;
//   return Number.isFinite(parsed) ? parsed : fallback;
// };

// type PaymentSummaryProps = {
//   cart: CartItem[];
//   total: number;
//   tax: number;
//   customerName?: string | null;
// };

// export function PaymentSummary({
//   cart,
//   total,
//   tax,
//   customerName,
// }: PaymentSummaryProps) {
//   const displayName = customerName?.trim() || 'Walk-in Customer';
//   const totalItems = cart.reduce(
//     (sum, item) => sum + parseNumber(item.quantity, 0),
//     0
//   );
//   const taxTotal = parseNumber(tax, 0);

//   return (
//     <div className="flex h-full flex-col">
//       <div className="border-b border-slate-200 pb-4">
//         <h2 className="text-lg font-semibold text-slate-900">Current Bill</h2>
//         <p className="text-sm text-slate-500">{displayName}</p>
//       </div>

//       <div className="flex-1 overflow-y-auto py-4 pr-2">
//         {cart.length === 0 ? (
//           <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
//             No items in the cart.
//           </div>
//         ) : (
//           <div className="space-y-3">
//             {cart.map((item) => {
//               const quantity = parseNumber(item.quantity, 0);
//               const unitPrice = parseNumber(item.product.price, 0);
//               const lineTotal = unitPrice * quantity;

//               return (
//                 <div
//                   key={item.product.id}
//                   className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
//                 >
//                   <div>
//                     <p className="text-sm font-semibold text-slate-900">
//                       {item.product.name}
//                     </p>
//                     <p className="text-xs text-slate-500">
//                       {quantity} x {formatCurrency(unitPrice)}
//                     </p>
//                   </div>
//                   <div className="text-sm font-semibold text-slate-900">
//                     {formatCurrency(lineTotal)}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>

//       <div className="border-t border-slate-200 pt-4">
//         <div className="rounded-2xl border border-slate-200 bg-white p-4">
//           <div className="flex items-center justify-between text-sm text-slate-600">
//             <span>Total Items</span>
//             <span className="font-semibold text-slate-900">{totalItems}</span>
//           </div>
//           <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
//             <span>Tax</span>
//             <span className="font-semibold text-slate-900">
//               {formatCurrency(taxTotal)}
//             </span>
//           </div>
//           <div className="mt-3 flex items-end justify-between">
//             <span className="text-sm text-slate-600">Total Payable</span>
//             <span className="text-2xl font-semibold text-emerald-600">
//               {formatCurrency(total)}
//             </span>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


import React from 'react';
import { User, ShoppingCart } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils'; // Assuming you have a utility, otherwise use standard Intl

interface PaymentSummaryProps {
  cart: any[]; // Replace 'any' with your CartItem type from src/types/index.ts
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customer: any | null; // Replace with Customer type
}

export function PaymentSummary({ cart, subtotal, tax, discount, total, customer }: PaymentSummaryProps) {
  return (
    <div className="flex w-full md:w-[400px] flex-col border-r border-slate-200 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white p-5 shadow-sm dark:bg-slate-950 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">Current Bill</h2>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <User className="h-4 w-4" />
            <span>{customer?.name || 'Walk-in Customer'}</span>
          </div>
        </div>
        <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          <ShoppingCart className="h-5 w-5" />
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {cart.map((item, index) => (
            <div 
              key={`${item.product_id}-${index}`} 
              className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100 dark:bg-slate-950 dark:ring-slate-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 font-bold dark:bg-slate-800 dark:text-slate-400">
                  {item.quantity}x
                </div>
                <div>
                  <div className="font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">
                    {item.product?.name || 'Unknown Item'}
                  </div>
                  <div className="text-xs text-slate-400">
                    @ {formatCurrency(item.unit_price)}
                  </div>
                </div>
              </div>
              <div className="text-right font-bold text-slate-900 dark:text-white">
                {formatCurrency(item.subtotal)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals Footer */}
      <div className="border-t border-slate-200 bg-white p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:bg-slate-950 dark:border-slate-800">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Discount</span>
            <span className="text-red-500">-{formatCurrency(discount)}</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Tax</span>
            <span>{formatCurrency(tax)}</span>
          </div>
        </div>
        <div className="my-4 h-px w-full bg-slate-100 dark:bg-slate-800" />
        <div className="flex items-end justify-between">
          <span className="text-lg font-bold text-slate-800 dark:text-white">Total Payable</span>
          <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}