"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash } from "lucide-react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardContent, CardHeader } from "../../../../components/ui/card";

interface Supplier {
  id: string;
  name: string;
  active?: boolean;
}

interface Product {
  id: string;
  name: string;
  cost_price: number;
}

interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total: number;
}

interface CurrentItem {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const extractList = <T,>(data: unknown, fallbackKey?: string): T[] => {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (fallbackKey && Array.isArray(record[fallbackKey])
        ? record[fallbackKey]
        : null);

    if (Array.isArray(list)) {
      return list as T[];
    }
  }

  return [];
};

const DEFAULT_CURRENT_ITEM: CurrentItem = {
  product_id: "",
  quantity: 0,
  unit_cost: 0,
};

export default function CreatePurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [notes, setNotes] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [currentItem, setCurrentItem] = useState<CurrentItem>(
    DEFAULT_CURRENT_ITEM
  );
  const [loading, setLoading] = useState(true);
  const [productSearchTerm, setProductSearchTerm] = useState(""); // Added
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Suppliers (Initial Load)
  useEffect(() => {
    const controller = new AbortController();

    const fetchSuppliers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/suppliers?active=true", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load suppliers (status ${response.status}).`);
        }

        const data = await response.json();
        setSuppliers(extractList<Supplier>(data, "suppliers").filter(s => s.active !== false));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load suppliers.");
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
    return () => controller.abort();
  }, []);

  // Fetch Products with Debounce
  useEffect(() => {
    const controller = new AbortController();
    
    const fetchProducts = async () => {
      // Don't set global loading here to avoid flickering the whole page
      // Maybe add a small loading indicator for the dropdown?
      // For now, we'll just fetch quietly or use a separate loading state if needed.
      
      try {
        const params = new URLSearchParams({ query: productSearchTerm });
        const response = await fetch(`/api/inventory/products?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
           console.error("Failed to load products"); // Just log, don't break page
           return;
        }

        const data = await response.json();
        setProducts(extractList<Product>(data, "products"));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(err);
      }
    };

    const timeoutId = setTimeout(() => {
        fetchProducts();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [productSearchTerm]);

  const handleProductChange = (productId: string) => {
    const selectedProduct = products.find(
      (product) => product.id === productId
    );
    const parsedCost = selectedProduct
      ? Number(selectedProduct.cost_price)
      : 0;

    setCurrentItem((prev) => ({
      ...prev,
      product_id: productId,
      unit_cost: Number.isFinite(parsedCost) ? parsedCost : 0,
    }));
  };

  const handleAddItem = () => {
    setFormError(null);

    if (!currentItem.product_id || currentItem.quantity <= 0) {
      setFormError("Select a product and enter a quantity greater than zero.");
      return;
    }

    const selectedProduct = products.find(
      (product) => product.id === currentItem.product_id
    );

    if (!selectedProduct) {
      setFormError("Selected product could not be found.");
      return;
    }

    const quantity = Number(currentItem.quantity);
    const unitCost = Number(currentItem.unit_cost);
    const safeQuantity = Number.isFinite(quantity) ? quantity : 0;
    const safeUnitCost = Number.isFinite(unitCost) ? unitCost : 0;

    if (safeQuantity <= 0) {
      setFormError("Quantity must be greater than zero.");
      return;
    }

    setOrderItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product_id === currentItem.product_id
      );

      if (existingIndex >= 0) {
        return prev.map((item, index) => {
          if (index !== existingIndex) {
            return item;
          }

          const updatedQuantity = item.quantity + safeQuantity;

          return {
            ...item,
            quantity: updatedQuantity,
            total: updatedQuantity * item.unit_cost,
          };
        });
      }

      const lineTotal = safeQuantity * safeUnitCost;

      return [
        ...prev,
        {
          product_id: currentItem.product_id,
          product_name: selectedProduct.name ?? "Unnamed product",
          quantity: safeQuantity,
          unit_cost: safeUnitCost,
          total: lineTotal,
        },
      ];
    });

    setCurrentItem(DEFAULT_CURRENT_ITEM);
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems((prev) =>
      prev.filter((item) => item.product_id !== productId)
    );
  };

  const handleSubmit = async () => {
    setFormError(null);

    if (!selectedSupplier) {
      setFormError("Please select a supplier.");
      return;
    }

    if (orderItems.length === 0) {
      setFormError("Add at least one item to the order.");
      return;
    }

    const payload = {
      supplier_id: selectedSupplier,
      reference_number: referenceNumber.trim() || null,
      expected_date: expectedDate || null,
      payment_status: paymentStatus,
      notes: notes.trim() || null,
      items: orderItems.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
      })),
    };

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit order (status ${response.status}).`);
      }

      router.push("/admin/orders");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to submit order."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderTotal = orderItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            New Purchase Order
          </h1>
          <p className="text-sm text-slate-500">
            Create a new stock order and send it to your supplier.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/orders")}
          className="inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">
          Loading suppliers and products...
        </p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Step 1: Supplier Info
            </h2>
            <p className="text-sm text-slate-500">
              Choose the vendor and include any reference number.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Supplier
              </label>
              <select
                value={selectedSupplier}
                onChange={(event) => setSelectedSupplier(event.target.value)}
                disabled={loading || isSubmitting}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Reference Number
              </label>
              <Input
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                placeholder="Quote or pro-forma # (optional)"
                disabled={loading || isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Expected Date
              </label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(event) => setExpectedDate(event.target.value)}
                disabled={loading || isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(event) => setPaymentStatus(event.target.value)}
                disabled={loading || isSubmitting}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="col-span-full space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Notes
              </label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Additional notes..."
                disabled={loading || isSubmitting}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Step 2: Add Products
            </h2>
            <p className="text-sm text-slate-500">
              Add items and quantities for this purchase order.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Product
              </label>
               {/* Added Search Input */}
              <Input
                placeholder="Search Product..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="mb-2"
              />
              <select
                value={currentItem.product_id}
                onChange={(event) => handleProductChange(event.target.value)}
                disabled={loading || isSubmitting}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full space-y-2 lg:w-32">
              <label className="text-sm font-medium text-slate-700">
                Quantity
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={currentItem.quantity}
                onChange={(event) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    quantity: Number(event.target.value),
                  }))
                }
                disabled={loading || isSubmitting}
                placeholder="0"
              />
            </div>
            <div className="w-full space-y-2 lg:w-40">
              <label className="text-sm font-medium text-slate-700">
                Unit Cost
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={currentItem.unit_cost}
                onChange={(event) =>
                  setCurrentItem((prev) => ({
                    ...prev,
                    unit_cost: Number(event.target.value),
                  }))
                }
                disabled={loading || isSubmitting}
                placeholder="0.00"
              />
            </div>
            <div className="flex w-full lg:w-auto">
              <Button
                type="button"
                onClick={handleAddItem}
                disabled={loading || isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Step 3: Order Summary
            </h2>
            <p className="text-sm text-slate-500">
              Review line items before submitting the order.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit Cost</th>
                  <th className="px-4 py-3">Line Total</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orderItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No items added yet.
                    </td>
                  </tr>
                ) : (
                  orderItems.map((item) => (
                    <tr key={item.product_id}>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {item.product_name}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatCurrency(item.unit_cost)}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveItem(item.product_id)}
                          className="inline-flex items-center gap-2"
                        >
                          <Trash className="h-4 w-4" />
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <div className="text-right">
              <p className="text-sm text-slate-500">Grand Total</p>
              <p className="text-xl font-semibold text-slate-900">
                {formatCurrency(orderTotal)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {formError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading || isSubmitting}
          className="inline-flex h-12 items-center gap-2 bg-emerald-600 px-6 text-base text-white hover:bg-emerald-700"
        >
          <Save className="h-5 w-5" />
          {isSubmitting ? "Submitting..." : "Submit Order"}
        </Button>
      </div>
    </div>
  );
}
