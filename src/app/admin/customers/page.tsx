"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Edit, Mail, Phone, Plus, Search, Trash, Users } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Card, CardContent } from "../../../components/ui/card";
import { Modal } from "../../../components/ui/modal";
import type { Customer } from "../../../types/index";

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  tax_id: string;
  store_credit: number;
  tier_id: string;
}

const createDefaultFormData = (): CustomerFormData => ({
  name: "",
  phone: "",
  email: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  tax_id: "",
  store_credit: 0,
  tier_id: "",
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
      address_street: customer.address_street ?? "",
      address_city: customer.address_city ?? "",
      address_state: customer.address_state ?? "",
      address_zip: customer.address_zip ?? "",
      tax_id: customer.tax_id ?? "",
      store_credit: customer.store_credit ?? 0,
      tier_id: customer.tier_id ?? "",
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
      address_street: formData.address_street.trim() || null,
      address_city: formData.address_city.trim() || null,
      address_state: formData.address_state.trim() || null,
      address_zip: formData.address_zip.trim() || null,
      tax_id: formData.tax_id.trim() || null,
      store_credit: Number(formData.store_credit),
      tier_id: formData.tier_id.trim() || null,
    };

    try {
      const endpoint = currentCustomer
        ? `/api/customers/${currentCustomer.id}`
        : "/api/customers";
      const method = currentCustomer ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        `/api/customers/${encodeURIComponent(customer.id)}`,
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
            <Users className="h-5 w-5 text-slate-400" />
            <h1 className="text-2xl font-semibold text-white">
              Customers
            </h1>
          </div>
          <p className="text-sm text-slate-400">
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
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Credit</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-transparent">
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      Loading customers...
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-4 font-semibold text-slate-200">
                        {customer.name}
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-500" />
                          <span>{customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        {customer.email ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                            <span>{customer.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                          {customer.loyalty_points ?? 0} pts
                        </span>
                      </td>
                      <td className="px-4 py-4">
                         <span className="font-medium text-slate-300">
                          ${(customer.store_credit ?? 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-500">
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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={currentCustomer ? "Edit Customer" : "Add Customer"}
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
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
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
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

          {/* Email & Tax */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
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
              <label className="text-sm font-medium text-slate-300">
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

          {/* Credit & Tier */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Store Credit ($)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.store_credit}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    store_credit: parseFloat(event.target.value) || 0,
                  }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                Tier ID
              </label>
              <Input
                value={formData.tier_id}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    tier_id: event.target.value,
                  }))
                }
                placeholder="Tier ID (optional)"
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="mb-3 text-sm font-medium text-white">Address</h3>
            <div className="grid gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-400">Street</label>
                <Input
                  value={formData.address_street}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      address_street: event.target.value,
                    }))
                  }
                  placeholder="Street Address"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">City</label>
                  <Input
                    value={formData.address_city}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        address_city: event.target.value,
                      }))
                  }
                    placeholder="City"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400">State</label>
                  <Input
                    value={formData.address_state}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        address_state: event.target.value,
                      }))
                    }
                    placeholder="State"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1 space-y-1">
                  <label className="text-xs font-medium text-slate-400">Zip Code</label>
                  <Input
                    value={formData.address_zip}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        address_zip: event.target.value,
                      }))
                    }
                    placeholder="Zip"
                  />
                </div>
              </div>
            </div>
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
                : currentCustomer
                ? "Save Changes"
                : "Create Customer"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
