"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Edit, Mail, Phone, Plus, Search, Trash, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tax_id?: string;
  loyalty_points: number;
  created_at: string;
}

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  tax_id: string;
}

const createDefaultFormData = (): CustomerFormData => ({
  name: "",
  phone: "",
  email: "",
  address: "",
  tax_id: "",
});

const formatDate = (value: string) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const extractList = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.customers) && record.customers);

    if (Array.isArray(list)) {
      return list as T[];
    }
  }

  return [];
};

export default function CustomersManagementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(
    createDefaultFormData()
  );
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = async (query: string, signal?: AbortSignal) => {
    const trimmedQuery = query.trim();
    const url = trimmedQuery
      ? `/api/customers?query=${encodeURIComponent(trimmedQuery)}`
      : "/api/customers";

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(
          `Failed to load customers (status ${response.status}).`
        );
      }

      const data = await response.json();
      if (signal?.aborted) {
        return;
      }

      setCustomers(extractList<Customer>(data));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      if (signal?.aborted) {
        return;
      }

      setError(
        err instanceof Error ? err.message : "Failed to load customers."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const delay = searchTerm.trim() ? 500 : 0;

    const timer = setTimeout(() => {
      fetchCustomers(searchTerm, controller.signal);
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm]);

  const openCreateModal = () => {
    setCurrentCustomer(null);
    setFormData(createDefaultFormData());
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setCurrentCustomer(customer);
    setFormData({
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
      tax_id: customer.tax_id ?? "",
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentCustomer(null);
    setFormData(createDefaultFormData());
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedPhone = formData.phone.trim();

    if (!trimmedName || !trimmedPhone) {
      setFormError("Name and phone number are required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      name: trimmedName,
      phone: trimmedPhone,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      tax_id: formData.tax_id.trim() || null,
    };

    try {
      const response = await fetch("/api/customers", {
        method: currentCustomer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          currentCustomer ? { id: currentCustomer.id, ...payload } : payload
        ),
      });

      if (response.status === 409) {
        window.alert("Phone number already exists");
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Failed to ${currentCustomer ? "update" : "create"} customer (status ${
            response.status
          }).`
        );
      }

      await fetchCustomers(searchTerm);
      closeModal();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Unable to save customer."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(
      `Delete "${customer.name}"? This will deactivate the customer.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/customers?id=${encodeURIComponent(customer.id)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to delete customer (status ${response.status}).`
        );
      }

      await fetchCustomers(searchTerm);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete customer."
      );
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="space-y-1 lg:flex-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" />
            <h1 className="text-2xl font-semibold text-slate-900">
              Customers
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Manage loyalty members and customer contact details.
          </p>
        </div>
        <div className="lg:flex-1 lg:flex lg:justify-center">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name or phone..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="lg:flex-1 lg:flex lg:justify-end">
          <Button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading customers...</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      Loading customers...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        {customer.name}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span>{customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {customer.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span>{customer.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {customer.loyalty_points ?? 0} pts
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {formatDate(customer.created_at)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(customer)}
                            className="inline-flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(customer)}
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
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {currentCustomer ? "Edit Customer" : "Add Customer"}
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
              <div className="grid gap-4 sm:grid-cols-2">
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
                    placeholder="Customer name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Phone
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="Phone number"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    placeholder="Email address"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Tax ID
                  </label>
                  <Input
                    value={formData.tax_id}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        tax_id: event.target.value,
                      }))
                    }
                    placeholder="Tax ID (optional)"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                  placeholder="Address (optional)"
                  className="min-h-[96px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                />
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
                    : currentCustomer
                    ? "Save Changes"
                    : "Create Customer"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
