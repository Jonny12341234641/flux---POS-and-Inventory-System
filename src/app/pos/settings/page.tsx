'use client';

import { useState } from 'react';
import { Info, LayoutGrid, Monitor, Printer, Volume2 } from 'lucide-react';

import { usePosSettings } from '../../../hooks/usePosSettings';
import SettingsSection from '../../../components/pos/settings/SettingsSection';
import { SettingToggle } from '../../../components/pos/settings/SettingToggle';

const navTabs = [
  {
    id: 'general',
    label: 'General',
    description: 'Sound and touch',
    icon: Monitor,
  },
  {
    id: 'hardware',
    label: 'Hardware',
    description: 'Receipt printing',
    icon: Printer,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Grid layout',
    icon: LayoutGrid,
  },
  {
    id: 'about',
    label: 'About',
    description: 'System info',
    icon: Info,
  },
] as const;

type NavTab = (typeof navTabs)[number]['id'];

const buildReceiptHtml = (
  width: string,
  timestamp: string,
  rows: string,
  subtotal: number,
  tax: number,
  total: number
) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Test Receipt</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 12px;
        font-family: "Courier New", monospace;
        color: #111827;
      }
      .receipt {
        width: ${width};
      }
      .center { text-align: center; }
      .muted { color: #6b7280; font-size: 12px; }
      .row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        margin: 4px 0;
      }
      .divider {
        border-top: 1px dashed #9ca3af;
        margin: 10px 0;
      }
      .total {
        font-size: 14px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="center">
        <div><strong>Flux POS</strong></div>
        <div class="muted">Test Receipt</div>
        <div class="muted">${timestamp}</div>
      </div>
      <div class="divider"></div>
      ${rows}
      <div class="divider"></div>
      <div class="row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
      <div class="row"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
      <div class="row total"><span>Total</span><span>${total.toFixed(2)}</span></div>
      <div class="divider"></div>
      <div class="center muted">Thanks for testing the printer.</div>
    </div>
  </body>
</html>`;

export default function PosSettingsPage() {
  const { settings, updateSetting, resetSettings } = usePosSettings();
  const [activeTab, setActiveTab] = useState<NavTab>('general');
  const [copied, setCopied] = useState(false);

  const controlPadding = settings.touchMode ? 'py-3' : 'py-2';

  const handleCopyDeviceId = async () => {
    if (!settings.deviceId) return;

    try {
      await navigator.clipboard.writeText(settings.deviceId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.alert('Unable to copy device ID.');
    }
  };

  const handleFactoryReset = () => {
    const confirmed = window.confirm(
      'Factory reset clears local POS data stored in this browser. Continue?'
    );
    if (!confirmed) return;
    resetSettings();
  };

  const handleTestPrint = () => {
    const printWindow = window.open('', 'PRINT', 'width=420,height=640');
    if (!printWindow) {
      window.alert('Unable to open the print preview. Please allow popups.');
      return;
    }

    const items = [
      { name: 'Espresso', quantity: 1, price: 3.5 },
      { name: 'Croissant', quantity: 2, price: 2.75 },
      { name: 'Iced Tea', quantity: 1, price: 2.2 },
    ];
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const tax = subtotal * 0.08;
    const total = subtotal + tax;
    const rows = items
      .map(
        (item) =>
          `<div class="row"><span>${item.name} x${item.quantity}</span><span>${(
            item.quantity * item.price
          ).toFixed(2)}</span></div>`
      )
      .join('');

    const html = buildReceiptHtml(
      settings.receiptWidth,
      new Date().toLocaleString(),
      rows,
      subtotal,
      tax,
      total
    );

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="space-y-6 pb-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">
          POS Settings
        </h1>
        <p className="text-sm text-slate-500">
          Terminal preferences are stored only on this device.
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6">
            <nav className="space-y-1">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="flex flex-col">
                      <span>{tab.label}</span>
                      <span className="text-xs text-slate-400">
                        {tab.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex-1 space-y-6">
          {activeTab === 'general' ? (
            <SettingsSection
              title={
                <span className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-slate-500" />
                  General Preferences
                </span>
              }
              description="Sound cues and touch-friendly controls for this terminal."
            >
              <div
                className="space-y-3 group"
                data-touch-mode={settings.touchMode}
              >
                <SettingToggle
                  label="Sound effects"
                  description="Enable key taps and alerts at checkout."
                  checked={settings.soundEnabled}
                  onChange={(value) =>
                    updateSetting('soundEnabled', value)
                  }
                />
                <SettingToggle
                  label="Touch mode"
                  description="Increase padding for quick taps."
                  checked={settings.touchMode}
                  onChange={(value) => updateSetting('touchMode', value)}
                />
              </div>
              {settings.touchMode ? (
                <p className="mt-3 text-xs text-emerald-600">
                  Touch mode is enabled. Buttons and spacing are expanded.
                </p>
              ) : null}
            </SettingsSection>
          ) : null}

          {activeTab === 'hardware' ? (
            <SettingsSection
              title={
                <span className="flex items-center gap-2">
                  <Printer className="h-4 w-4 text-slate-500" />
                  Hardware and Printing
                </span>
              }
              description="Receipt printer behavior for this terminal."
            >
              <div
                className="space-y-3 group"
                data-touch-mode={settings.touchMode}
              >
                <SettingToggle
                  label="Auto-print receipt"
                  description="Print immediately after checkout."
                  checked={settings.autoPrintReceipt}
                  onChange={(value) =>
                    updateSetting('autoPrintReceipt', value)
                  }
                />
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Receipt width
                </p>
                <p className="text-xs text-slate-500">
                  Match the paper roll size in your printer.
                </p>
                <div
                  className="grid gap-2 sm:grid-cols-2 group"
                  data-touch-mode={settings.touchMode}
                >
                  {(['58mm', '80mm'] as const).map((size) => {
                    const isActive = settings.receiptWidth === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => updateSetting('receiptWidth', size)}
                        aria-pressed={isActive}
                        className={`rounded-xl border px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${controlPadding} ${
                          isActive
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Test printer
                </p>
                <p className="text-xs text-slate-500">
                  Prints a sample receipt to validate alignment.
                </p>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  className={`inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${controlPadding}`}
                >
                  Print test receipt
                </button>
              </div>
            </SettingsSection>
          ) : null}

          {activeTab === 'appearance' ? (
            <SettingsSection
              title={
                <span className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-slate-500" />
                  Appearance
                </span>
              }
              description="Layout density for product and order grids."
            >
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Grid layout
                </p>
                <p className="text-xs text-slate-500">
                  Compact fits more tiles, comfortable gives breathing room.
                </p>
                <div
                  className="grid gap-2 sm:grid-cols-2 group"
                  data-touch-mode={settings.touchMode}
                >
                  {(['comfortable', 'compact'] as const).map((density) => {
                    const isActive = settings.gridDensity === density;
                    const label =
                      density === 'comfortable' ? 'Comfortable' : 'Compact';

                    return (
                      <button
                        key={density}
                        type="button"
                        onClick={() => updateSetting('gridDensity', density)}
                        aria-pressed={isActive}
                        className={`rounded-xl border px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${controlPadding} ${
                          isActive
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </SettingsSection>
          ) : null}

          {activeTab === 'about' ? (
            <SettingsSection
              title={
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-slate-500" />
                  About and System
                </span>
              }
              description="Local terminal details and reset controls."
            >
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        Device ID
                      </p>
                      <p className="text-xs text-slate-500">
                        Unique identifier stored on this device.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyDeviceId}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="mt-3 rounded-md bg-white px-3 py-2 font-mono text-xs text-slate-700">
                    {settings.deviceId || 'Generating...'}
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">
                      Version
                    </p>
                    <p className="text-xs text-slate-500">
                      POS interface build
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">
                    v1.0.0
                  </span>
                </div>

                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-red-700">
                      Factory Reset Terminal
                    </p>
                    <p className="text-xs text-red-600">
                      Clears local POS data stored in this browser.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleFactoryReset}
                    className={`mt-3 inline-flex items-center justify-center rounded-xl border border-red-300 bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 ${controlPadding}`}
                  >
                    Factory Reset Terminal
                  </button>
                </div>
              </div>
            </SettingsSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
