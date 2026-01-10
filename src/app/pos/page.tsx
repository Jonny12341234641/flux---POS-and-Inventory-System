'use client'; // This is a Client Component (Interactive)

import { useState, useEffect } from 'react';
import { Product } from '../../types/index'; // Importing your Types

// We define a simple type for the "Cart" (Frontend only)
interface CartItem extends Product {
  quantity: number;
}

const parseNumber = (value: unknown, fallback = 0) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

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

export default function POSPage() {
  // --- STATE MANAGEMENT ---
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);

  // --- 1. FETCH PRODUCTS FROM API ---
  const fetchProducts = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        query: searchQuery
      });
      const res = await fetch(`/api/inventory/products?${params.toString()}`, { signal }); // Calls your Backend Route
      const data = await res.json();
      // Handle different response structures
      const productList = Array.isArray(data) ? data : (data.data || []);
      setProducts(productList);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error("Failed to load products", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      fetchProducts(controller.signal);
    }, 500);
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    }
  }, [searchQuery, page]);

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

  // Reset page when search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handlePrevPage = () => setPage(p => Math.max(1, p - 1));
  const handleNextPage = () => setPage(p => p + 1);

  // --- 2. CART LOGIC ---
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        // If exists, increase quantity
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // If new, add to cart
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  // --- 3. CALCULATE TOTALS ---
  const totals = cart.reduce(
    (acc, item) => {
      const quantity = parseNumber(item.quantity, 0);
      const unitPrice = parseNumber(item.price, 0);
      const lineSubTotal = unitPrice * quantity;
      const taxRate = resolveTaxRate(item.tax_rate, defaultTaxRate);
      const lineTax =
        taxRate > 0 ? Math.max(lineSubTotal, 0) * taxRate : 0;

      acc.subTotal += lineSubTotal;
      acc.tax += lineTax;
      return acc;
    },
    { subTotal: 0, tax: 0 }
  );
  const { subTotal, tax } = totals;
  const grandTotal = subTotal + tax;

  // --- 4. CHECKOUT LOGIC ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    setIsCheckingOut(true);
    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price
        })),
        payment_method: paymentMethod,
        amount_paid: grandTotal,
      };

      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Checkout failed');
      }

      // Success
      alert('Sale processed successfully!');
      setCart([]); // Clear cart
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 text-black">
      
      {/* LEFT SIDE: PRODUCT GRID */}
      <div className="w-2/3 p-6 flex flex-col">
        {/* Header & Search */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Flux POS</h1>
          <input 
            type="text"
            placeholder="Search product or barcode..."
            className="p-3 w-1/2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-4 pb-4">
          {loading ? (
            <p className="text-gray-500 col-span-3 text-center">Loading inventory...</p>
          ) : products.length === 0 ? (
            <p className="text-gray-500 col-span-3 text-center">No products found.</p>
          ) : products.map((product) => (
            <div 
              key={product.id} 
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-xl shadow-sm cursor-pointer hover:shadow-lg hover:border-blue-500 border border-transparent transition flex flex-col justify-between"
            >
              <div>
                 {/* Placeholder for Image */}
                <div className="h-32 bg-gray-200 rounded-lg mb-3 flex items-center justify-center text-gray-400">
                  📷 No Image
                </div>
                <h3 className="font-bold text-lg">{product.name}</h3>
                <p className="text-gray-500 text-sm">{product.barcode}</p>
              </div>
              <div className="mt-3 flex justify-between items-center">
                <span className="font-bold text-blue-600">${Number(product.price).toFixed(2)}</span>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                  Stock: {product.stock_quantity}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        <div className="mt-4 flex justify-between items-center border-t pt-4">
            <button 
                onClick={handlePrevPage} 
                disabled={page === 1 || loading}
                className="px-4 py-2 bg-white border rounded shadow-sm disabled:opacity-50"
            >
                Previous
            </button>
            <span className="text-gray-600">Page {page}</span>
            <button 
                onClick={handleNextPage} 
                disabled={products.length < 20 || loading}
                className="px-4 py-2 bg-white border rounded shadow-sm disabled:opacity-50"
            >
                Next
            </button>
        </div>
      </div>

      {/* RIGHT SIDE: CART & CHECKOUT */}
      <div className="w-1/3 bg-white border-l shadow-xl flex flex-col">
        <div className="p-6 bg-gray-50 border-b">
          <h2 className="text-xl font-bold">Current Order</h2>
          <p className="text-sm text-gray-500">Receipt #{Date.now().toString().slice(-6)}</p>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">Cart is empty</div>
          ) : cart.map((item) => (
            <div key={item.id} className="flex justify-between items-center border-b pb-2">
              <div>
                <p className="font-bold">{item.name}</p>
                <p className="text-sm text-gray-500">
                  {item.quantity} x ${Number(item.price).toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold">${(item.quantity * item.price).toFixed(2)}</span>
                <button 
                  onClick={() => removeFromCart(item.id)}
                  className="text-red-500 hover:text-red-700 font-bold"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals Section */}
        <div className="p-6 bg-gray-50 border-t">
          {/* Payment Method Selector */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPaymentMethod('cash')}
              className={`flex-1 py-2 rounded-lg font-semibold border transition ${
                paymentMethod === 'cash'
                  ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cash
            </button>
            <button
              onClick={() => setPaymentMethod('card')}
              className={`flex-1 py-2 rounded-lg font-semibold border transition ${
                paymentMethod === 'card'
                  ? 'bg-blue-100 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Card
            </button>
          </div>

          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Subtotal</span>
            <span>${subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-4">
            <span className="text-gray-600">Tax</span>
            <span>${tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold mb-6">
            <span>Total</span>
            <span className="text-blue-600">${grandTotal.toFixed(2)}</span>
          </div>

          <button 
            onClick={handleCheckout}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg disabled:opacity-50 flex justify-center items-center"
            disabled={cart.length === 0 || isCheckingOut}
          >
            {isCheckingOut ? 'PROCESSING...' : `CHARGE $${grandTotal.toFixed(2)}`}
          </button>
        </div>
      </div>

    </div>
  );
}
