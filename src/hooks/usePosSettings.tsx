'use client';

import { useCallback, useEffect, useState } from 'react';

export type PosSettings = {
  soundEnabled: boolean;
  touchMode: boolean;
  gridDensity: 'comfortable' | 'compact';
  autoPrintReceipt: boolean;
  receiptWidth: '58mm' | '80mm';
  deviceId: string;
};

const STORAGE_KEY = 'pos-terminal-settings';

const DEFAULT_SETTINGS: Omit<PosSettings, 'deviceId'> = {
  soundEnabled: true,
  touchMode: false,
  gridDensity: 'comfortable',
  autoPrintReceipt: false,
  receiptWidth: '80mm',
};

const isGridDensity = (value: unknown): value is PosSettings['gridDensity'] =>
  value === 'comfortable' || value === 'compact';

const isReceiptWidth = (value: unknown): value is PosSettings['receiptWidth'] =>
  value === '58mm' || value === '80mm';

const parseSettings = (raw: unknown): PosSettings => {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS, deviceId: '' };
  }

  const record = raw as Record<string, unknown>;

  return {
    soundEnabled:
      typeof record.soundEnabled === 'boolean'
        ? record.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
    touchMode:
      typeof record.touchMode === 'boolean'
        ? record.touchMode
        : DEFAULT_SETTINGS.touchMode,
    gridDensity: isGridDensity(record.gridDensity)
      ? record.gridDensity
      : DEFAULT_SETTINGS.gridDensity,
    autoPrintReceipt:
      typeof record.autoPrintReceipt === 'boolean'
        ? record.autoPrintReceipt
        : DEFAULT_SETTINGS.autoPrintReceipt,
    receiptWidth: isReceiptWidth(record.receiptWidth)
      ? record.receiptWidth
      : DEFAULT_SETTINGS.receiptWidth,
    deviceId:
      typeof record.deviceId === 'string' && record.deviceId.trim()
        ? record.deviceId
        : '',
  };
};

const createDeviceId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `pos-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const usePosSettings = () => {
  const [settings, setSettings] = useState<PosSettings>(() => ({
    ...DEFAULT_SETTINGS,
    deviceId: '',
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = localStorage.getItem(STORAGE_KEY);
    let parsed: PosSettings = { ...DEFAULT_SETTINGS, deviceId: '' };

    if (stored) {
      try {
        parsed = parseSettings(JSON.parse(stored));
      } catch {
        parsed = { ...DEFAULT_SETTINGS, deviceId: '' };
      }
    }

    const deviceId = parsed.deviceId || createDeviceId();
    const next = { ...parsed, deviceId };

    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updateSetting = useCallback(
    <Key extends keyof PosSettings>(
      key: Key,
      value: PosSettings[Key]
    ) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    },
    []
  );

  const resetSettings = useCallback(() => {
    const next = {
      ...DEFAULT_SETTINGS,
      deviceId: createDeviceId(),
    };

    setSettings(next);
    if (typeof window !== 'undefined') {
      localStorage.clear();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  return { settings, updateSetting, resetSettings };
};
