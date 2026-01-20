'use client';

import { useMemo, useState } from 'react';
import { Calendar, Package, Receipt, User } from 'lucide-react';

import type { Product, SaleItem, SaleWithDetails } from '../../../types';
import {
  ReturnModeToggle,
  type ReturnMode,
} from '../../../components/pos/returns/ReturnModeToggle';
import { ReturnSearch } from '../../../components/pos/returns/ReturnSearch';
import {
  ReturnItemRow,
  type ReturnCondition,
  type ReturnItemRowItem,
  type ReturnItemUpdate,
} from '../../../components/pos/returns/ReturnItemRow';
import { RefundSummary } from '../../../components/pos/returns/RefundSummary';

type ReceiptRecord = SaleWithDetails & {
  receipt_number?: string | null;
  total_amount?: number;
  customer?: { name?: string | null } | null;
};

type RawOrderDetails = SaleWithDetails & {
  receipt_number?: string | null;
  total_amount?: number;
  items?: Array<{
    id?: string;
    product_id?: string;
    product_name?: string | null;
    quantity?: number;
    unit_price?: number;
    total?: number;
    product?: { name?: string | null } | null;
  }>;
  sale_items?: SaleItem[];
  cashier?: { full_name?: string | null; name?: string | null } | null;
  customer?: { name?: string | null } | null;
};

type ReceiptSummary = {
  id: string;
  receiptNumber: string;
  createdAt?: string;
  customerName?: string | null;
  grandTotal: number;
};

type OrderSummary = {
  id: string;
  receiptNumber: string;
  createdAt?: string;
  customerName?: string | null;
  cashierName?: string | null;
};

type ReturnLineItem = ReturnItemRowItem & {
  productId?: string;
  saleItemId?: string;
  returnQty: number;
  refundPrice: number;
  condition: ReturnCondition;
  source: ReturnMode;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDateTime = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractSales = (data: unknown): ReceiptRecord[] => {
  if (Array.isArray(data)) {
    return data as ReceiptRecord[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.sales) && record.sales) ||
      (Array.isArray(record.receipts) && record.receipts);

    if (Array.isArray(list)) {
      return list as ReceiptRecord[];
    }
  }

  return [];
};

const extractProducts = (data: unknown): Product[] => {
  if (Array.isArray(data)) {
    return data as Product[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as Product[];
    }
  }

  return [];
};

const extractOrderDetails = (payload: unknown): RawOrderDetails | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.data && typeof record.data === 'object') {
    return record.data as RawOrderDetails;
  }

  return record as RawOrderDetails;
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

const buildReceiptSummary = (record: ReceiptRecord): ReceiptSummary => {
  const receiptId = typeof record.id === 'string' ? record.id : 'unknown';
  const receiptNumber =
    typeof record.receipt_number === 'string' && record.receipt_number.trim()
      ? record.receipt_number
      : receiptId;

  return {
    id: receiptId,
    receiptNumber,
    createdAt: record.created_at,
    customerName: record.customer?.name ?? null,
    grandTotal: parseNumber(record.grand_total ?? record.total_amount, 0),
  };
};

const buildOrderSummary = (raw: RawOrderDetails): OrderSummary => {
  const orderId = typeof raw.id === 'string' ? raw.id : 'unknown';
  const receiptNumber =
    typeof raw.receipt_number === 'string' && raw.receipt_number.trim()
      ? raw.receipt_number
      : orderId;

  return {
    id: orderId,
    receiptNumber,
    createdAt: raw.created_at,
    customerName: raw.customer?.name ?? null,
    cashierName: raw.cashier?.full_name ?? raw.cashier?.name ?? null,
  };
};

const buildReturnItemsFromOrder = (
  raw: RawOrderDetails
): ReturnLineItem[] => {
  const orderId = typeof raw.id === 'string' ? raw.id : 'unknown';
  const itemsSource = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.sale_items)
      ? raw.sale_items
      : [];

  return itemsSource.map((item, index) => {
    const record = item as Record<string, unknown>;
    const quantity = parseNumber(record.quantity, 0);
    const unitPrice = parseNumber(record.unit_price, 0);
    const name = resolveItemName(record);
    const saleItemId =
      typeof record.id === 'string' ? record.id : `${orderId}-item-${index}`;
    const productId =
      typeof record.product_id === 'string' ? record.product_id : undefined;

    return {
      id: saleItemId,
      name,
      unitPrice,
      maxQty: quantity,
      returnQty: 0,
      refundPrice: unitPrice,
      condition: 'restock',
      productId,
      saleItemId,
      source: 'receipt',
    };
  });
};

export default function ReturnsPage() {
  const [mode, setMode] = useState<ReturnMode>('receipt');
  const [searchQuery, setSearchQuery] = useState('');

  const [receiptResults, setReceiptResults] = useState<ReceiptSummary[]>([]);
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(
    null
  );
  const [originalOrder, setOriginalOrder] = useState<OrderSummary | null>(null);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [returnItems, setReturnItems] = useState<ReturnLineItem[]>([]);

  const refundTotal = useMemo(
    () =>
      returnItems.reduce(
        (sum, item) => sum + item.returnQty * item.refundPrice,
        0
      ),
    [returnItems]
  );

  const resetState = (nextMode: ReturnMode) => {
    setMode(nextMode);
    setSearchQuery('');
    setReceiptResults([]);
    setProductResults([]);
    setIsSearching(false);
    setSearchError(null);
    setSelectedReceiptId(null);
    setOriginalOrder(null);
    setIsOrderLoading(false);
    setOrderError(null);
    setReturnItems([]);
  };

  const handleModeChange = (nextMode: ReturnMode) => {
    if (nextMode === mode) return;
    resetState(nextMode);
  };

  const handleSearchReceipt = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    setReceiptResults([]);
    setSelectedReceiptId(null);
    setOriginalOrder(null);
    setReturnItems([]);
    setOrderError(null);

    try {
      const response = await fetch(
        `/api/sales?query=${encodeURIComponent(query)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to search receipts (status ${response.status}).`
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
          (data as { error?: string }).error ?? 'Failed to search receipts.'
        );
      }

      const receipts = extractSales(data);
      const normalizedQuery = query.trim().toLowerCase();
      const filtered = normalizedQuery
        ? receipts.filter((receipt) => {
            const receiptNumber =
              typeof receipt.receipt_number === 'string'
                ? receipt.receipt_number
                : receipt.id;
            const customerName = receipt.customer?.name ?? '';
            return (
              receiptNumber.toLowerCase().includes(normalizedQuery) ||
              receipt.id.toLowerCase().includes(normalizedQuery) ||
              customerName.toLowerCase().includes(normalizedQuery)
            );
          })
        : receipts;

      setReceiptResults(filtered.map(buildReceiptSummary));
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : 'Failed to search receipts.'
      );
      setReceiptResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchProduct = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    setProductResults([]);

    try {
      const response = await fetch(
        `/api/inventory/products?query=${encodeURIComponent(query)}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to search inventory (status ${response.status}).`
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
          (data as { error?: string }).error ?? 'Failed to search inventory.'
        );
      }

      setProductResults(extractProducts(data));
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : 'Failed to search inventory.'
      );
      setProductResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectReceipt = async (receipt: ReceiptSummary) => {
    setSelectedReceiptId(receipt.id);
    setOriginalOrder(null);
    setReturnItems([]);
    setOrderError(null);
    setIsOrderLoading(true);

    try {
      const response = await fetch(`/api/sales/${receipt.id}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load receipt details (status ${response.status}).`
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
            'Failed to load receipt details.'
        );
      }

      const details = extractOrderDetails(data);
      if (!details) {
        throw new Error('Receipt details unavailable.');
      }

      setOriginalOrder(buildOrderSummary(details));
      setReturnItems(buildReturnItemsFromOrder(details));
    } catch (error) {
      setOrderError(
        error instanceof Error
          ? error.message
          : 'Failed to load receipt details.'
      );
      setOriginalOrder(null);
      setReturnItems([]);
    } finally {
      setIsOrderLoading(false);
    }
  };

  const handleClearReceipt = () => {
    setSelectedReceiptId(null);
    setOriginalOrder(null);
    setReturnItems([]);
    setOrderError(null);
    setIsOrderLoading(false);
  };

  const handleAddProduct = (product: Product) => {
    setReturnItems((prev) => {
      const existing = prev.find(
        (item) => item.source === 'manual' && item.productId === product.id
      );

      if (existing) {
        return prev.map((item) => {
          if (item.id !== existing.id) return item;
          return {
            ...item,
            returnQty: item.returnQty + 1,
          };
        });
      }

      return [
        ...prev,
        {
          id: `manual-${product.id}`,
          name: product.name,
          sku: product.barcode,
          unitPrice: product.price,
          unit: product.unit,
          returnQty: 1,
          refundPrice: product.price,
          condition: 'restock',
          productId: product.id,
          source: 'manual',
        },
      ];
    });
  };

  const handleItemChange = (itemId: string, update: ReturnItemUpdate) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const nextQty =
          typeof update.returnQty === 'number'
            ? update.returnQty
            : item.returnQty;
        const maxQty =
          typeof item.maxQty === 'number' && Number.isFinite(item.maxQty)
            ? item.maxQty
            : null;
        const resolvedQty =
          maxQty === null
            ? Math.max(nextQty, 0)
            : Math.min(Math.max(nextQty, 0), maxQty);

        const nextPrice =
          typeof update.refundPrice === 'number'
            ? update.refundPrice
            : item.refundPrice;
        const resolvedPrice = Number.isFinite(nextPrice)
          ? Math.max(nextPrice, 0)
          : 0;

        const nextCondition = update.condition ?? item.condition;

        return {
          ...item,
          returnQty: resolvedQty,
          refundPrice: resolvedPrice,
          condition: nextCondition,
        };
      })
    );
  };

  const handleRefund = (method: 'cash' | 'store_credit') => {
    const refundableItems = returnItems.filter((item) => item.returnQty > 0);
    if (refundableItems.length === 0) return;

    if (mode === 'receipt' && !originalOrder) {
      console.warn('Select a receipt before processing a refund.');
      return;
    }

    const payload = {
      original_sale_id: mode === 'receipt' ? originalOrder?.id ?? null : null,
      refund_method: method,
      refund_total: refundTotal,
      items: refundableItems.map((item) => ({
        product_id: item.productId,
        sale_item_id: item.saleItemId,
        quantity: item.returnQty,
        refund_price: item.refundPrice,
        condition: item.condition,
      })),
    };

    console.log('Return payload', payload);
  };

  const receiptEmptyMessage = searchQuery.trim()
    ? 'No receipts match your search.'
    : 'Search for a receipt to begin a return.';
  const productEmptyMessage = searchQuery.trim()
    ? 'No products match your search.'
    : 'Search inventory to add return items.';

  return (
    <div className="flex flex-col gap-6">
      <ReturnModeToggle mode={mode} onChange={handleModeChange} />
      <ReturnSearch
        mode={mode}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSearchReceipt={handleSearchReceipt}
        onSearchProduct={handleSearchProduct}
        isLoading={isSearching}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          {mode === 'receipt' ? (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Receipt Results
                  </h3>
                  <span className="text-xs text-slate-400">
                    {receiptResults.length} found
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {isSearching ? (
                    <p className="text-sm text-slate-500">
                      Searching receipts...
                    </p>
                  ) : null}

                  {searchError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {searchError}
                    </div>
                  ) : null}

                  {!isSearching &&
                  !searchError &&
                  receiptResults.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      {receiptEmptyMessage}
                    </div>
                  ) : null}

                  {!isSearching &&
                  !searchError &&
                  receiptResults.length > 0 ? (
                    <div className="space-y-3">
                      {receiptResults.map((receipt) => {
                        const isSelected = receipt.id === selectedReceiptId;
                        return (
                          <button
                            key={receipt.id}
                            type="button"
                            onClick={() => handleSelectReceipt(receipt)}
                            className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                              isSelected
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                  Receipt
                                </p>
                                <p className="text-sm font-semibold text-slate-900">
                                  {receipt.receiptNumber}
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(receipt.grandTotal)}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {receipt.customerName ?? 'Walk-in'}
                              </span>
                              <span>{formatDateTime(receipt.createdAt)}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Selected Receipt
                  </h3>
                  {originalOrder ? (
                    <button
                      type="button"
                      onClick={handleClearReceipt}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  {isOrderLoading ? (
                    <p className="text-sm text-slate-500">
                      Loading receipt details...
                    </p>
                  ) : null}

                  {orderError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {orderError}
                    </div>
                  ) : null}

                  {!isOrderLoading && !orderError && !originalOrder ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                      Select a receipt to load returnable items.
                    </div>
                  ) : null}

                  {originalOrder ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                        <span className="flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-emerald-600" />
                          <span className="font-semibold text-slate-900">
                            {originalOrder.receiptNumber}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {formatDateTime(originalOrder.createdAt)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400" />
                          {originalOrder.customerName ?? 'Walk-in'}
                        </span>
                        {originalOrder.cashierName ? (
                          <span>Cashier: {originalOrder.cashierName}</span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Inventory Results
                </h3>
                <span className="text-xs text-slate-400">
                  {productResults.length} found
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {isSearching ? (
                  <p className="text-sm text-slate-500">
                    Searching inventory...
                  </p>
                ) : null}

                {searchError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {searchError}
                  </div>
                ) : null}

                {!isSearching && !searchError && productResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                    {productEmptyMessage}
                  </div>
                ) : null}

                {!isSearching && !searchError && productResults.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Price</th>
                          <th className="px-4 py-3">Stock</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {productResults.map((product) => (
                          <tr key={product.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-slate-900">
                                {product.name}
                              </div>
                              <div className="text-xs text-slate-500">
                                {product.barcode}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {formatCurrency(product.price)}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {product.stock_quantity} {product.unit}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleAddProduct(product)}
                                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300"
                              >
                                <Package className="h-3.5 w-3.5" />
                                Add
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="w-full space-y-4 lg:w-[440px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Return Items
              </h3>
              <span className="text-xs text-slate-400">
                {returnItems.length} item{returnItems.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {returnItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
                  {mode === 'receipt'
                    ? 'Select a receipt to load items.'
                    : 'Add products to start a manual return.'}
                </div>
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 text-xs font-semibold uppercase tracking-wide text-slate-400 md:grid">
                    <span>Item</span>
                    <span>Condition</span>
                    <span>Qty</span>
                    <span>Refund</span>
                    <span className="text-right">Total</span>
                  </div>
                  {returnItems.map((item) => (
                    <ReturnItemRow
                      key={item.id}
                      item={item}
                      isManualMode={mode === 'manual'}
                      returnQty={item.returnQty}
                      refundPrice={item.refundPrice}
                      condition={item.condition}
                      onChange={(update) => handleItemChange(item.id, update)}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          <RefundSummary items={returnItems} onRefund={handleRefund} />
        </div>
      </div>
    </div>
  );
}
