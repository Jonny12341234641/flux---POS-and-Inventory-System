'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Barcode from 'react-barcode';
import { Search } from 'lucide-react';

import { ClockInModal } from '../../components/pos/ClockInModal';
import { ProductCard } from '../../components/pos/ProductCard';
import { PosCart } from '../../components/pos/PosCart';
import { ItemStagingModal } from '../../components/pos/staging/ItemStagingModal';
import { Modal } from '../../components/ui/modal';
import type {
  CartItem,
  Category,
  Customer,
  Product,
  Sale,
  ShiftSession,
} from '../../types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const formatCurrency = (value: number) => currencyFormatter.format(value);

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const resolveTaxRate = (value: unknown, fallback: number) => {
  const parsed = parseNumber(value, Number.NaN);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  const fallbackParsed = parseNumber(fallback, 0);
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
};

const extractDefaultTaxRate = (data: unknown) => {
  if (!data || typeof data !== 'object') {
    return 0;
  }

  const record = data as Record<string, unknown>;
  const payload =
    (record.data as Record<string, unknown> | undefined) ??
    (record.settings as Record<string, unknown> | undefined) ??
    record;

  const isEnabled = payload.tax_enabled ?? payload.taxEnabled ?? true;
  if (isEnabled === false) return 0;

  return parseNumber(
    payload.default_tax_rate ??
      payload.tax_rate ??
      payload.defaultTaxRate ??
      payload.taxRate,
    0
  );
};

const extractList = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) {
      return record.data as T[];
    }
    if (Array.isArray(record.products)) {
      return record.products as T[];
    }
    if (Array.isArray(record.categories)) {
      return record.categories as T[];
    }
    if (Array.isArray(record.customers)) {
      return record.customers as T[];
    }
  }

  return [];
};

export default function POSPage() {
  const [productQuery, setProductQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductLoading, setIsProductLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('all');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [stagingItem, setStagingItem] = useState<{
    product: Product;
    quantity: number;
    mode: 'add' | 'edit';
  } | null>(null);
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);

  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [isCustomerLoading, setIsCustomerLoading] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [customerSaveError, setCustomerSaveError] = useState<string | null>(
    null
  );
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(null);
  const [isShiftLoading, setIsShiftLoading] = useState(false);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [endingCash, setEndingCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [closeShiftError, setCloseShiftError] = useState<string | null>(null);

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSale, setDraftSale] = useState<Sale | null>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);

  const loadCurrentShift = async (signal?: AbortSignal) => {
    setIsShiftLoading(true);
    try {
      const response = await fetch('/api/shifts', {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error('Failed to load shift status');
      }

      const data = await response.json();
      if (!signal?.aborted) {
        setCurrentShift((data?.data as ShiftSession | null) ?? null);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to load shift status', error);
      if (!signal?.aborted) {
        setCurrentShift(null);
      }
    } finally {
      if (!signal?.aborted) {
        setIsShiftLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!controller.signal.aborted) {
          setDefaultTaxRate(extractDefaultTaxRate(data));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    };

    fetchSettings();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadCurrentShift(controller.signal);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!currentShift && !isShiftLoading) {
      setIsClockInModalOpen(true);
    }
  }, [currentShift, isShiftLoading]);

  const fetchCategories = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/inventory/categories', {
        cache: 'no-store',
        signal,
      });

      if (!response.ok) {
        throw new Error('Failed to load categories');
      }

      const data = await response.json();
      if (!signal?.aborted) {
        setCategories(extractList<Category>(data));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to load categories', error);
      if (!signal?.aborted) {
        setCategories([]);
      }
    }
  };

  const fetchProducts = async (signal?: AbortSignal) => {
    setIsProductLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        query: productQuery.trim(),
      });

      const response = await fetch(
        `/api/inventory/products?${params.toString()}`,
        { signal }
      );

      if (!response.ok) {
        throw new Error('Failed to load products');
      }

      const data = await response.json();
      const list = extractList<Product>(data);
      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
      if (!signal?.aborted) {
        setProducts(sorted);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Failed to load products', error);
      if (!signal?.aborted) {
        setProducts([]);
      }
    } finally {
      if (!signal?.aborted) {
        setIsProductLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal);

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      fetchProducts(controller.signal);
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [productQuery]);

  useEffect(() => {
    const trimmed = customerQuery.trim();
    if (!trimmed) {
      setCustomerResults([]);
      setIsCustomerLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsCustomerLoading(true);
      try {
        const params = new URLSearchParams({
          query: trimmed,
          limit: '6',
        });

        const response = await fetch(`/api/customers?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to search customers');
        }

        const data = await response.json();
        const list = extractList<Customer>(data);
        const sorted = [...list].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        if (!controller.signal.aborted) {
          setCustomerResults(sorted);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to search customers', error);
        if (!controller.signal.aborted) {
          setCustomerResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCustomerLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [customerQuery]);

  const filteredProducts = useMemo(() => {
    const trimmedQuery = productQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        activeCategoryId === 'all' || product.category_id === activeCategoryId;

      if (!matchesCategory) {
        return false;
      }

      if (!trimmedQuery) {
        return true;
      }

      const nameMatch = product.name.toLowerCase().includes(trimmedQuery);
      const barcodeMatch = product.barcode
        ? product.barcode.toLowerCase().includes(trimmedQuery)
        : false;

      return nameMatch || barcodeMatch;
    });
  }, [products, activeCategoryId, productQuery]);

  const calculateLine = (item: CartItem) => {
    const quantity = parseNumber(item.quantity, 0);
    const unitPrice = parseNumber(item.product.price, 0);
    const subTotal = unitPrice * quantity;
    const discountPercent = clampNumber(
      parseNumber(item.discount_percent, 0),
      0,
      100
    );
    const discountAmount = Math.min(
      subTotal,
      (subTotal * discountPercent) / 100
    );
    const taxRate = resolveTaxRate(item.product.tax_rate, defaultTaxRate);
    const taxableAmount = Math.max(subTotal - discountAmount, 0);
    const taxAmount = taxRate > 0 ? taxableAmount * taxRate : 0;
    const total = taxableAmount + taxAmount;

    return {
      quantity,
      unitPrice,
      subTotal,
      discountPercent,
      discountAmount,
      taxAmount,
      total,
      taxableAmount,
    };
  };

  const cartSummary = useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        const { quantity, subTotal, discountAmount, taxAmount } =
          calculateLine(item);

        acc.subTotal += subTotal;
        acc.tax += taxAmount;
        acc.discount += discountAmount;
        acc.itemCount += quantity;

        return acc;
      },
      { subTotal: 0, tax: 0, discount: 0, itemCount: 0 }
    );
  }, [cart, defaultTaxRate]);

  const grandTotal = Math.max(
    cartSummary.subTotal + cartSummary.tax - cartSummary.discount,
    0
  );

  const handleSelectProduct = (product: Product) => {
    setStagingItem({ product, quantity: 1, mode: 'add' });
  };

  const handleConfirmStaging = (quantity: number) => {
    if (!stagingItem || quantity <= 0) {
      setStagingItem(null);
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === stagingItem.product.id
      );

      if (!existing) {
        return [
          ...prev,
          {
            product: stagingItem.product,
            quantity,
            discount_percent: 0,
          },
        ];
      }

      if (stagingItem.mode === 'edit') {
        return prev.map((item) =>
          item.product.id === stagingItem.product.id
            ? { ...item, quantity }
            : item
        );
      }

      return prev.map((item) =>
        item.product.id === stagingItem.product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    });

    setStagingItem(null);
  };

  const handleEditItem = (item: CartItem) => {
    setStagingItem({
      product: item.product,
      quantity: item.quantity,
      mode: 'edit',
    });
  };

  const handleRemoveStagedItem = () => {
    if (!stagingItem) return;
    setCart((prev) =>
      prev.filter((item) => item.product.id !== stagingItem.product.id)
    );
    setStagingItem(null);
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev.flatMap((item) => {
        if (item.product.id !== productId) {
          return item;
        }

        if (quantity <= 0) {
          return [];
        }

        return [{ ...item, quantity }];
      })
    );
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerQuery('');
    setCustomerResults([]);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerQuery('');
    setCustomerResults([]);
  };

  const openCustomerModal = () => {
    setCustomerSaveError(null);
    setIsCustomerModalOpen(true);
  };

  const handleCreateCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCustomerSaveError(null);

    const name = newCustomer.name.trim();
    const phone = newCustomer.phone.trim();

    if (!name || !phone) {
      setCustomerSaveError('Name and phone are required.');
      return;
    }

    setIsSavingCustomer(true);
    try {
      const payload = {
        name,
        phone,
        email: newCustomer.email.trim() || undefined,
        address: newCustomer.address.trim() || undefined,
      };

      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }

      if (data?.data) {
        setSelectedCustomer(data.data as Customer);
      }

      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      setCustomerQuery('');
      setCustomerResults([]);
      setIsCustomerModalOpen(false);
    } catch (error) {
      console.error(error);
      setCustomerSaveError(
        error instanceof Error ? error.message : 'Failed to create customer'
      );
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const buildSaleItems = () =>
    cart
      .map((item) => {
        const { quantity, unitPrice, discountAmount, taxAmount } =
          calculateLine(item);

        return {
          product_id: item.product.id,
          quantity,
          unit_price: unitPrice,
          discount: discountAmount,
          tax_amount: taxAmount,
        };
      })
      .filter((item) => item.quantity > 0);

  const openCloseShiftModal = () => {
    setCloseShiftError(null);
    setEndingCash('');
    setClosingNotes('');
    setIsCloseShiftModalOpen(true);
  };

  const handleCloseShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCloseShiftError(null);

    if (!currentShift) return;

    const parsedEndingCash = parseNumber(endingCash, Number.NaN);
    if (!Number.isFinite(parsedEndingCash) || parsedEndingCash < 0) {
      setCloseShiftError('Ending cash must be a non-negative number.');
      return;
    }

    setIsClosingShift(true);
    try {
      const res = await fetch(`/api/shifts/${currentShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ending_cash: parsedEndingCash,
          notes: closingNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to close shift');
      }

      window.alert('Shift closed successfully');
      setCurrentShift(null);
      setCart([]);
      setSelectedCustomer(null);
      setCustomerQuery('');
      setCustomerResults([]);
      setIsCloseShiftModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to close shift';
      setCloseShiftError(message);
    } finally {
      setIsClosingShift(false);
    }
  };

  const handleOpenShift = async (startingCash: number) => {
    const parsedStartingCash = parseNumber(startingCash, Number.NaN);
    if (!Number.isFinite(parsedStartingCash) || parsedStartingCash < 0) {
      throw new Error('Starting cash must be a non-negative number.');
    }

    setIsOpeningShift(true);
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starting_cash: parsedStartingCash }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to open shift');
      }

      setCurrentShift((data?.data as ShiftSession | null) ?? null);
      setIsClockInModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to open shift';

      if (
        message.toLowerCase().includes('open shift') &&
        message.toLowerCase().includes('already')
      ) {
        await loadCurrentShift();
        setIsClockInModalOpen(false);
        return;
      }

      throw new Error(message);
    } finally {
      setIsOpeningShift(false);
    }
  };

  const ensureOpenShift = () => {
    if (currentShift) {
      return true;
    }

    setIsClockInModalOpen(true);
    return false;
  };

  const handleCheckout = async () => {
    if (isCheckingOut || isSavingDraft) return;

    const items = buildSaleItems();
    if (!items.length) return;
    if (!ensureOpenShift()) return;

    setIsCheckingOut(true);
    try {
      const payload = {
        items,
        payment_method: 'cash',
        amount_paid: grandTotal,
        discount_total: 0,
        customer_id: selectedCustomer?.id ?? null,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Checkout failed');
      }

      window.alert('Sale processed successfully!');
      setCart([]);
      setSelectedCustomer(null);
      setCustomerQuery('');
      setCustomerResults([]);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Checkout failed';
      if (message.toLowerCase().includes('no open shift')) {
        setIsClockInModalOpen(true);
        return;
      }
      window.alert(message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleSaveDraft = async () => {
    if (isSavingDraft || isCheckingOut) return;

    const items = buildSaleItems();
    if (!items.length) return;

    setIsSavingDraft(true);
    try {
      const payload = {
        items,
        payment_method: 'cash',
        amount_paid: grandTotal,
        discount_total: 0,
        customer_id: selectedCustomer?.id ?? null,
        status: 'draft',
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Draft save failed');
      }

      const draft = (await res.json()) as Sale;
      setDraftSale(draft);
      setIsDraftModalOpen(true);
      setCart([]);
      setSelectedCustomer(null);
      setCustomerQuery('');
      setCustomerResults([]);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Draft save failed');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const barcodeValue = draftSale?.receipt_number || draftSale?.id;
  const categoryTabs = useMemo(
    () => [{ id: 'all', name: 'All' }, ...categories],
    [categories]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClockIn={handleOpenShift}
        loading={isOpeningShift}
        onClose={() => setIsClockInModalOpen(false)}
      />

      {!currentShift ? (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-semibold text-white">
              Clock in to start selling
            </h1>
            <p className="text-sm text-slate-400">
              Open a shift to unlock the sales dashboard and begin ringing
              orders.
            </p>
            <button
              type="button"
              onClick={() => setIsClockInModalOpen(true)}
              disabled={isShiftLoading}
              className="rounded-lg bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isShiftLoading ? 'Checking...' : 'Clock In'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex min-h-screen flex-col lg:flex-row">
          <div className="flex-1">
            <div className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative w-full max-w-xl">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      value={productQuery}
                      onChange={(event) => setProductQuery(event.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                      Shift Open
                    </span>
                    <button
                      type="button"
                      onClick={openCloseShiftModal}
                      className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:border-red-400 hover:text-red-100"
                    >
                      Close Shift
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {categoryTabs.map((category) => {
                    const isActive = activeCategoryId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setActiveCategoryId(category.id)}
                        className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                          isActive
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 lg:p-6">
              {isProductLoading ? (
                <p className="text-sm text-slate-400">Loading products...</p>
              ) : null}
              {!isProductLoading && filteredProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-12 text-center text-sm text-slate-500">
                  No products found. Try adjusting your search or category.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onSelect={handleSelectProduct}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="w-full border-t border-slate-800 bg-slate-950 lg:w-96 lg:border-l lg:border-t-0">
            <PosCart
              items={cart}
              onRemove={handleRemoveFromCart}
              onUpdateQuantity={handleUpdateQuantity}
              onEditItem={handleEditItem}
              onPay={handleCheckout}
              onHold={handleSaveDraft}
              taxRate={defaultTaxRate}
              customerQuery={customerQuery}
              customerResults={customerResults}
              selectedCustomer={selectedCustomer}
              isCustomerLoading={isCustomerLoading}
              onCustomerQueryChange={setCustomerQuery}
              onSelectCustomer={handleSelectCustomer}
              onClearCustomer={clearCustomer}
              onAddCustomer={openCustomerModal}
            />
          </div>
        </div>
      )}

      {stagingItem ? (
        <ItemStagingModal
          product={stagingItem.product}
          initialQty={stagingItem.quantity}
          mode={stagingItem.mode}
          onConfirm={handleConfirmStaging}
          onCancel={() => setStagingItem(null)}
          onRemove={
            stagingItem.mode === 'edit' ? handleRemoveStagedItem : undefined
          }
        />
      ) : null}

      <Modal
        isOpen={isCloseShiftModalOpen}
        onClose={() => setIsCloseShiftModalOpen(false)}
        title="Close Shift"
      >
        <form className="space-y-4" onSubmit={handleCloseShift}>
          <p className="text-sm text-slate-400">
            Enter the final cash amount to close the current shift.
          </p>
          <div>
            <label className="text-sm font-medium text-slate-300">
              Ending Cash
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={endingCash}
              onChange={(event) => setEndingCash(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">
              Notes (Optional)
            </label>
            <textarea
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              rows={3}
              placeholder="Any discrepancies or remarks..."
            />
          </div>
          {closeShiftError ? (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {closeShiftError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCloseShiftModalOpen(false)}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isClosingShift}
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClosingShift ? 'Closing...' : 'Close Shift'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        title="Add Customer"
      >
        <form className="space-y-4" onSubmit={handleCreateCustomer}>
          <div>
            <label className="text-sm font-medium text-slate-300">Name</label>
            <input
              type="text"
              value={newCustomer.name}
              onChange={(event) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Phone</label>
            <input
              type="tel"
              value={newCustomer.phone}
              onChange={(event) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(event) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">
              Address
            </label>
            <textarea
              value={newCustomer.address}
              onChange={(event) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  address: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              rows={3}
            />
          </div>
          {customerSaveError ? (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {customerSaveError}
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingCustomer}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingCustomer ? 'Saving...' : 'Save Customer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        title="Draft Saved"
      >
        {draftSale ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
                Draft Bill
              </div>
              <div className="mt-2 text-lg font-semibold text-zinc-900">
                {draftSale.receipt_number}
              </div>
              <div className="text-xs text-zinc-500">
                {new Date(draftSale.created_at).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center">
              {barcodeValue ? (
                <Barcode value={barcodeValue} height={64} displayValue={false} />
              ) : (
                <div className="text-sm text-zinc-500">
                  Barcode unavailable.
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-sm text-zinc-600">
              <span>Draft Total</span>
              <span className="font-semibold text-zinc-900">
                {formatCurrency(draftSale.grand_total)}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-600">Draft saved.</div>
        )}
      </Modal>
    </div>
  );
}
