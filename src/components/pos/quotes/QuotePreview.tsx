'use client';

import { useEffect } from 'react';
import { ArrowRightCircle, FileText, Printer } from 'lucide-react';

export type QuotePreviewItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type QuotePreviewData = {
  id: string;
  reference?: string;
  createdAt?: string;
  customerName?: string | null;
  items: QuotePreviewItem[];
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
};

type QuotePreviewProps = {
  quote: QuotePreviewData | null;
  isLoading?: boolean;
  error?: string | null;
  onConvert?: (quote: QuotePreviewData) => void;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDate = (value?: string) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const buildReference = (quote: QuotePreviewData) => {
  if (quote.reference && quote.reference.trim()) {
    return quote.reference;
  }

  const trimmedId = quote.id.trim();
  if (!trimmedId) return '#QT-0000';
  return `#QT-${trimmedId.slice(-4).toUpperCase()}`;
};

export function QuotePreview({
  quote,
  isLoading = false,
  error,
  onConvert,
}: QuotePreviewProps) {
  useEffect(() => {
    document.body.classList.add('print-root');
    return () => {
      document.body.classList.remove('print-root');
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleConvert = () => {
    if (quote) {
      onConvert?.(quote);
    }
  };

  const isActionDisabled = !quote;

  return (
    <div className="flex h-full flex-col gap-4">
      <style>{`
        @media print {
          body > * {
            display: none !important;
          }
          body.print-root > * {
            display: block !important;
          }
          .print-area,
          print-area {
            display: block !important;
          }
          header,
          aside,
          .quote-list-panel,
          .quote-toolbar,
          .quote-status,
          .quote-placeholder {
            display: none !important;
          }
          .quote-preview-card {
            border: none !important;
            box-shadow: none !important;
            max-width: none !important;
            width: 100% !important;
          }
        }
      `}</style>
      <div className="quote-toolbar flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <FileText className="h-4 w-4 text-slate-400" />
          <span>Quotation Preview</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            disabled={isActionDisabled}
            className={`flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 ${
              isActionDisabled ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleConvert}
            disabled={isActionDisabled}
            className={`flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 ${
              isActionDisabled ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            <ArrowRightCircle className="h-4 w-4" />
            Convert to Sale
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!quote ? (
          <div className="quote-placeholder flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-800 bg-slate-900 px-6 py-16 text-center text-sm text-slate-400">
            <FileText className="h-8 w-8 text-slate-600" />
            <p>Select a quote to preview the document.</p>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-4">
            {isLoading ? (
              <div className="quote-status rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
                Loading latest quote details...
              </div>
            ) : null}
            {error ? (
              <div className="quote-status rounded-lg border border-amber-900/50 bg-amber-900/20 px-4 py-3 text-xs text-amber-400">
                {error}
              </div>
            ) : null}
            <div className="flex-1 min-h-0">
              <div className="flex h-full justify-center">
                <article className="print-area quote-preview-card w-full max-w-3xl min-h-[720px] rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Estimate / Quotation
                      </div>
                      <h1 className="mt-2 text-2xl font-semibold text-slate-100">
                        ESTIMATE / QUOTATION
                      </h1>
                    </div>
                    <div className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {buildReference(quote)}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 sm:grid-cols-[1.2fr,0.8fr]">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Customer
                      </div>
                      <div className="mt-2 text-lg font-semibold text-slate-100">
                        {quote.customerName?.trim()
                          ? quote.customerName
                          : 'Guest'}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Quote Ref</span>
                        <span className="font-mono text-slate-200">
                          {buildReference(quote)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span>Date</span>
                        <span className="text-slate-200">
                          {formatDate(quote.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Line Items
                    </div>
                    {quote.items.length === 0 ? (
                      <div className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950 px-4 py-6 text-center text-xs text-slate-400">
                        No line items added yet.
                      </div>
                    ) : (
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-800">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-950 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Item</th>
                              <th className="px-4 py-3 text-right">Qty</th>
                              <th className="px-4 py-3 text-right">Price</th>
                              <th className="px-4 py-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {quote.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3 font-medium text-slate-100">
                                  {item.name}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-400">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-400">
                                  {formatCurrency(item.unitPrice)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-100">
                                  {formatCurrency(item.total)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-end">
                    <div className="w-full max-w-xs space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Subtotal</span>
                        <span className="font-semibold text-slate-100">
                          {formatCurrency(quote.subTotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tax</span>
                        <span className="font-semibold text-slate-100">
                          {formatCurrency(quote.taxTotal)}
                        </span>
                      </div>
                      {quote.discountTotal > 0 ? (
                        <div className="flex items-center justify-between text-red-400">
                          <span>Discount</span>
                          <span className="font-semibold">
                            -{formatCurrency(quote.discountTotal)}
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between border-t border-dashed border-slate-800 pt-2 text-base font-semibold text-slate-100">
                        <span>Grand Total</span>
                        <span>{formatCurrency(quote.grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-dashed border-slate-800 pt-4 text-xs italic text-slate-500">
                    Prices valid for 7 days. This is not a tax invoice.
                  </div>
                </article>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
