"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Edit, Plus, Search, Trash } from "lucide-react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Card, CardContent } from "../../../../components/ui/card";

interface Category {
  id: string;
  name: string;
  description?: string;
  color_code?: string;
}

interface CategoryFormData {
  name: string;
  description: string;
  color_code: string;
}

const DEFAULT_COLOR = "#cbd5e1";

const createDefaultFormData = (): CategoryFormData => ({
  name: "",
  description: "",
  color_code: DEFAULT_COLOR,
});

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(
    createDefaultFormData()
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/inventory/categories", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load categories (status ${response.status}).`
        );
      }

      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : data?.data ?? data?.categories ?? [];

      setCategories(items);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      setError(
        err instanceof Error ? err.message : "Failed to load categories."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchCategories(controller.signal);

    return () => controller.abort();
  }, []);

  const openCreateModal = () => {
    setCurrentCategory(null);
    setFormData(createDefaultFormData());
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setCurrentCategory(category);
    setFormData({
      name: category.name ?? "",
      description: category.description ?? "",
      color_code: category.color_code ?? DEFAULT_COLOR,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentCategory(null);
    setFormData(createDefaultFormData());
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setFormError("Category name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      name: trimmedName,
      description: formData.description.trim(),
      color_code: formData.color_code || DEFAULT_COLOR,
    };

    try {
      const response = await fetch("/api/inventory/categories", {
        method: currentCategory ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          currentCategory ? { id: currentCategory.id, ...payload } : payload
        ),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
            errorData.error || errorData.message || 
          `Failed to ${currentCategory ? "update" : "create"} category (status ${
            response.status
          }).`
        );
      }

      await fetchCategories();
      closeModal();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to save category."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (category: Category) => {
    const confirmed = window.confirm(
      `Delete "${category.name}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/inventory/categories?id=${encodeURIComponent(category.id)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to delete category (status ${response.status}).`
        );
      }

      await fetchCategories();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete category."
      );
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCategories = normalizedSearch
    ? categories.filter((category) => {
        const nameMatch = category.name
          .toLowerCase()
          .includes(normalizedSearch);
        const descriptionMatch = category.description
          ? category.description.toLowerCase().includes(normalizedSearch)
          : false;

        return nameMatch || descriptionMatch;
      })
    : categories;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            Manage product categories and POS button colors.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </header>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search categories..."
                className="pl-9"
              />
            </div>
            {loading ? (
              <span className="text-sm text-slate-400">Loading categories...</span>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Color</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      Loading categories...
                    </td>
                  </tr>
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No categories found.
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((category) => (
                    <tr key={category.id}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-4 w-4 rounded-full border border-slate-200"
                            style={{
                              backgroundColor:
                                category.color_code ?? DEFAULT_COLOR,
                            }}
                          />
                          <span className="text-xs text-slate-500">
                            {category.color_code ?? DEFAULT_COLOR}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {category.name}
                      </td>
                      <td className="px-4 py-4 text-slate-500">
                        {category.description || "No description"}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(category)}
                            className="inline-flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(category)}
                            className="inline-flex items-center gap-2"
                          >
                            <Trash className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {currentCategory ? "Edit Category" : "Add Category"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
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
                  placeholder="Category name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Short description (optional)"
                  className="min-h-[96px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Color
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={formData.color_code}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        color_code: event.target.value,
                      }))
                    }
                    className="h-10 w-16 cursor-pointer rounded-md border border-slate-200 bg-white p-1"
                  />
                  <Input
                    value={formData.color_code}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        color_code: event.target.value,
                      }))
                    }
                    placeholder="#cbd5e1"
                  />
                </div>
              </div>

              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
                    : currentCategory
                    ? "Save Changes"
                    : "Create Category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
