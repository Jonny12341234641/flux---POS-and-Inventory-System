'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

import type { SaleWithDetails } from '../../../types';
import {
  QuoteList,
  type QuoteListItem,
} from '../../../components/pos/quotes/QuoteList';
import {
  QuotePreview,
  type QuotePreviewData,
} from '../../../components/pos/quotes/QuotePreview';

type QuoteRecord = Omit<
  SaleWithDetails,
  'status' | 'payment_method' | 'sale_items'
> & {
  status?: string | null;
  payment_method?: string | null;
  total_amount?: number;
  items?: Array<Record<string, unknown>>;
  sale_items?: Array<Record<string, unknown>>;
  customer?: { name?: string | null } | null;
};

type RawQuoteDetails = QuoteRecord;

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractQuotes = (data: unknown): QuoteRecord[] => {
  if (Array.isArray(data)) {
    return data as QuoteRecord[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.sales) && record.sales) ||
      (Array.isArray(record.receipts) && record.receipts);

    if (Array.isArray(list)) {
      return list as QuoteRecord[];
    }
  }

  return [];
};

const extractQuoteDetails = (payload: unknown): RawQuoteDetails | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.data && typeof record.data === 'object') {
    return record.data as RawQuoteDetails;
  }

  return record as RawQuoteDetails;
};

const resolveItemName = (record: Record<string, unknown>) => {
  const directName =
    typeof record.product_name === 'string' ? record.product_name : '';
  if (directName.trim()) return directName;

  const product = record.product;
  if (product && typeof product === 'object') {
    const productRecord = product as Record<string, unknown>;
    const productName =
      typeof productRecord.name === 'string' ? productRecord.name : '';
    if (productName.trim()) return productName;
  }

  return 'Item';
};

const buildQuotePreview = (raw: RawQuoteDetails): QuotePreviewData => {
  const quoteId = typeof raw.id === 'string' ? raw.id : 'unknown';
  const itemsSource = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.sale_items)
      ? raw.sale_items
      : [];

  const items = itemsSource.map((item, index) => {
    const record = item as Record<string, unknown>;
    const quantity = parseNumber(record.quantity, 0);
    const unitPrice = parseNumber(record.unit_price, 0);
    const totalValue = parseNumber(record.total, Number.NaN);
    const subTotal = parseNumber(record.sub_total, unitPrice * quantity);
    const discount = parseNumber(record.discount, 0);
    const taxAmount = parseNumber(record.tax_amount, 0);
    const total = Number.isFinite(totalValue)
      ? totalValue
      : Math.max(subTotal + taxAmount - discount, 0);

    return {
      id:
        typeof record.id === 'string' ? record.id : `${quoteId}-item-${index}`,
      name: resolveItemName(record),
      quantity,
      unitPrice,
      total,
    };
  });

  const subTotal = parseNumber(raw.sub_total, 0);
  const taxTotal = parseNumber(raw.tax_total, 0);
  const discountTotal = parseNumber(raw.discount_total, 0);
  const fallbackTotal = Math.max(subTotal + taxTotal - discountTotal, 0);
  const grandTotal = parseNumber(
    raw.grand_total ?? raw.total_amount,
    fallbackTotal
  );

  return {
    id: quoteId,
    reference:
      typeof raw.receipt_number === 'string' && raw.receipt_number.trim()
        ? raw.receipt_number
        : undefined,
    createdAt: raw.created_at,
    customerName: raw.customer?.name ?? null,
    items,
    subTotal,
    taxTotal,
    discountTotal,
    grandTotal,
  };
};

const buildListItem = (quote: QuoteRecord): QuoteListItem => {
  const quoteId = typeof quote.id === 'string' ? quote.id : 'unknown';
  const subTotal = parseNumber(quote.sub_total, 0);
  const taxTotal = parseNumber(quote.tax_total, 0);
  const discountTotal = parseNumber(quote.discount_total, 0);
  const fallbackTotal = Math.max(subTotal + taxTotal - discountTotal, 0);
  const total = parseNumber(quote.grand_total ?? quote.total_amount, fallbackTotal);

  return {
    id: quoteId,
    createdAt: quote.created_at,
    customerName: quote.customer?.name ?? null,
    total,
  };
};

const isQuoteStatus = (status: unknown) =>
  typeof status === 'string' && status.toLowerCase() === 'quote';

export default function QuotesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const selectedQuote = useMemo(
    () => quotes.find((quote) => quote.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId]
  );

  const [previewQuote, setPreviewQuote] = useState<QuotePreviewData | null>(
    null
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadQuotes = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/sales?status=quote', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load quotes (status ${response.status}).`
          );
        }

        const data = await response.json();
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          (data as { success?: boolean; error?: string }).success === false
        ) {
          throw new Error(
            (data as { error?: string }).error ?? 'Failed to load quotes.'
          );
        }

        if (!controller.signal.aborted) {
          const sales = extractQuotes(data);
          setQuotes(sales.filter((sale) => isQuoteStatus(sale.status)));
        }
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load quotes.'
          );
          setQuotes([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadQuotes();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (!selectedQuote) {
      setPreviewQuote(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return () => controller.abort();
    }

    setPreviewQuote(buildQuotePreview(selectedQuote));
    setPreviewError(null);

    const loadDetails = async () => {
      setIsPreviewLoading(true);

      try {
        const response = await fetch(`/api/sales/${selectedQuote.id}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load quote details (status ${response.status}).`
          );
        }

        const data = await response.json();
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          (data as { success?: boolean; error?: string }).success === false
        ) {
          throw new Error(
            (data as { error?: string }).error ??
              'Failed to load quote details.'
          );
        }

        const details = extractQuoteDetails(data);
        if (!details) {
          throw new Error('Quote details unavailable.');
        }

        if (!controller.signal.aborted) {
          setPreviewQuote(buildQuotePreview(details));
        }
      } catch (detailError) {
        if (
          detailError instanceof DOMException &&
          detailError.name === 'AbortError'
        ) {
          return;
        }

        if (!controller.signal.aborted) {
          setPreviewError(
            detailError instanceof Error
              ? detailError.message
              : 'Failed to load quote details.'
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsPreviewLoading(false);
        }
      }
    };

    loadDetails();

    return () => controller.abort();
  }, [selectedQuote]);

  const filteredQuotes = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return quotes;
    }

    return quotes.filter((quote) => {
      const quoteId = typeof quote.id === 'string' ? quote.id : '';
      const reference =
        typeof quote.receipt_number === 'string'
          ? quote.receipt_number
          : '';
      const customerName = quote.customer?.name ?? '';

      return (
        quoteId.toLowerCase().includes(normalizedQuery) ||
        reference.toLowerCase().includes(normalizedQuery) ||
        customerName.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [quotes, searchQuery]);

  const listItems = useMemo(
    () => filteredQuotes.map(buildListItem),
    [filteredQuotes]
  );

  const emptyMessage =
    searchQuery.trim().length > 0
      ? 'No quotes match your search.'
      : 'No quotes available yet.';

  const handleConvert = (quote: QuotePreviewData) => {
    localStorage.setItem('pending_quote_id', quote.id);
    router.push('/pos');
  };

  return (
    <div className="quote-page flex h-full min-h-0 flex-col gap-6 lg:flex-row">
      <div className="quote-list-panel flex w-full min-h-0 flex-col gap-4 lg:w-1/3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by Quote ID or Customer"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Quotes</h2>
            <span className="text-xs text-slate-400">
              {listItems.length} total
            </span>
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading quotes...</p>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {!isLoading && !error && listItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
                {emptyMessage}
              </div>
            ) : null}

            {!isLoading && !error && listItems.length > 0 ? (
              <QuoteList
                quotes={listItems}
                selectedId={selectedQuoteId}
                onSelect={setSelectedQuoteId}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col lg:w-2/3">
        <QuotePreview
          quote={previewQuote}
          isLoading={isPreviewLoading}
          error={previewError}
          onConvert={handleConvert}
        />
      </div>
    </div>
  );
}
