"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CreditCard,
  DollarSign,
  Package,
} from "lucide-react";

import { StatsCard } from "../../components/admin/StatsCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardData {
  dailyRevenue: number;
  transactionCount: number;
  lowStockCount: number;
  alerts: Array<{
    id: string;
    name: string;
    stock_quantity: number;
    reorder_level: number;
    unit: string;
  }>;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadStats = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/dashboard/stats", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            `Failed to load dashboard stats (status ${response.status}).`
          );
        }

        const data = await response.json();
        setStats(data.data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard stats."
        );
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    return () => controller.abort();
  }, []);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const dailyRevenueValue = stats
    ? formatCurrency(stats.dailyRevenue)
    : "--";
  const transactionValue = stats ? stats.transactionCount : "--";
  const lowStockValue = stats ? stats.lowStockCount : "--";
  const lowStockCount = stats?.lowStockCount ?? 0;
  const alerts = stats?.alerts ?? [];
  const showLowStockAlerts = alerts.length > 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Overview for {formattedDate}
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        ) : null}
      </header>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-red-700">
              Unable to load dashboard data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatsCard
          title="Daily Revenue"
          value={dailyRevenueValue}
          icon={DollarSign}
          loading={loading}
        />
        <StatsCard
          title="Transactions"
          value={transactionValue}
          icon={CreditCard}
          loading={loading}
        />
        <StatsCard
          title="Low Stock Items"
          value={lowStockValue}
          icon={AlertTriangle}
          loading={loading}
          className={lowStockCount > 0 ? "[&_svg]:text-red-500" : undefined}
        />
      </section>

      {loading ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Package className="h-4 w-4 text-muted-foreground" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500">Loading alerts...</p>
          </CardContent>
        </Card>
      ) : null}

      {showLowStockAlerts ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Package className="h-4 w-4 text-muted-foreground" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      Current Stock: {item.stock_quantity} {item.unit} - Reorder
                      Level: {item.reorder_level} {item.unit}
                    </p>
                  </div>
                  <Button asChild>
                    <Link
                      href="/admin/orders"
                      className="inline-flex items-center gap-2"
                    >
                      Restock
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
