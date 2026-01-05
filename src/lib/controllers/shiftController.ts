import { supabase } from '@/lib/supabase';
import { TABLES } from '@/lib/constants';
import type { ShiftSession, ActionResponse, Sale } from '@/types'; // Import ActionResponse

type CashSaleRow = Pick<Sale, 'id' | 'grand_total'>;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const parseAmount = (
  value: unknown,
  label: string,
  allowNegative = false
) => {
  let numericValue = NaN;

  if (typeof value === 'number') {
    numericValue = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error(`${label} is invalid`);
    }
    numericValue = Number(trimmed);
  }

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${label} is invalid`);
  }

  if (!allowNegative && numericValue < 0) {
    throw new Error(`${label} cannot be negative`);
  }

  return numericValue;
};

const calculateCashSales = async (
  cashierId: string,
  startTime: string
): Promise<number> => {
  const { data, error } = await supabase
    .from(TABLES.SALES)
    .select('id, grand_total')
    .eq('cashier_id', cashierId)
    .eq('payment_method', 'cash')
    .eq('status', 'completed')
    .gt('created_at', startTime);

  if (error) {
    throw new Error(`Failed to calculate cash sales: ${error.message}`);
  }

  const rows = (data ?? []) as CashSaleRow[];
  let total = 0;

  for (const row of rows) {
    const label = row?.id ? `Sale ${row.id} total` : 'Sale total';
    total += parseAmount(row.grand_total, label);
  }

  return total;
};

// Use ActionResponse<ShiftSession> instead of ControllerResult
export const openShift = async (
  userId: string,
  startingCash: number
): Promise<ActionResponse<ShiftSession>> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const safeStartingCash = parseAmount(startingCash, 'Starting cash');

    const { data: existingShift, error: existingError } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'open')
      .limit(1);

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existingShift && existingShift.length > 0) {
      throw new Error('You already have an open shift');
    }

    const now = new Date().toISOString();
    const { data: shift, error: shiftError } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .insert({
        user_id: userId,
        start_time: now,
        starting_cash: safeStartingCash,
        cash_sales: 0,
        expected_cash: safeStartingCash,
        status: 'open',
      })
      .select('*')
      .single();

    if (shiftError || !shift) {
      throw new Error(shiftError?.message ?? 'Failed to open shift');
    }

    return { success: true, data: shift as ShiftSession };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to open shift'),
    };
  }
};

export const getCurrentShift = async (
  userId: string
): Promise<ActionResponse<ShiftSession | null>> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('start_time', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const shift = data && data.length > 0 ? (data[0] as ShiftSession) : null;

    return { success: true, data: shift }; // Ensure data handles null correctly
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch current shift'),
    };
  }
};

export const closeShift = async (
  shiftId: string,
  endingCash: number,
  notes?: string
): Promise<ActionResponse<ShiftSession>> => {
  try {
    if (!shiftId) {
      throw new Error('Shift ID is required');
    }

    const safeEndingCash = parseAmount(endingCash, 'Ending cash');

    const { data: shift, error: shiftError } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .select('*')
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      throw new Error(shiftError?.message ?? 'Shift not found');
    }

    const currentShift = shift as ShiftSession;

    if (currentShift.status !== 'open') {
      throw new Error('Shift is already closed');
    }

    if (!currentShift.user_id) {
      throw new Error('Shift user is missing');
    }

    if (!currentShift.start_time) {
      throw new Error('Shift start time is missing');
    }

    const startingCash = parseAmount(
      currentShift.starting_cash,
      'Starting cash'
    );

    const cashSales = await calculateCashSales(
      currentShift.user_id,
      currentShift.start_time
    );

    const expectedCash = startingCash + cashSales;
    const difference = safeEndingCash - expectedCash;

    const updatePayload: Partial<ShiftSession> & {
      end_time: string;
      ending_cash: number;
      cash_sales: number;
      expected_cash: number;
      difference: number;
      status: 'closed';
      notes?: string;
    } = {
      end_time: new Date().toISOString(),
      ending_cash: safeEndingCash,
      cash_sales: cashSales,
      expected_cash: expectedCash,
      difference,
      status: 'closed',
    };

    if (typeof notes === 'string') {
      updatePayload.notes = notes;
    }

    const { data: updatedShift, error: updateError } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .update(updatePayload)
      .eq('id', shiftId)
      .select('*')
      .single();

    if (updateError || !updatedShift) {
      throw new Error(updateError?.message ?? 'Failed to close shift');
    }

    return { success: true, data: updatedShift as ShiftSession };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to close shift'),
    };
  }
};