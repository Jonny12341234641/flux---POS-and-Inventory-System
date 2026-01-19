'use client';

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

import type { SaleItem, SalePayment, SaleWithDetails } from '../../../types';
import {
  OrderFilters,
  type OrderTab,
} from '../../../components/pos/orders/OrderFilters';
import { OrderCard } from '../../../components/pos/orders/OrderCard';
import {
  OrderPreviewSidebar,
  type OrderPreviewData,
  type OrderPreviewItem,
  type OrderPreviewPayment,
} from '../../../components/pos/orders/OrderPreviewSidebar';

type OrderListItem = SaleWithDetails;

type RawOrderDetails = SaleWithDetails & {
  items?: Array<{
    id?: string;
    product_name?: string | null;
    quantity?: number;
    unit_price?: number;
    total?: number;
    product?: { name?: string | null } | null;
  }>;
  sale_items?: SaleItem[];
  payments?: SalePayment[];
  sale_payments?: SalePayment[];
  total_amount?: number;
  cashier?: { full_name?: string | null; name?: string | null } | null;
  customer?: { name?: string | null } | null;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

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

const resolvePaymentMethod = (
  value: unknown
): OrderPreviewPayment['method'] | undefined => {
  if (
    value === 'cash' ||
    value === 'card' ||
    value === 'bank_transfer' ||
    value === 'split' ||
    value === 'loyalty'
  ) {
    return value;
  }

  return undefined;
};

const extractSales = (data: unknown): OrderListItem[] => {
  if (Array.isArray(data)) {
    return data as OrderListItem[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.sales) && record.sales) ||
      (Array.isArray(record.receipts) && record.receipts);

    if (Array.isArray(list)) {
      return list as OrderListItem[];
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

const buildOrderPreview = (raw: RawOrderDetails): OrderPreviewData => {
  const orderId = typeof raw.id === 'string' ? raw.id : 'unknown';
  const itemsSource = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.sale_items)
      ? raw.sale_items
      : [];

  const items: OrderPreviewItem[] = itemsSource.map((item, index) => {
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
        typeof record.id === 'string' ? record.id : `${orderId}-item-${index}`,
      name: resolveItemName(record),
      quantity,
      unitPrice,
      total,
    };
  });

  const rawPayments = Array.isArray(raw.payments)
    ? raw.payments
    : Array.isArray(raw.sale_payments)
      ? raw.sale_payments
      : [];

  const payments: OrderPreviewPayment[] = rawPayments
    .map((payment, index) => {
      const record = payment as Record<string, unknown>;
      const method = resolvePaymentMethod(record.method);
      if (!method) return null;

      const amount = parseNumber(record.amount, 0);
      if (amount <= 0) return null;

      return {
        id:
          typeof record.id === 'string'
            ? record.id
            : `${orderId}-payment-${index}`,
        method,
        amount,
        referenceId:
          typeof record.reference_id === 'string' ? record.reference_id : null,
      };
    })
    .filter(
      (payment): payment is OrderPreviewPayment => payment !== null
    );

  const subTotal = parseNumber(raw.sub_total, 0);
  const taxTotal = parseNumber(raw.tax_total, 0);
  const discountTotal = parseNumber(raw.discount_total, 0);
  const fallbackTotal = Math.max(subTotal + taxTotal - discountTotal, 0);
  const grandTotal = parseNumber(
    raw.grand_total ?? raw.total_amount,
    fallbackTotal
  );

  return {
    id: orderId,
    receiptNumber:
      typeof raw.receipt_number === 'string' && raw.receipt_number.trim()
        ? raw.receipt_number
        : orderId,
    createdAt: raw.created_at,
    customerName: raw.customer?.name ?? null,
    cashierName:
      raw.cashier?.full_name ?? raw.cashier?.name ?? null,
    status: raw.status,
    items,
    subTotal,
    taxTotal,
    discountTotal,
    grandTotal,
    paymentMethod: resolvePaymentMethod(raw.payment_method),
    amountPaid: parseNumber(raw.amount_paid, grandTotal),
    payments,
  };
};

const getItemCount = (order: OrderListItem) => {
  const items = Array.isArray(order.sale_items)
    ? order.sale_items
    : Array.isArray((order as { items?: SaleItem[] }).items)
      ? (order as { items?: SaleItem[] }).items ?? []
      : [];
  if (items.length === 0) return 0;

  const quantitySum = items.reduce(
    (total, item) => total + parseNumber(item.quantity, 0),
    0
  );

  return quantitySum > 0 ? quantitySum : items.length;
};

const formatPaymentMethod = (method?: string) => {
  if (!method) return 'Unknown';
  if (method === 'bank_transfer') return 'Bank Transfer';
  return `${method.charAt(0).toUpperCase()}${method.slice(1)}`;
};

const formatStatus = (status?: string) => {
  if (!status) return 'Unknown';
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
};

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderTab>('held');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(
    null
  );
  const [previewOrder, setPreviewOrder] = useState<OrderPreviewData | null>(
    null
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedOrder(null);
    setPreviewOrder(null);
    setPreviewError(null);
  }, [activeTab]);

  useEffect(() => {
    const controller = new AbortController();

    if (activeTab === 'debt') {
      setOrders([]);
      setIsLoading(false);
      setError(null);
      return () => controller.abort();
    }

    const loadOrders = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (activeTab === 'held') {
          params.set('status', 'draft');
        } else if (activeTab === 'history') {
          params.set('status', 'completed');
          params.set('limit', '20');
        }

        const url = params.toString()
          ? `/api/sales?${params.toString()}`
          : '/api/sales';
        const response = await fetch(url, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load orders (status ${response.status}).`
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
            (data as { error?: string }).error ?? 'Failed to load orders.'
          );
        }

        if (!controller.signal.aborted) {
          setOrders(extractSales(data));
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
              : 'Failed to load orders.'
          );
          setOrders([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadOrders();

    return () => controller.abort();
  }, [activeTab]);

  useEffect(() => {
    const controller = new AbortController();

    if (!selectedOrder) {
      setPreviewOrder(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return () => controller.abort();
    }

    setPreviewOrder(buildOrderPreview(selectedOrder));
    setPreviewError(null);

    const loadDetails = async () => {
      setIsPreviewLoading(true);

      try {
        const response = await fetch(`/api/sales/${selectedOrder.id}`, {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load order details (status ${response.status}).`
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
              'Failed to load order details.'
          );
        }

        const details = extractOrderDetails(data);
        if (!details) {
          throw new Error('Order details unavailable.');
        }

        if (!controller.signal.aborted) {
          setPreviewOrder(buildOrderPreview(details));
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
              : 'Failed to load order details.'
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
  }, [selectedOrder]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return orders;
    }

    return orders.filter((order) => {
      const receipt =
        typeof order.receipt_number === 'string'
          ? order.receipt_number
          : order.id;
      const customerName = order.customer?.name ?? '';
      return (
        receipt.toLowerCase().includes(normalizedQuery) ||
        customerName.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [orders, searchQuery]);

  const emptyMessage =
    searchQuery.trim().length > 0
      ? 'No orders match your search.'
      : 'No orders found yet.';

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    order: OrderListItem
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedOrder(order);
    }
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1 space-y-6">
        <OrderFilters
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {activeTab === 'debt' ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
            Debt and credit management is coming soon.
          </div>
        ) : null}

        {activeTab === 'held' ? (
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-slate-500">Loading held orders...</p>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {!isLoading && !error && filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
                {emptyMessage}
              </div>
            ) : null}

            {!isLoading && !error && filteredOrders.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    id={order.id}
                    createdAt={order.created_at}
                    customerName={order.customer?.name ?? null}
                    itemCount={getItemCount(order)}
                    total={parseNumber(order.grand_total, 0)}
                    isSelected={selectedOrder?.id === order.id}
                    onSelect={() => setSelectedOrder(order)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-slate-500">
                Loading sales history...
              </p>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Receipt #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!isLoading && !error && filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const receiptLabel =
                        order.receipt_number?.trim() || order.id;
                      const customerName =
                        order.customer?.name ?? 'Walk-in';
                      const totalAmount = parseNumber(order.grand_total, 0);
                      const isSelected = selectedOrder?.id === order.id;

                      return (
                        <tr
                          key={order.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedOrder(order)}
                          onKeyDown={(event) =>
                            handleRowKeyDown(event, order)
                          }
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-4 py-4 font-mono text-xs text-slate-700">
                            {receiptLabel}
                          </td>
                          <td className="px-4 py-4 text-slate-700">
                            {customerName}
                          </td>
                          <td className="px-4 py-4 text-slate-500">
                            {formatDateTime(order.created_at)}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {formatPaymentMethod(order.payment_method)}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {formatStatus(order.status)}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-slate-900">
                            {formatCurrency(totalAmount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <div className="w-full shrink-0 lg:w-96">
        <div className="lg:sticky lg:top-6">
          <OrderPreviewSidebar
            order={previewOrder}
            isLoading={isPreviewLoading}
            error={previewError}
          />
        </div>
      </div>
    </div>
  );
}
