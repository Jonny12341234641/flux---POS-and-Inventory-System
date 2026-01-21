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
      className="group flex w-full flex-col rounded-2xl border border-slate-800 bg-slate-900 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
    >
      <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl bg-slate-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <Tag className="h-10 w-10 text-slate-600" />
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">
            {product.name}
          </p>
          <p className="text-xs text-slate-400">
            Stock: {product.stock_quantity} {product.unit || 'pcs'}
          </p>
        </div>
        <span className="text-sm font-semibold text-slate-100">
          {formatCurrency(price)}
        </span>
      </div>
    </button>
  );
}
