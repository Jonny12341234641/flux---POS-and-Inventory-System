import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const STATUS_COLOR_MAP: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  received: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-green-100 text-green-800",
  refunded: "bg-orange-100 text-orange-800",
  voided: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-800",
  open: "bg-blue-100 text-blue-800",
  closed: "bg-gray-100 text-gray-800",
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD") {
  const normalizedCurrency = currency === "$" ? "USD" : currency.toUpperCase();

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: normalizedCurrency,
  }).format(amount);
}

export function formatDateTime(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getStatusColor(status: string) {
  const normalized = status.trim().toLowerCase();
  return STATUS_COLOR_MAP[normalized] ?? "bg-gray-100 text-gray-800";
}
