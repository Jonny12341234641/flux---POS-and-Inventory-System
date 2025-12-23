"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type TextareaHTMLAttributes,
} from "react";
import {
  Edit,
  FileText,
  Mail,
  Phone,
  Plus,
  Search,
  Trash,
  Truck,
} from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";

interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  tax_id?: string;
  is_active: boolean;
}

interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  tax_id: string;
}

interface BadgeProps {
  className?: string;
  label: string;
}

const DEFAULT_FORM_DATA: SupplierFormData = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  tax_id: "",
};

const Badge = ({ className, label }: BadgeProps) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
      className ?? ""
    }`}
  >
    {label}
  </span>
);

const Textarea = ({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={`min-h-[96px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 ${
      className ?? ""
    }`}
  />
);

const buildPayload = (data: SupplierFormData) => ({
  name: data.name.trim(),
  contact_person: data.contact_person.trim() || undefined,
  phone: data.phone.trim() || undefined,
  email: data.email.trim() || undefined,
  address: data.address.trim() || undefined,
  tax_id: data.tax_id.trim() || undefined,
});

const toFormData = (supplier: Supplier): SupplierFormData => ({
  name: supplier.name ?? "",
  contact_person: supplier.contact_person ?? "",
  phone: supplier.phone ?? "",
  email: supplier.email ?? "",
  address: supplier.address ?? "",
  tax_id: supplier.tax_id ?? "",
});

const extractSuppliers = (data: unknown): Supplier[] => {
  if (Array.isArray(data)) {
    return data as Supplier[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.suppliers) && record.suppliers);

    if (Array.isArray(list)) {
      return list as Supplier[];
    }
  }

  return [];
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(DEFAULT_FORM_DATA);

  const fetchSuppliers = async (signal?: AbortSignal) => {
    setLoading(true);

    try {
      const response = await fetch("/api/suppliers", {
        cache: "no-store",
        signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load suppliers (status ${response.status}).`);
      }

      const data = await response.json();
      setSuppliers(extractSuppliers(data));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setSuppliers([]);
      window.alert(
        error instanceof Error ? error.message : "Unable to load suppliers."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchSuppliers(controller.signal);

    return () => controller.abort();
  }, []);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSuppliers = normalizedSearch
    ? suppliers.filter((supplier) => {
        const nameMatch = supplier.name.toLowerCase().includes(normalizedSearch);
        const contactMatch = supplier.contact_person
          ?.toLowerCase()
          .includes(normalizedSearch);

        return nameMatch || Boolean(contactMatch);
      })
    : suppliers;

  const openCreateModal = () => {
    setCurrentSupplier(null);
    setFormData(DEFAULT_FORM_DATA);
    setIsModalOpen(true);
  };

  const openEditModal = (supplier: Supplier) => {
    setCurrentSupplier(supplier);
    setFormData(toFormData(supplier));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentSupplier(null);
    setFormData(DEFAULT_FORM_DATA);
  };

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      window.alert("Supplier name is required.");
      return;
    }

    const payload = buildPayload({ ...formData, name: trimmedName });
    const endpoint = currentSupplier
      ? `/api/suppliers/${currentSupplier.id}`
      : "/api/suppliers";
    const method = currentSupplier ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${currentSupplier ? "update" : "create"} supplier.`
        );
      }

      await fetchSuppliers();
      closeModal();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to save supplier."
      );
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!supplier.is_active) {
      return;
    }

    const confirmed = window.confirm(
      `Deactivate ${supplier.name}? This will mark the supplier inactive.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to deactivate supplier.");
      }

      await fetchSuppliers();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to update supplier."
      );
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Truck className="h-5 w-5 text-slate-500" />
            Suppliers
          </h1>
          <p className="text-sm text-slate-500">
            Manage your procurement address book and supplier status.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search suppliers..."
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Tax ID</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      Loading suppliers...
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      No suppliers found.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier) => {
                    const contactName =
                      supplier.contact_person?.trim() || "No contact";
                    const phone = supplier.phone?.trim() || "No phone";
                    const taxId = supplier.tax_id?.trim() || "-";
                    const address = supplier.address?.trim() || "-";
                    const isInactive = !supplier.is_active;

                    return (
                      <tr key={supplier.id} className={isInactive ? "bg-slate-50" : ""}>
                        <td className="px-4 py-4">
                          <Badge
                            label={isInactive ? "Inactive" : "Active"}
                            className={
                              isInactive
                                ? "bg-slate-200 text-slate-600"
                                : "bg-emerald-100 text-emerald-700"
                            }
                          />
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-900">
                          {supplier.name}
                        </td>
                        <td className="px-4 py-4 text-slate-600">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-700">{contactName}</span>
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Phone className="h-3.5 w-3.5" />
                              {phone}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {taxId}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          <span className="block max-w-[260px] truncate">
                            {address}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEditModal(supplier)}
                              className="inline-flex items-center gap-2 text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(supplier)}
                              disabled={!supplier.is_active}
                              className="inline-flex items-center gap-2 text-red-600 disabled:cursor-not-allowed disabled:text-slate-400"
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
        </CardContent>
      </Card>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="space-y-6 p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {currentSupplier ? "Edit Supplier" : "Add Supplier"}
                </h2>
                <p className="text-sm text-slate-500">
                  {currentSupplier
                    ? "Update supplier contact and invoicing details."
                    : "Add a new supplier to your address book."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="supplier-name"
                      className="text-sm font-medium text-slate-700"
                    >
                      Supplier Name
                    </label>
                    <Input
                      id="supplier-name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Acme Distributors"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="contact-person"
                      className="text-sm font-medium text-slate-700"
                    >
                      Contact Person
                    </label>
                    <Input
                      id="contact-person"
                      name="contact_person"
                      value={formData.contact_person}
                      onChange={handleInputChange}
                      placeholder="Jane Perera"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="supplier-phone"
                      className="flex items-center gap-2 text-sm font-medium text-slate-700"
                    >
                      <Phone className="h-4 w-4 text-slate-400" />
                      Phone
                    </label>
                    <Input
                      id="supplier-phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+94 77 123 4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="supplier-email"
                      className="flex items-center gap-2 text-sm font-medium text-slate-700"
                    >
                      <Mail className="h-4 w-4 text-slate-400" />
                      Email
                    </label>
                    <Input
                      id="supplier-email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="procurement@acme.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="supplier-tax-id"
                      className="flex items-center gap-2 text-sm font-medium text-slate-700"
                    >
                      <FileText className="h-4 w-4 text-slate-400" />
                      Tax ID
                    </label>
                    <Input
                      id="supplier-tax-id"
                      name="tax_id"
                      value={formData.tax_id}
                      onChange={handleInputChange}
                      placeholder="TAX-0001234"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="supplier-address"
                    className="text-sm font-medium text-slate-700"
                  >
                    Address
                  </label>
                  <Textarea
                    id="supplier-address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Street, City, Province"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button type="submit" className="inline-flex items-center gap-2">
                    {currentSupplier ? "Update Supplier" : "Create Supplier"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
