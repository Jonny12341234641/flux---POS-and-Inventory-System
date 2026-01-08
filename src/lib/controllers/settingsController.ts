import { supabase } from '../../lib/supabase';
import { TABLES } from '../../lib/constants';
import type { ActionResponse, Settings } from '../../types';

type SettingsInsert = Omit<Settings, 'id' | 'updated_at'>;
type SettingsUpdate = Partial<SettingsInsert>;

const SETTINGS_SINGLETON_ID = 1;

const validateSettings = (data: SettingsUpdate): string | null => {
  if (typeof data.store_name !== 'undefined') {
    if (data.store_name.trim().length < 2) {
      return 'Store name must be at least 2 characters long.';
    }
  }

  if (data.store_email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.store_email)) {
      return 'Invalid email address format.';
    }
  }

  if (typeof data.default_tax_rate === 'number') {
    if (data.default_tax_rate < 0 || data.default_tax_rate > 1) {
      return 'Tax rate must be between 0 (0%) and 1 (100%).';
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
  details: string
) => {
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

const fetchSettingsRow = async (): Promise<Settings | null> => {
  const { data, error } = await supabase
    .from(TABLES.SETTINGS)
    .select('*')
    .eq('id', SETTINGS_SINGLETON_ID)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Settings | null;
};

export const getSettings = async (): Promise<
  ActionResponse<Settings | null>
> => {
  try {
    const settings = await fetchSettingsRow();
    return { success: true, data: settings };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch settings'),
    };
  }
};

export const updateSettings = async (
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

    const payload = {
      ...data,
      id: SETTINGS_SINGLETON_ID,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSettings, error } = await supabase
      .from(TABLES.SETTINGS)
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error || !updatedSettings) {
      throw new Error(error?.message ?? 'Failed to update settings');
    }

    const changedFields = Object.keys(data).join(', ');
    await logSettingsChange(
      userId,
      'UPDATE',
      `Updated fields: ${changedFields}`
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
  userId?: string
): Promise<ActionResponse<Settings>> => {
  try {
    const existing = await fetchSettingsRow();

    if (existing) {
      return { success: true, data: existing };
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
      await logSettingsChange(userId, 'INIT', 'Initialized system settings');
    }

    return { success: true, data: createdSettings as Settings };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to initialize settings'),
    };
  }
};
