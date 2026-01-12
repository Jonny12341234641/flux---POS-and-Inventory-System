"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Edit, Plus, Search, Trash } from "lucide-react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardContent } from "../../../../components/ui/card";
import { Modal } from "../../../../components/ui/modal";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  barcode: string;
  category_id: string;
  category?: { name: string } | null;
  price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  unit: string;
  image_url?: string | null;
}

interface ProductFormData {
  name: string;
  barcode: string;
  category_id: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  unit: string;
  image_url: string;
}

const UNIT_OPTIONS = ["pcs", "kg", "g", "l", "ml"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const createDefaultFormData = (): ProductFormData => ({
  name: "",
  barcode: "",
  category_id: "",
  price: 0,
  cost_price: 0,
  stock_quantity: 0,
  reorder_level: 0,
  unit: "pcs",
  image_url: "",
});

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

export default function ProductsManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(
    createDefaultFormData()
  );
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const PAGE_LIMIT = 20;

  const fetchCategories = async () => {
    try {
      const response = await fetch("/api/inventory/categories", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Failed to load categories");
      const data = await response.json();
      setCategories(extractList<Category>(data, "categories"));
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  };

  const fetchProducts = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        query: searchTerm,
      });

      const response = await fetch(`/api/inventory/products?${params.toString()}`, {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load products (status ${response.status}).`);
      }

      const data = await response.json();
      setProducts(extractList<Product>(data, "products"));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setError(
        err instanceof Error ? err.message : "Failed to load inventory data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      fetchProducts(controller.signal);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [page, searchTerm]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(1);
  };

  const handleNextPage = () => {
    setPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    setPage((prev) => Math.max(prev - 1, 1));
  };

  const resolveCategoryLabel = (product: Product): string => {
    if (product.category?.name) {
      return product.category.name;
    }

    if (product.category_id) {
      const matched = categories.find(
        (category) => category.id === product.category_id
      );

      return matched?.name ?? "Deleted category";
    }

    return "Unassigned";
  };

  const openCreateModal = () => {
    setCurrentProduct(null);
    setFormData(createDefaultFormData());
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setCurrentProduct(product);
    setFormData({
      name: product.name ?? "",
      barcode: product.barcode ?? "",
      category_id: product.category_id ?? "",
      price: product.price ?? 0,
      cost_price: product.cost_price ?? 0,
      stock_quantity: product.stock_quantity ?? 0,
      reorder_level: product.reorder_level ?? 0,
      unit: product.unit ?? "pcs",
      image_url: product.image_url ?? "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProduct(null);
    setFormData(createDefaultFormData());
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedBarcode = formData.barcode.trim();

    if (!trimmedName || !trimmedBarcode) {
      setFormError("Product name and barcode are required.");
      return;
    }

    if (formData.price < 0 || formData.cost_price < 0) {
      setFormError("Price and cost must be zero or higher.");
      return;
    }

    if (formData.stock_quantity < 0 || formData.reorder_level < 0) {
      setFormError("Stock and reorder levels must be zero or higher.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      name: trimmedName,
      barcode: trimmedBarcode,
      category_id: formData.category_id || null,
      price: formData.price,
      cost_price: formData.cost_price,
      stock_quantity: formData.stock_quantity,
      reorder_level: formData.reorder_level,
      unit: formData.unit || "pcs",
      image_url: formData.image_url.trim() || null,
    };

    try {
      const response = await fetch(
        currentProduct
          ? `/api/inventory/products/${currentProduct.id}`
          : "/api/inventory/products",
        {
          method: currentProduct ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 409) {
        window.alert("Barcode already exists");
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to ${currentProduct ? "update" : "create"} product (status ${
            response.status
          }).`
        );
      }

      await fetchProducts();
      closeModal();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to save product."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (product: Product) => {
    const confirmed = window.confirm(
      `Delete "${product.name}"? This will deactivate the product.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/inventory/products/${product.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete product (status ${response.status}).`);
      }

      await fetchProducts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete product."
      );
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Inventory</h1>
          <p className="text-sm text-slate-400">
            Manage your product catalog and stock levels.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading products...</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Barcode</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-transparent">
                {products.length === 0 && !loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const isLowStock =
                      product.stock_quantity <= product.reorder_level;
                    const unitLabel = product.unit || "pcs";
                    const categoryLabel = resolveCategoryLabel(product);

                    return (
                      <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-4 font-semibold text-slate-200">
                          {product.name}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {product.barcode}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
                            {categoryLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-200">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-4 py-4">
                          {isLowStock ? (
                            <span className="inline-flex items-center gap-2 text-sm font-semibold text-red-400">
                              <AlertTriangle className="h-4 w-4" />
                              {product.stock_quantity} {unitLabel}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-200">
                              {product.stock_quantity} {unitLabel}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(product)}
                              className="inline-flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(product)}
                              className="inline-flex items-center gap-2"
                            >
                              <Trash className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-800 p-4">
            <span className="text-sm text-slate-500">
              Page {page}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={products.length < PAGE_LIMIT || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={currentProduct ? "Edit Product" : "Add Product"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Name
              </label>
              <Input
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Product name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Barcode
              </label>
              <Input
                value={formData.barcode}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    barcode: event.target.value,
                  }))
                }
                placeholder="SKU / Barcode"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Category
              </label>
              <select
                value={formData.category_id}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    category_id: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                <option value="" className="bg-slate-900">Unassigned</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id} className="bg-slate-900">
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Unit
              </label>
              <select
                value={formData.unit}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    unit: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-md border border-slate-800 bg-slate-900/50 px-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit} className="bg-slate-900">
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Price
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    price: Number(event.target.value),
                  }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Cost
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.cost_price}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    cost_price: Number(event.target.value),
                  }))
                }
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Stock Quantity
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.stock_quantity}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    stock_quantity: Number(event.target.value),
                  }))
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Reorder Level
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.reorder_level}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    reorder_level: Number(event.target.value),
                  }))
                }
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Image URL
            </label>
            <Input
              value={formData.image_url}
              onChange={(event) =>
                setFormData((prev) => ({
                  ...prev,
                  image_url: event.target.value,
                }))
              }
              placeholder="https://"
            />
          </div>

          {formError ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {formError}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : currentProduct
                ? "Save Changes"
                : "Create Product"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}