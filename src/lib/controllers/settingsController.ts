import { supabase } from '../../lib/supabase';
import { TABLES } from '../../lib/constants';
import type { ActionResponse, Settings } from '../../types';

type SettingsInsert = Omit<Settings, 'id' | 'updated_at'>;
type SettingsUpdate = Partial<SettingsInsert>;

const SETTINGS_SINGLETON_ID = 1;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const fetchSettingsRow = async (): Promise<Settings | null> => {
  const { data, error } = await supabase
    .from(TABLES.SETTINGS)
    .select('*')
    .order('id', { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return data && data.length > 0 ? (data[0] as Settings) : null;
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
  data: SettingsUpdate
): Promise<ActionResponse<Settings>> => {
  try {
    const hasUpdates = Object.values(data).some(
      (value) => typeof value !== 'undefined'
    );

    if (!hasUpdates) {
      throw new Error('No settings updates provided');
    }

    const existing = await fetchSettingsRow();
    const payload = {
      ...data,
      id: existing?.id ?? SETTINGS_SINGLETON_ID,
    };

    const { data: updatedSettings, error } = await supabase
      .from(TABLES.SETTINGS)
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error || !updatedSettings) {
      throw new Error(error?.message ?? 'Failed to update settings');
    }

    return { success: true, data: updatedSettings as Settings };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update settings'),
    };
  }
};

export const initializeSettings = async (
  data: SettingsInsert
): Promise<ActionResponse<Settings>> => {
  try {
    const existing = await fetchSettingsRow();

    if (existing) {
      return { success: true, data: existing };
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

    return { success: true, data: createdSettings as Settings };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to initialize settings'),
    };
  }
};
