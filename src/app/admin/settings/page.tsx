"use client";

import {
  useEffect,
  useState,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";
import { Percent, Receipt, Save, Settings, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SystemSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  receiptFooter: string;
  taxRate: number;
  currency: string;
  lowStockThreshold: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  storeName: "Flux Store",
  storeAddress: "123 Galle Road, Colombo",
  storePhone: "+94 11 234 5678",
  receiptFooter: "No refunds after 7 days",
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
    const timer = window.setTimeout(() => {
      // TODO: Replace with GET /api/settings
      setSettings(DEFAULT_SETTINGS);
    }, 300);

    return () => window.clearTimeout(timer);
  }, []);

  const handleSave = () => {
    setSaving(true);
    // TODO: Replace with PUT /api/settings
    window.setTimeout(() => {
      setSaving(false);
      window.alert("System settings saved.");
    }, 1000);
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
              Receipt Footer
            </CardTitle>
            <CardDescription>
              Return policy or Thank You message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
