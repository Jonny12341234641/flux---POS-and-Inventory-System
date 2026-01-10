"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";
import { Percent, Receipt, Save, Settings, Store } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";

interface SystemSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  receiptHeader: string;
  receiptFooter: string;
  logoUrl: string;
  taxRate: number;
  currency: string;
  lowStockThreshold: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  storeName: "Flux Store",
  storeAddress: "123 Galle Road, Colombo",
  storePhone: "+94 11 234 5678",
  storeEmail: "",
  receiptHeader: "",
  receiptFooter: "No refunds after 7 days",
  logoUrl: "",
  taxRate: 2.5,
  currency: "LKR",
  lowStockThreshold: 10,
};

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const stringFrom = (value: unknown, fallback: string) =>
      typeof value === "string" && value.trim() ? value : fallback;
    const numberFrom = (value: unknown, fallback: number) => {
      const parsed =
        typeof value === "number"
          ? value
          : typeof value === "string"
          ? Number(value)
          : Number.NaN;
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const normalizeSettings = (data: unknown): SystemSettings => {
      if (!data || typeof data !== "object") {
        return DEFAULT_SETTINGS;
      }

      const record = data as Record<string, unknown>;
      const payload =
        (record.settings as Record<string, unknown> | undefined) ??
        (record.data as Record<string, unknown> | undefined) ??
        record;

      return {
        storeName: stringFrom(
          payload.storeName ?? payload.store_name,
          DEFAULT_SETTINGS.storeName
        ),
        storeAddress: stringFrom(
          payload.storeAddress ?? payload.store_address,
          DEFAULT_SETTINGS.storeAddress
        ),
        storePhone: stringFrom(
          payload.storePhone ?? payload.store_phone,
          DEFAULT_SETTINGS.storePhone
        ),
        storeEmail: stringFrom(
          payload.storeEmail ?? payload.store_email,
          DEFAULT_SETTINGS.storeEmail
        ),
        receiptHeader: stringFrom(
          payload.receiptHeader ?? payload.receipt_header,
          DEFAULT_SETTINGS.receiptHeader
        ),
        receiptFooter: stringFrom(
          payload.receiptFooter ?? payload.receipt_footer,
          DEFAULT_SETTINGS.receiptFooter
        ),
        logoUrl: stringFrom(
          payload.logoUrl ?? payload.logo_url,
          DEFAULT_SETTINGS.logoUrl
        ),
        taxRate: numberFrom(
          payload.taxRate ?? payload.default_tax_rate,
          DEFAULT_SETTINGS.taxRate
        ),
        currency: stringFrom(
          payload.currency ?? payload.currency_symbol,
          DEFAULT_SETTINGS.currency
        ),
        lowStockThreshold: numberFrom(
          payload.lowStockThreshold ?? payload.low_stock_threshold,
          DEFAULT_SETTINGS.lowStockThreshold
        ),
      };
    };

    const fetchSettings = async () => {
      try {
        const response = await fetch("/api/settings", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load settings (status ${response.status}).`);
        }

        const data = await response.json();
        if (!controller.signal.aborted) {
          setSettings(normalizeSettings(data));
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (!controller.signal.aborted) {
          setSettings(DEFAULT_SETTINGS);
        }
      }
    };

    fetchSettings();

    return () => controller.abort();
  }, []);

  const handleSave = async () => {
    setSaving(true);

    const payload = {
      store_name: settings.storeName.trim(),
      store_address: settings.storeAddress.trim(),
      store_phone: settings.storePhone.trim(),
      store_email: settings.storeEmail.trim(),
      receipt_header: settings.receiptHeader.trim(),
      receipt_footer: settings.receiptFooter.trim(),
      logo_url: settings.logoUrl.trim(),
      default_tax_rate: settings.taxRate,
      currency_symbol: settings.currency.trim(),
      low_stock_threshold: settings.lowStockThreshold,
    };

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to save settings (status ${response.status}).`
        );
      }

      window.alert("System settings saved.");
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Unable to save settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <Key extends keyof SystemSettings>(
    key: Key,
    value: SystemSettings[Key]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleNumberChange =
    (key: "taxRate" | "lowStockThreshold") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      updateSetting(key, Number.isFinite(value) ? value : 0);
    };

  return (
    <div className="space-y-6 pb-16">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <Settings className="h-5 w-5 text-slate-500" />
            System Settings
          </h1>
          <p className="text-sm text-slate-500">
            Manage your store details and preferences.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Store className="h-4 w-4 text-slate-500" />
              Receipt Header (Store Profile)
            </CardTitle>
            <CardDescription>
              This appears at the top of every receipt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="store-name" className="text-sm font-medium text-slate-700">
                Store Name
              </label>
              <Input
                id="store-name"
                value={settings.storeName}
                onChange={(event) => updateSetting("storeName", event.target.value)}
                placeholder="Flux Store"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="store-phone"
                className="text-sm font-medium text-slate-700"
              >
                Store Phone
              </label>
              <Input
                id="store-phone"
                type="tel"
                value={settings.storePhone}
                onChange={(event) => updateSetting("storePhone", event.target.value)}
                placeholder="+94 11 234 5678"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="store-email"
                className="text-sm font-medium text-slate-700"
              >
                Store Email
              </label>
              <Input
                id="store-email"
                type="email"
                value={settings.storeEmail}
                onChange={(event) => updateSetting("storeEmail", event.target.value)}
                placeholder="store@example.com"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="logo-url"
                className="text-sm font-medium text-slate-700"
              >
                Logo URL
              </label>
              <Input
                id="logo-url"
                type="text"
                value={settings.logoUrl}
                onChange={(event) => updateSetting("logoUrl", event.target.value)}
                placeholder="https://example.com/logo.png"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="store-address"
                className="text-sm font-medium text-slate-700"
              >
                Store Address
              </label>
              <Textarea
                id="store-address"
                value={settings.storeAddress}
                onChange={(event) =>
                  updateSetting("storeAddress", event.target.value)
                }
                placeholder="123 Galle Road, Colombo"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Receipt className="h-4 w-4 text-slate-500" />
              Receipt Customization
            </CardTitle>
            <CardDescription>
              Return policy or Thank You message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
              <label
                htmlFor="receipt-header"
                className="text-sm font-medium text-slate-700"
              >
                Receipt Header Message
              </label>
              <Textarea
                id="receipt-header"
                value={settings.receiptHeader}
                onChange={(event) =>
                  updateSetting("receiptHeader", event.target.value)
                }
                placeholder="Welcome to our store!"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="receipt-footer"
                className="text-sm font-medium text-slate-700"
              >
                Footer Message
              </label>
              <Textarea
                id="receipt-footer"
                value={settings.receiptFooter}
                onChange={(event) =>
                  updateSetting("receiptFooter", event.target.value)
                }
                placeholder="No refunds after 7 days"
                className="min-h-[140px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Percent className="h-4 w-4 text-slate-500" />
              Financial & Inventory
            </CardTitle>
            <CardDescription>
              Defaults that affect pricing and low-stock alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label
                  htmlFor="currency"
                  className="text-sm font-medium text-slate-700"
                >
                  Currency Symbol
                </label>
                <Input
                  id="currency"
                  value={settings.currency}
                  onChange={(event) => updateSetting("currency", event.target.value)}
                  placeholder="LKR"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="tax-rate"
                  className="text-sm font-medium text-slate-700"
                >
                  Tax Rate (%)
                </label>
                <Input
                  id="tax-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settings.taxRate}
                  onChange={handleNumberChange("taxRate")}
                  placeholder="2.5"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="low-stock"
                  className="text-sm font-medium text-slate-700"
                >
                  Global Low Stock Alert
                </label>
                <Input
                  id="low-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={settings.lowStockThreshold}
                  onChange={handleNumberChange("lowStockThreshold")}
                  placeholder="10"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="fixed bottom-6 right-6 z-10">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 shadow-lg"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}