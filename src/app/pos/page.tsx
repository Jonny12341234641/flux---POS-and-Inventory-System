
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Barcode from 'react-barcode';
import {
  ArrowRight,
  Plus,
  Save,
  ScanLine,
  Search,
  Trash2,
  UserPlus,
  UserSearch,
  X,
} from 'lucide-react';

import { Modal } from '../../components/ui/modal';
import type { CartItem, Customer, Product, Sale, ShiftSession } from '../../types';

type PaymentMethod = 'cash' | 'card';

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

  return parseNumber(
    payload.default_tax_rate ??
      payload.tax_rate ??
      payload.defaultTaxRate ??
      payload.taxRate,
    0
  );
};

const generateOrderNumber = () => {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${year}-${suffix}`;
};

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function POSPage() {
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [isProductLoading, setIsProductLoading] = useState(false);

  const [stagedProduct, setStagedProduct] = useState<Product | null>(null);
  const [stagedQuantity, setStagedQuantity] = useState('1');
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
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

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSale, setDraftSale] = useState<Sale | null>(null);
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [orderNumber, setOrderNumber] = useState(() => generateOrderNumber());
  const [currentShift, setCurrentShift] = useState<ShiftSession | null>(null);
  const [isShiftLoading, setIsShiftLoading] = useState(false);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [startingCash, setStartingCash] = useState('0');
  const [shiftError, setShiftError] = useState<string | null>(null);

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
    if (stagedProduct && quantityInputRef.current) {
      quantityInputRef.current.focus();
      quantityInputRef.current.select();
    }
  }, [stagedProduct]);

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
    const trimmed = productQuery.trim();
    if (!trimmed) {
      setProductResults([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsProductLoading(true);
      try {
        const params = new URLSearchParams({
          page: '1',
          query: trimmed,
        });
        const response = await fetch(
          `/api/inventory/products?${params.toString()}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Failed to load products');
        }

        const data = await response.json();
        const list = Array.isArray(data) ? data : data.data || [];
        const sorted = [...list].sort((a: Product, b: Product) =>
          a.name.localeCompare(b.name)
        );
        setProductResults(sorted);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to load products', error);
        setProductResults([]);
      } finally {
        setIsProductLoading(false);
      }
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
        const list = Array.isArray(data) ? data : data.data || [];
        const sorted = [...list].sort((a: Customer, b: Customer) =>
          a.name.localeCompare(b.name)
        );
        setCustomerResults(sorted);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Failed to search customers', error);
        setCustomerResults([]);
      } finally {
        setIsCustomerLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [customerQuery]);

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
    setStagedProduct(product);
    setStagedQuantity('1');
    setProductQuery('');
    setProductResults([]);
  };

  const commitStagedItem = () => {
    if (!stagedProduct) return;

    const quantity = parseNumber(stagedQuantity, 0);
    if (quantity <= 0) {
      return;
    }

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === stagedProduct.id
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === stagedProduct.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [
        ...prev,
        { product: stagedProduct, quantity, discount_percent: 0 },
      ];
    });

    setStagedProduct(null);
    setStagedQuantity('1');
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const parsed = parseNumber(value, 0);
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: parsed }
          : item
      )
    );
  };

  const handleQuantityBlur = (productId: string, value: string) => {
    const parsed = parseNumber(value, 0);
    if (parsed <= 0) {
      handleRemoveFromCart(productId);
    }
  };

  const handleDiscountChange = (productId: string, value: string) => {
    const parsed = clampNumber(parseNumber(value, 0), 0, 100);
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, discount_percent: parsed }
          : item
      )
    );
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerQuery('');
    setCustomerResults([]);
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

  const openClockInModal = () => {
    setShiftError(null);
    setIsClockInModalOpen(true);
  };

  const closeClockInModal = () => {
    setIsClockInModalOpen(false);
    setShiftError(null);
  };

  const ensureOpenShift = () => {
    if (currentShift) {
      return true;
    }

    setShiftError('No open shift found. Please clock in.');
    setIsClockInModalOpen(true);
    return false;
  };

  const handleOpenShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShiftError(null);

    const parsedStartingCash = parseNumber(startingCash, Number.NaN);
    if (!Number.isFinite(parsedStartingCash) || parsedStartingCash < 0) {
      setShiftError('Starting cash must be a non-negative number.');
      return;
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
      closeClockInModal();
      setStartingCash('0');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to open shift';
      setShiftError(message);

      if (
        message.toLowerCase().includes('open shift') &&
        message.toLowerCase().includes('already')
      ) {
        await loadCurrentShift();
        closeClockInModal();
      }
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleCheckout = async () => {
    const items = buildSaleItems();
    if (!items.length) return;
    if (!ensureOpenShift()) return;

    setIsCheckingOut(true);
    try {
      const payload = {
        items,
        payment_method: paymentMethod,
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
      setStagedProduct(null);
      setOrderNumber(generateOrderNumber());
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : 'Checkout failed';
      if (message.toLowerCase().includes('no open shift')) {
        setShiftError(message);
        setIsClockInModalOpen(true);
        return;
      }
      window.alert(message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleSaveDraft = async () => {
    const items = buildSaleItems();
    if (!items.length) return;

    setIsSavingDraft(true);
    try {
      const payload = {
        items,
        payment_method: paymentMethod,
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
      setStagedProduct(null);
      setOrderNumber(generateOrderNumber());
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : 'Draft save failed');
    } finally {
      setIsSavingDraft(false);
    }
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

  const openCustomerModal = () => {
    setCustomerSaveError(null);
    setIsCustomerModalOpen(true);
  };

  const clearStaging = () => {
    setStagedProduct(null);
    setStagedQuantity('1');
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
  };

  const stagedSubtotal = stagedProduct
    ? parseNumber(stagedQuantity, 0) * parseNumber(stagedProduct.price, 0)
    : 0;

  const barcodeValue = draftSale?.receipt_number || draftSale?.id;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex h-screen flex-col overflow-hidden lg:flex-row">
        <section className="flex w-full flex-col border-r border-slate-800 bg-slate-950 lg:w-5/12 xl:w-1/3">
          <div className="flex h-full flex-col gap-6 overflow-y-auto p-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Product Search
                </label>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  Advanced Filter
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Scan barcode or type product name..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-3 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-100"
                  aria-label="Scan barcode"
                >
                  <ScanLine className="h-4 w-4" />
                </button>
                {productQuery.trim().length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
                    {isProductLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        Searching products...
                      </div>
                    ) : productResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        No products found.
                      </div>
                    ) : (
                      productResults.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectProduct(product)}
                          className="flex w-full items-center justify-between gap-4 border-b border-slate-800 px-4 py-3 text-left text-sm transition hover:bg-slate-900"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              {product.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              Stock: {product.stock_quantity}
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-emerald-400">
                            {formatCurrency(parseNumber(product.price, 0))}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {stagedProduct ? (
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-900/70 p-5 shadow-[0_0_30px_-15px_rgba(16,185,129,0.6)]">
                <div className="absolute left-0 top-0 h-full w-1.5 bg-emerald-500" />
                <div className="pl-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {stagedProduct.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Stock: {stagedProduct.stock_quantity}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(parseNumber(stagedProduct.price, 0))}
                      </div>
                      <div className="text-xs text-slate-500">
                        per {stagedProduct.unit || 'unit'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-5 gap-3">
                    <div className="col-span-2">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Quantity
                      </label>
                      <input
                        ref={quantityInputRef}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg border-2 border-emerald-400 bg-slate-950 px-3 py-2 text-center text-xl font-semibold text-white focus:outline-none"
                        value={stagedQuantity}
                        onChange={(event) =>
                          setStagedQuantity(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitStagedItem();
                          }
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Subtotal
                      </label>
                      <div className="flex h-[50px] items-center justify-end rounded-lg border border-slate-800 bg-slate-950 px-4 text-xl font-semibold text-slate-200">
                        {formatCurrency(stagedSubtotal)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={commitStagedItem}
                      className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Plus className="h-4 w-4" /> Add Item
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={clearStaging}
                      className="rounded-xl border border-slate-800 bg-slate-900 px-4 text-slate-400 transition hover:border-red-500/40 hover:text-red-400"
                      aria-label="Clear staged product"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 px-5 py-10 text-center text-sm text-slate-500">
                Select a product from the search results to stage it here.
              </div>
            )}

            <div className="mt-auto">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Customer
              </label>
              <div className="relative">
                <UserSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone or email..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-3 pl-10 pr-12 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                />
                <button
                  type="button"
                  onClick={openCustomerModal}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition hover:text-white"
                  aria-label="Add customer"
                >
                  <UserPlus className="h-4 w-4" />
                </button>
                {customerQuery.trim().length > 0 && (
                  <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
                    {isCustomerLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        Searching customers...
                      </div>
                    ) : customerResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">
                        No customers found.
                      </div>
                    ) : (
                      customerResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => handleSelectCustomer(customer)}
                          className="flex w-full items-center justify-between gap-4 border-b border-slate-800 px-4 py-3 text-left text-sm transition hover:bg-slate-900"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              {customer.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {customer.phone}
                            </div>
                          </div>
                          <div className="text-xs text-emerald-400">
                            {customer.loyalty_points} pts
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedCustomer && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-semibold text-white">
                    {getInitials(selectedCustomer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">
                      {selectedCustomer.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {selectedCustomer.phone}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearCustomer}
                    className="rounded-full p-1 text-slate-400 transition hover:text-red-400"
                    aria-label="Remove customer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="relative flex flex-1 flex-col bg-slate-950">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1f2937_1px,transparent_1px)] opacity-40 [background-size:18px_18px]" />
          <div className="relative z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Current Order
                </h2>
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  {orderNumber}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentShift ? (
                <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Shift Open
                </div>
              ) : (
                <button
                  type="button"
                  onClick={openClockInModal}
                  disabled={isShiftLoading}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-400 hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isShiftLoading ? 'Checking...' : 'Clock In'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCart([])}
                className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-400 transition hover:border-red-500/40 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>

          <div className="relative z-10 flex-1 space-y-3 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="mt-10 text-center text-sm text-slate-500">
                Cart is empty.
              </div>
            ) : (
              cart.map((item) => {
                const line = calculateLine(item);
                return (
                  <div
                    key={item.product.id}
                    className="group rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatCurrency(line.unitPrice)} per{' '}
                          {item.product.unit || 'unit'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(line.taxableAmount)}
                        </p>
                        {line.discountAmount > 0 && (
                          <p className="text-xs text-emerald-400">
                            -{formatCurrency(line.discountAmount)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className="w-20 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-center text-sm font-semibold text-white focus:border-emerald-400 focus:outline-none"
                          value={item.quantity}
                          onChange={(event) =>
                            handleQuantityChange(
                              item.product.id,
                              event.target.value
                            )
                          }
                          onBlur={(event) =>
                            handleQuantityBlur(
                              item.product.id,
                              event.target.value
                            )
                          }
                        />
                        <span className="text-xs text-slate-500">
                          {item.product.unit || 'qty'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Disc.
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            inputMode="decimal"
                            className="w-16 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-right text-sm text-white focus:border-emerald-400 focus:outline-none"
                            value={line.discountPercent}
                            onChange={(event) =>
                              handleDiscountChange(
                                item.product.id,
                                event.target.value
                              )
                            }
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="rounded-lg border border-slate-800 px-2 py-1 text-slate-500 transition hover:border-red-500/50 hover:text-red-400"
                        aria-label={`Remove ${item.product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="relative z-10 border-t border-slate-800 bg-slate-900/80 p-5 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.6)]">
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  paymentMethod === 'card'
                    ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                Card
              </button>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-white">
                  {formatCurrency(cartSummary.subTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span className="text-white">
                  {formatCurrency(cartSummary.tax)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Savings</span>
                <span>-{formatCurrency(cartSummary.discount)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between border-t border-dashed border-slate-800 pt-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Total Due
                </div>
                <div className="text-sm text-slate-500">
                  {cartSummary.itemCount} Items
                </div>
              </div>
              <div className="text-3xl font-bold text-white">
                {formatCurrency(grandTotal)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={cart.length === 0 || isSavingDraft || isCheckingOut}
                className="col-span-1 flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-800 bg-slate-950 py-3 text-xs font-semibold text-slate-400 transition hover:border-emerald-400/60 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSavingDraft ? 'Saving...' : 'Draft'}
              </button>
              <button
                type="button"
                onClick={handleCheckout}
                disabled={cart.length === 0 || isCheckingOut || isSavingDraft}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingOut ? 'Processing...' : 'Checkout'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        isOpen={isClockInModalOpen}
        onClose={closeClockInModal}
        title="Clock In"
      >
        <form className="space-y-4" onSubmit={handleOpenShift}>
          <p className="text-sm text-slate-400">
            Open a shift to start processing sales.
          </p>
          <div>
            <label className="text-sm font-medium text-slate-300">
              Starting Cash
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={startingCash}
              onChange={(event) => setStartingCash(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              required
            />
          </div>
          {shiftError && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {shiftError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeClockInModal}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isOpeningShift}
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isOpeningShift ? 'Opening...' : 'Open Shift'}
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
            <label className="text-sm font-medium text-zinc-700">Name</label>
            <input
              type="text"
              value={newCustomer.name}
              onChange={(event) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Phone</label>
            <input
              type="tel"
              value={newCustomer.phone}
              onChange={(event) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  phone: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Email</label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(event) =>
                setNewCustomer((prev) => ({
                  ...prev,
                  email: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">
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
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              rows={3}
            />
          </div>
          {customerSaveError && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {customerSaveError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(false)}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition hover:border-zinc-400"
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
