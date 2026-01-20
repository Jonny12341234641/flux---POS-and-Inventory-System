'use client';

import type { Product } from '../../../types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

type StagingInfoProps = {
  product: Product;
  currentQty: number;
};

export function StagingInfo({ product, currentQty }: StagingInfoProps) {
  const imageUrl = product.image_url?.trim();
  const stockQuantity = Number.isFinite(product.stock_quantity)
    ? product.stock_quantity
    : 0;
  const stockTone = stockQuantity > 10 ? 'text-green-600' : 'text-red-600';
  const unitPrice = Number.isFinite(product.price) ? product.price : 0;
  const safeQty = Number.isFinite(currentQty) ? currentQty : 0;
  const estimatedTotal = unitPrice * safeQty;
  const initials = getInitials(product.name || 'Item');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="h-40 w-40 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:h-48 sm:w-48">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-3xl font-semibold text-slate-200">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{product.name}</h2>
            <p className={`text-sm font-semibold ${stockTone}`}>
              {stockQuantity} in stock
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span className="text-slate-400">Unit Price</span>
              <span className="font-semibold text-white">
                {formatCurrency(unitPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Estimated Total</span>
              <span className="text-lg font-semibold text-emerald-400">
                {formatCurrency(estimatedTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
