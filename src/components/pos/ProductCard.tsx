'use client';

import { Tag } from 'lucide-react';

import type { Product } from '../../types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

type ProductCardProps = {
  product: Product;
  onSelect: (product: Product) => void;
};

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const imageUrl = product.image_url?.trim();
  const price = Number.isFinite(product.price) ? product.price : 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="group flex w-full flex-col rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Tag className="h-10 w-10 text-slate-400" />
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {product.name}
          </p>
          <p className="text-xs text-slate-500">
            Stock: {product.stock_quantity} {product.unit || 'pcs'}
          </p>
        </div>
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(price)}
        </span>
      </div>
    </button>
  );
}
