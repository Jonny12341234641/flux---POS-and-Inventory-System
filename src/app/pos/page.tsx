'use client'; // This is a Client Component (Interactive)

import { useState, useEffect } from 'react';
import { Product } from '../../types/index'; // Importing your Types

// We define a simple type for the "Cart" (Frontend only)
interface CartItem extends Product {
  quantity: number;
}

export default function POSPage() {
  // --- STATE MANAGEMENT ---
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // --- 1. FETCH PRODUCTS FROM API ---
  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch('/api/inventory/products'); // Calls your Backend Route
        const data = await res.json();
        // Handle different response structures
        const productList = Array.isArray(data) ? data : (data.data || []);
        setProducts(productList);
      } catch (error) {
        console.error("Failed to load products", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, []);

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
  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subTotal * 0.10; // 10% Tax
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
        payment_method: 'cash', // Defaulting to cash for now
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

  // --- 5. FILTERING ---
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.barcode?.includes(searchQuery)
  );

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
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-4">
          {loading ? (
            <p className="text-gray-500">Loading inventory...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-gray-500 col-span-3 text-center">No products found.</p>
          ) : filteredProducts.map((product) => (
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
          <div className="flex justify-between mb-2">
            <span className="text-gray-600">Subtotal</span>
            <span>${subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-4">
            <span className="text-gray-600">Tax (10%)</span>
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