import { SupabaseClient } from '@supabase/supabase-js';
import { supabase as defaultSupabase } from '../../lib/supabase';
import { LOW_STOCK_THRESHOLD, TABLES } from '../../lib/constants';
import type { ActionResponse, Settings } from '../../types';

type SettingsInsert = Omit<Settings, 'id' | 'updated_at'>;
type SettingsUpdate = Partial<SettingsInsert>;

const SETTINGS_SINGLETON_ID = 1;

const buildDefaultSettings = (): Settings => ({
  id: SETTINGS_SINGLETON_ID,
  store_name: 'Flux Store',
  store_address: '123 Galle Road, Colombo',
  store_phone: '+94 11 234 5678',
  currency_symbol: 'LKR',
  default_tax_rate: 2.5,
  tax_enabled: true,
  low_stock_threshold: LOW_STOCK_THRESHOLD,
  receipt_footer: 'No refunds after 7 days',
  updated_at: new Date().toISOString(),
});

const validateSettings = (data: SettingsUpdate): string | null => {
  if (typeof data.store_name !== 'undefined') {
    if (typeof data.store_name !== 'string' || data.store_name.trim().length < 2) {
      return 'Store name must be at least 2 characters long.';
    }
  }

  if (data.store_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.store_email)) {
      return 'Invalid email address format.';
    }
  }

  if (typeof data.store_address !== 'undefined') {
    if (typeof data.store_address !== 'string' || !data.store_address.trim()) {
      return 'Store address is required.';
    }
  }

  if (typeof data.store_phone !== 'undefined') {
    if (typeof data.store_phone !== 'string' || !data.store_phone.trim()) {
      return 'Store phone is required.';
    }
  }

  if (typeof data.currency_symbol !== 'undefined') {
    if (
      typeof data.currency_symbol !== 'string' ||
      !data.currency_symbol.trim()
    ) {
      return 'Currency symbol is required.';
    }
  }

  if (typeof data.default_tax_rate !== 'undefined') {
    const rawValue = data.default_tax_rate;

    // Handle null explicitly if needed
    if (rawValue === null) {
      return 'Tax rate must be a number.';
    }

    // Safe parsing that doesn't rely on string methods like .trim() immediately
    const parsedRate = typeof rawValue === 'number' 
      ? rawValue 
      : parseFloat(String(rawValue));

    if (!Number.isFinite(parsedRate)) {
      return 'Tax rate must be a number.';
    }

    if (parsedRate < 0 || parsedRate > 100) {
      return 'Tax rate must be between 0 and 100.';
    }
  }

  if (
    typeof data.tax_enabled !== 'undefined' &&
    typeof data.tax_enabled !== 'boolean'
  ) {
    return 'Tax enabled status must be a boolean.';
  }

  if (typeof data.low_stock_threshold !== 'undefined') {
    if (data.low_stock_threshold === null) {
      return 'Low stock threshold must be a number.';
    }
    const parsedThreshold = Number(data.low_stock_threshold);
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
      return 'Low stock threshold must be 0 or higher.';
    }
  }

  return null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const logSettingsChange = async (
  userId: string,
  action: string,
  details: string,
  supabaseClient?: SupabaseClient
) => {
  const supabase = supabaseClient ?? defaultSupabase;
  try {
    await supabase.from(TABLES.AUDIT_LOGS).insert({
      user_id: userId,
      action: `SETTINGS_${action}`,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Audit logging failed:', err);
  }
};

export const getSettings = async (
  supabase: SupabaseClient
): Promise<ActionResponse<Settings | null>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SETTINGS)
      .select('*')
      .eq('id', SETTINGS_SINGLETON_ID)
      .maybeSingle();

    if (error) throw new Error(error.message);

    // Return default settings if no row exists (Singleton pattern)
    return { success: true, data: data ?? buildDefaultSettings() };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch settings'),
    };
  }
};

export const updateSettings = async (
  supabase: SupabaseClient,
  data: SettingsUpdate,
  userId: string
): Promise<ActionResponse<Settings>> => {
  try {
    const hasUpdates = Object.values(data).some(
      (value) => typeof value !== 'undefined'
    );

    if (!hasUpdates) {
      throw new Error('No settings updates provided');
    }

    const validationError = validateSettings(data);
    if (validationError) {
      throw new Error(validationError);
    }

    // Force ID to 1 (Singleton) and use Upsert
    const { data: updatedSettings, error } = await supabase
      .from(TABLES.SETTINGS)
      .upsert({
        id: SETTINGS_SINGLETON_ID,
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!updatedSettings) throw new Error('Failed to update settings');

    const changedFields = Object.keys(data).join(', ');
    await logSettingsChange(
      userId,
      'UPDATE',
      `Updated fields: ${changedFields}`,
      supabase
    );

    return { success: true, data: updatedSettings as Settings };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update settings'),
    };
  }
};

export const initializeSettings = async (
  data: SettingsInsert,
  userId?: string,
  supabaseClient?: SupabaseClient
): Promise<ActionResponse<Settings>> => {
  const supabase = supabaseClient ?? defaultSupabase;
  try {
    // Check if settings already exist
    const { data: existing } = await getSettings(supabase);
    // Note: getSettings now returns defaults if not found, but let's check DB directly if we want strict init
    // However, keeping logic similar to before:
    
    const { data: dbRow } = await supabase
        .from(TABLES.SETTINGS)
        .select('*')
        .eq('id', SETTINGS_SINGLETON_ID)
        .maybeSingle();

    if (dbRow) {
      return { success: true, data: dbRow as Settings };
    }

    const validationError = validateSettings(data);
    if (validationError) {
      throw new Error(validationError);
    }

    const payload = { ...data, id: SETTINGS_SINGLETON_ID };
    const { data: createdSettings, error } = await supabase
      .from(TABLES.SETTINGS)
      .insert(payload)
      .select('*')
      .single();

    if (error || !createdSettings) {
      throw new Error(error?.message ?? 'Failed to initialize settings');
    }

    if (userId) {
      await logSettingsChange(userId, 'INIT', 'Initialized system settings', supabase);
    }

    return { success: true, data: createdSettings as Settings };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to initialize settings'),
    };
  }
};
