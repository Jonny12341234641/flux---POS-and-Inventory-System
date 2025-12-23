"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface StockMovement {
  id: string;
  product: { name: string };
  quantity: number;
  type: "sale" | "purchase" | "adjustment" | "return" | "damage";
  reason?: string;
  user: { name: string };
  created_at: string;
}

type MovementFilter = "all" | StockMovement["type"];

const MOVEMENT_FILTERS: Array<{ value: MovementFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "sale", label: "Sale" },
  { value: "purchase", label: "Purchase" },
  { value: "adjustment", label: "Adjustment" },
  { value: "return", label: "Return" },
  { value: "damage", label: "Damage" },
];

const MOVEMENT_STYLES: Record<
  StockMovement["type"],
  { label: string; badgeClass: string; direction: "in" | "out" | "manual" }
> = {
  sale: {
    label: "Sale",
    badgeClass: "bg-red-100 text-red-700",
    direction: "out",
  },
  purchase: {
    label: "Purchase",
    badgeClass: "bg-emerald-100 text-emerald-700",
    direction: "in",
  },
  adjustment: {
    label: "Adjustment",
    badgeClass: "bg-orange-100 text-orange-700",
    direction: "manual",
  },
  return: {
    label: "Return",
    badgeClass: "bg-emerald-100 text-emerald-700",
    direction: "in",
  },
  damage: {
    label: "Damage",
    badgeClass: "bg-red-100 text-red-700",
    direction: "out",
  },
};

const formatDateTime = (value: string) => {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

const formatQuantity = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);

const sortByNewest = (items: StockMovement[]) =>
  [...items].sort((a, b) => {
    const first = new Date(a.created_at).getTime();
    const second = new Date(b.created_at).getTime();

    return (
      (Number.isNaN(second) ? 0 : second) -
      (Number.isNaN(first) ? 0 : first)
    );
  });

const extractMovements = (data: unknown): StockMovement[] => {
  if (Array.isArray(data)) {
    return data as StockMovement[];
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const list =
      (Array.isArray(record.data) && record.data) ||
      (Array.isArray(record.movements) && record.movements) ||
      (Array.isArray(record.logs) && record.logs);

    if (Array.isArray(list)) {
      return list as StockMovement[];
    }
  }

  return [];
};

const extractTotalPages = (data: unknown): number | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const pagination = record.pagination;

  if (!pagination || typeof pagination !== "object") {
    return null;
  }

  const meta = pagination as Record<string, unknown>;
  const totalPages =
    typeof meta.totalPages === "number"
      ? meta.totalPages
      : typeof meta.total_pages === "number"
      ? meta.total_pages
      : null;

  if (typeof totalPages === "number" && Number.isFinite(totalPages)) {
    return totalPages;
  }

  return null;
};

const matchesSearch = (movement: StockMovement, normalizedTerm: string) => {
  if (!normalizedTerm) {
    return true;
  }

  const product = movement.product?.name?.toLowerCase() ?? "";
  const user = movement.user?.name?.toLowerCase() ?? "";
  const reason = movement.reason?.toLowerCase() ?? "";
  const type = movement.type.toLowerCase();

  return (
    product.includes(normalizedTerm) ||
    user.includes(normalizedTerm) ||
    reason.includes(normalizedTerm) ||
    type.includes(normalizedTerm)
  );
};

export default function StockMovementLogsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<MovementFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadMovements = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/reports/stock-movement?page=${page}&type=${encodeURIComponent(
            filterType
          )}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load stock logs (status ${response.status}).`
          );
        }

        const data = await response.json();
        const extracted = extractMovements(data);
        setMovements(sortByNewest(extracted));
        setTotalPages(extractTotalPages(data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load stock movement logs."
        );
        setMovements([]);
        setTotalPages(null);
      } finally {
        setLoading(false);
      }
    };

    loadMovements();

    return () => controller.abort();
  }, [page, filterType]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const typeFilteredMovements =
    filterType === "all"
      ? movements
      : movements.filter((movement) => movement.type === filterType);
  const filteredMovements = normalizedSearch
    ? typeFilteredMovements.filter((movement) =>
        matchesSearch(movement, normalizedSearch)
      )
    : typeFilteredMovements;
  const emptyMessage =
    movements.length === 0
      ? "No stock movements recorded yet."
      : normalizedSearch
      ? "No stock movements match your search."
      : "No stock movements found for this filter.";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Stock Logs</h1>
        <p className="text-sm text-slate-500">
          Track every stock change across sales, restocks, and manual updates.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-slate-400">Loading stock movement logs...</p>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                <Filter className="h-4 w-4 text-slate-400" />
                Movement Type
              </span>
              <select
                value={filterType}
                onChange={(event) => {
                  setFilterType(event.target.value as MovementFilter);
                  setPage(1);
                }}
                className="h-10 w-full min-w-[180px] rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                {MOVEMENT_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full max-w-xs">
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search product, user, or ref..."
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Note/Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      Loading stock logs...
                    </td>
                  </tr>
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-6 text-center text-sm text-slate-500"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((movement) => {
                    const quantityValue = Number.isFinite(movement.quantity)
                      ? movement.quantity
                      : 0;
                    const style = MOVEMENT_STYLES[movement.type];
                    const isManual = style.direction === "manual";
                    const isIn =
                      style.direction === "in" ||
                      (isManual && quantityValue > 0);
                    const isOut =
                      style.direction === "out" ||
                      (isManual && quantityValue < 0);
                    const absQuantity = Math.abs(quantityValue);
                    const sign =
                      quantityValue === 0
                        ? ""
                        : isOut
                        ? "-"
                        : "+";
                    const quantityLabel =
                      quantityValue === 0
                        ? "0"
                        : `${sign}${formatQuantity(absQuantity)}`;
                    const QuantityIcon = isOut ? ArrowDownLeft : ArrowUpRight;
                    const quantityClassName = isOut
                      ? "text-red-600"
                      : isIn
                      ? "text-emerald-600"
                      : "text-orange-600";

                    return (
                      <tr key={movement.id}>
                        <td className="px-4 py-4 text-slate-500">
                          {formatDateTime(movement.created_at)}
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-900">
                          {movement.product?.name ?? "Unknown product"}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${style.badgeClass}`}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-2 font-semibold ${quantityClassName}`}
                          >
                            {quantityValue === 0 ? null : (
                              <QuantityIcon className="h-4 w-4" />
                            )}
                            {quantityLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {movement.user?.name ?? "Unknown user"}
                        </td>
                        <td className="px-4 py-4">
                          {movement.reason ? (
                            <span className="text-xs text-slate-500">
                              {movement.reason}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
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

      <div className="flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page === 1}
          className="inline-flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <span className="text-sm text-slate-500">
          Page {page}
          {totalPages ? ` of ${totalPages}` : ""}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPage((prev) => prev + 1)}
          disabled={totalPages !== null && page >= totalPages}
          className="inline-flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
