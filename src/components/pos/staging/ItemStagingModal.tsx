'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, X } from 'lucide-react';

import type { Product } from '../../../types';
import { StagingInfo } from './StagingInfo';
import { StagingNumpad } from './StagingNumpad';

type ItemStagingModalProps = {
  product: Product;
  initialQty: number;
  mode: 'add' | 'edit';
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
  onRemove?: () => void;
  allowDecimal?: boolean;
};

export function ItemStagingModal({
  product,
  initialQty,
  mode,
  onConfirm,
  onCancel,
  onRemove,
  allowDecimal = true,
}: ItemStagingModalProps) {
  const [mounted, setMounted] = useState(false);
  const [inputBuffer, setInputBuffer] = useState('1');
  const [isFreshInput, setIsFreshInput] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxStock = Math.max(
    0,
    Number.isFinite(product.stock_quantity) ? product.stock_quantity : 0
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  useEffect(() => {
    const startingQty =
      Number.isFinite(initialQty) && initialQty > 0 ? initialQty : 1;
    setInputBuffer(String(startingQty));
    setIsFreshInput(true);
    setStockError(null);
  }, [product.id, initialQty, mode]);

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const triggerStockError = (message: string) => {
    setStockError(message);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setStockError(null);
    }, 1500);
  };

  const normalizeBuffer = (value: string) => {
    if (!value) return '0';
    if (value === '.') return '0.';
    if (value.startsWith('.')) return `0${value}`;
    if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
      const trimmed = value.replace(/^0+/, '');
      return trimmed.length > 0 ? trimmed : '0';
    }
    return value;
  };

  const capToStock = (value: string) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return value;
    if (parsed > maxStock) {
      triggerStockError(`Only ${maxStock} in stock`);
      return String(maxStock);
    }
    return value;
  };

  const handleInput = (value: string) => {
    if (value === 'backspace') {
      setInputBuffer((prev) => {
        const next = prev.length <= 1 ? '0' : prev.slice(0, -1);
        return normalizeBuffer(next);
      });
      setIsFreshInput(false);
      return;
    }

    if (value === '.') {
      if (!allowDecimal) return;
      setInputBuffer((prev) => {
        if (prev.includes('.')) return prev;
        const next = normalizeBuffer(`${prev}.`);
        return next;
      });
      setIsFreshInput(false);
      return;
    }

    if (!/^\d$/.test(value)) return;

    setInputBuffer((prev) => {
      const shouldReplace =
        isFreshInput && (mode === 'edit' || prev === '1' || prev === '0');
      const nextRaw = shouldReplace
        ? value
        : prev === '0'
          ? value
          : `${prev}${value}`;
      return capToStock(normalizeBuffer(nextRaw));
    });
    setIsFreshInput(false);
  };

  const handleConfirm = () => {
    if (maxStock === 0) {
      triggerStockError('Out of stock');
      return;
    }

    const parsed = Number.parseFloat(inputBuffer);
    const safeQty = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    if (safeQty > maxStock) {
      triggerStockError(`Only ${maxStock} in stock`);
      onConfirm(maxStock);
      return;
    }
    onConfirm(safeQty);
  };

  const currentQty = useMemo(() => {
    const parsed = Number.parseFloat(inputBuffer);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [inputBuffer]);

  useEffect(() => {
    if (!mounted) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if (event.key >= '0' && event.key <= '9') {
        event.preventDefault();
        handleInput(event.key);
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        handleInput('backspace');
        return;
      }

      if (event.key === '.' && allowDecimal) {
        event.preventDefault();
        handleInput('.');
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        handleConfirm();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allowDecimal, handleConfirm, handleInput, mounted, onCancel]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Item staging"
    >
      <div
        className="relative flex h-[650px] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:border-slate-500 hover:text-white"
          aria-label="Close staging modal"
        >
          <X className="h-4 w-4" />
        </button>
        <section className="flex w-1/2 flex-col border-r border-slate-800 bg-slate-950">
          <div className="border-b border-slate-800 px-8 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Item Staging
            </p>
            <p className="text-sm text-slate-300">
              Confirm quantity before adding to cart
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex h-full flex-col justify-center">
              <StagingInfo product={product} currentQty={currentQty} />
            </div>
          </div>
        </section>
        <section className="flex w-1/2 flex-col bg-slate-900/40">
          <div className="flex-1 overflow-y-auto p-8">
            <div className="flex h-full flex-col justify-center">
              <StagingNumpad
                value={inputBuffer}
                onInput={handleInput}
                onConfirm={handleConfirm}
                onCancel={onCancel}
                mode={mode}
                errorMessage={stockError}
              />
              {mode === 'edit' && onRemove ? (
                <button
                  type="button"
                  onClick={onRemove}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:text-red-100"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove from Cart
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
