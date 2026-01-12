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
  RotateCcw,
  Search,
  Trash,
  Truck,
  CreditCard,
  Globe,
  Package,
} from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Modal } from "../../../components/ui/modal";
import type { Supplier } from "../../../types/index";

interface SupplierFormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  tax_id: string;
  payment_terms: string;
  lead_time_days: string;
  moq: string;
  website: string;
  notes: string;
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
  payment_terms: "",
  lead_time_days: "",
  moq: "",
  website: "",
  notes: "",
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
    className={`min-h-[96px] w-full rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 ${
      className ?? ""
    }`}
  />
);

const buildPayload = (data: SupplierFormData) => {
  const leadTime = parseInt(data.lead_time_days, 10);
  const moq = parseInt(data.moq, 10);

  return {
    name: data.name.trim(),
    contact_person: data.contact_person.trim() || undefined,
    phone: data.phone.trim() || undefined,
    email: data.email.trim() || undefined,
    address: data.address.trim() || undefined,
    tax_id: data.tax_id.trim() || undefined,
    payment_terms: data.payment_terms.trim() || undefined,
    lead_time_days: !isNaN(leadTime) ? leadTime : undefined,
    moq: !isNaN(moq) ? moq : undefined,
    website: data.website.trim() || undefined,
    notes: data.notes.trim() || undefined,
  };
};

const toFormData = (supplier: Supplier): SupplierFormData => ({
  name: supplier.name ?? "",
  contact_person: supplier.contact_person ?? "",
  phone: supplier.phone ?? "",
  email: supplier.email ?? "",
  address: supplier.address ?? "",
  tax_id: supplier.tax_id ?? "",
  payment_terms: supplier.payment_terms ?? "",
  lead_time_days: supplier.lead_time_days?.toString() ?? "",
  moq: supplier.moq?.toString() ?? "",
  website: supplier.website ?? "",
  notes: supplier.notes ?? "",
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
      const response = await fetch("/api/suppliers?active=false", {
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

  const handleReactivate = async (supplier: Supplier) => {
    if (supplier.is_active) {
      return;
    }

    const confirmed = window.confirm(`Reactivate ${supplier.name}?`);

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${supplier.id}/reactivate`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to reactivate supplier.");
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
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <Truck className="h-5 w-5 text-slate-400" />
            Suppliers
          </h1>
          <p className="text-sm text-slate-400">
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
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Tax ID</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-transparent">
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
                      <tr key={supplier.id} className={isInactive ? "bg-slate-900/20" : "hover:bg-slate-800/50 transition-colors"}>
                        <td className="px-4 py-4">
                          <Badge
                            label={isInactive ? "Inactive" : "Active"}
                            className={
                              isInactive
                                ? "bg-slate-800 text-slate-400"
                                : "bg-emerald-500/10 text-emerald-400"
                            }
                          />
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-200">
                          {supplier.name}
                        </td>
                        <td className="px-4 py-4 text-slate-400">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-300">{contactName}</span>
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
                              className="inline-flex items-center gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            {isInactive ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleReactivate(supplier)}
                                className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(supplier)}
                                className="inline-flex items-center gap-2"
                              >
                                <Trash className="h-4 w-4" />
                                Delete
                              </Button>
                            )}
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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={currentSupplier ? "Edit Supplier" : "Add Supplier"}
        className="max-w-3xl"
      >
        <p className="text-sm text-slate-400 mb-6">
          {currentSupplier
            ? "Update supplier contact and invoicing details."
            : "Add a new supplier to your address book."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="supplier-name"
                className="text-sm font-medium text-slate-300"
              >
                Supplier Name <span className="text-red-400">*</span>
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
                className="text-sm font-medium text-slate-300"
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
                className="flex items-center gap-2 text-sm font-medium text-slate-300"
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
                className="flex items-center gap-2 text-sm font-medium text-slate-300"
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
                className="flex items-center gap-2 text-sm font-medium text-slate-300"
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
              <div className="space-y-2">
              <label
                htmlFor="supplier-website"
                className="flex items-center gap-2 text-sm font-medium text-slate-300"
              >
                <Globe className="h-4 w-4 text-slate-400" />
                Website
              </label>
              <Input
                id="supplier-website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="https://acme.com"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="supplier-payment-terms"
                className="flex items-center gap-2 text-sm font-medium text-slate-300"
              >
                <CreditCard className="h-4 w-4 text-slate-400" />
                Payment Terms
              </label>
              <Input
                id="supplier-payment-terms"
                name="payment_terms"
                value={formData.payment_terms}
                onChange={handleInputChange}
                placeholder="Net 30, COD, etc."
              />
            </div>
            
            <div className="space-y-2">
              <label
                htmlFor="supplier-lead-time"
                className="flex items-center gap-2 text-sm font-medium text-slate-300"
              >
                <Truck className="h-4 w-4 text-slate-400" />
                Lead Time (Days)
              </label>
              <Input
                id="supplier-lead-time"
                name="lead_time_days"
                type="number"
                min="0"
                value={formData.lead_time_days}
                onChange={handleInputChange}
                placeholder="7"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="supplier-moq"
                className="flex items-center gap-2 text-sm font-medium text-slate-300"
              >
                <Package className="h-4 w-4 text-slate-400" />
                MOQ
              </label>
              <Input
                id="supplier-moq"
                name="moq"
                type="number"
                min="0"
                value={formData.moq}
                onChange={handleInputChange}
                placeholder="100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="supplier-address"
              className="text-sm font-medium text-slate-300"
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
          
          <div className="space-y-2">
            <label
              htmlFor="supplier-notes"
              className="text-sm font-medium text-slate-300"
            >
              Notes
            </label>
            <Textarea
              id="supplier-notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Internal notes about this supplier..."
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
      </Modal>
    </div>
  );
}