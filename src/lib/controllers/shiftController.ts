import { supabase } from '../../lib/supabase';
import { TABLES } from '../../lib/constants';
import type { ShiftSession, ActionResponse, Sale } from '../../types'; // Import ActionResponse

type CashSaleRow = Pick<Sale, 'id' | 'grand_total'>;

type SalePaymentCashRow = {
  id?: string;
  sale_id?: string;
  amount?: number | string | null;
};

type CashTransactionType = 'pay_in' | 'pay_out' | 'drop';

type CashTransactionRow = {
  id?: string;
  amount?: number | string | null;
  type?: string | null;
  created_at?: string | null;
};

type CashTransactionTotals = {
  payIns: number;
  payOuts: number;
  drops: number;
  net: number;
};

type CashTransaction = {
  id: string;
  shift_id: string;
  amount: number;
  type: CashTransactionType;
  reason?: string | null;
  created_at?: string | null;
};

type ShiftStatus = {
  start_time: string;
  starting_cash: number;
  current_sales_cash: number;
  current_transactions_net: number;
  expected_drawer_balance: number;
};

type ShiftCashierRow = {
  full_name?: string | null;
};

type ShiftWithCashierRow = ShiftSession & {
  cashier?: ShiftCashierRow | ShiftCashierRow[] | null;
};

type ShiftWithCashier = ShiftSession & {
  cashier?: { name: string } | null;
};

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
  startTime: string,
  endTime?: string
): Promise<number> => {
  let salesQuery = supabase
    .from(TABLES.SALES)
    .select('id, grand_total')
    .eq('cashier_id', cashierId)
    .eq('payment_method', 'cash')
    .eq('status', 'completed')
    .gt('created_at', startTime);

  if (endTime) {
    salesQuery = salesQuery.lte('created_at', endTime);
  }

  const { data: salesData, error: salesError } = await salesQuery;

  if (salesError) {
    throw new Error(`Failed to calculate cash sales: ${salesError.message}`);
  }

  const rows = (salesData ?? []) as CashSaleRow[];
  let total = 0;

  for (const row of rows) {
    const label = row?.id ? `Sale ${row.id} total` : 'Sale total';
    total += parseAmount(row.grand_total, label);
  }

  let paymentsQuery = supabase
    .from(TABLES.SALE_PAYMENTS)
    .select(
      `id, sale_id, amount, sale:${TABLES.SALES}!inner(created_at, status, cashier_id, payment_method)`
    )
    .eq('method', 'cash')
    .eq('sale.status', 'completed')
    .eq('sale.cashier_id', cashierId)
    .eq('sale.payment_method', 'split')
    .gt('sale.created_at', startTime);

  if (endTime) {
    paymentsQuery = paymentsQuery.lte('sale.created_at', endTime);
  }

  const { data: paymentData, error: paymentError } = await paymentsQuery;

  if (paymentError) {
    throw new Error(
      `Failed to calculate split cash payments: ${paymentError.message}`
    );
  }

  const paymentRows = (paymentData ?? []) as SalePaymentCashRow[];

  for (const row of paymentRows) {
    const label = row?.id
      ? `Sale payment ${row.id} amount`
      : row?.sale_id
        ? `Sale ${row.sale_id} payment amount`
        : 'Sale payment amount';
    total += parseAmount(row.amount, label);
  }

  return total;
};

const calculateCashTransactions = async (
  shiftId: string,
  endTime?: string
): Promise<CashTransactionTotals> => {
  let query = supabase
    .from(TABLES.CASH_TRANSACTIONS)
    .select('id, amount, type, created_at')
    .eq('shift_id', shiftId);

  if (endTime) {
    query = query.lte('created_at', endTime);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch cash transactions: ${error.message}`);
  }

  const rows = (data ?? []) as CashTransactionRow[];
  let payIns = 0;
  let payOuts = 0;
  let drops = 0;

  for (const row of rows) {
    const label = row?.id
      ? `Cash transaction ${row.id} amount`
      : 'Cash transaction amount';
    const amount = parseAmount(row.amount, label);

    if (row.type === 'pay_in') {
      payIns += amount;
    } else if (row.type === 'pay_out') {
      payOuts += amount;
    } else if (row.type === 'drop') {
      drops += amount;
    } else {
      throw new Error(
        `Cash transaction ${row?.id ?? ''} has an invalid type`
      );
    }
  }

  return {
    payIns,
    payOuts,
    drops,
    net: payIns - (payOuts + drops),
  };
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

export const getAllShifts = async (): Promise<
  ActionResponse<ShiftWithCashier[]>
> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .select(`*, cashier:${TABLES.USERS}(full_name)`)
      .order('start_time', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as ShiftWithCashierRow[];
    const shifts = rows.map((row) => {
      const cashier = Array.isArray(row.cashier) ? row.cashier[0] : row.cashier;
      const cashierName =
        typeof cashier?.full_name === 'string' ? cashier.full_name.trim() : '';
      const { cashier: _cashier, ...rest } = row;

      return {
        ...rest,
        cashier: cashierName ? { name: cashierName } : null,
      };
    });

    return { success: true, data: shifts };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch shifts'),
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

    const distinctEndTime = new Date().toISOString();

    const cashSales = await calculateCashSales(
      currentShift.user_id,
      currentShift.start_time,
      distinctEndTime
    );

    const cashTransactions = await calculateCashTransactions(
      currentShift.id,
      distinctEndTime
    );

    const expectedCash = startingCash + cashSales + cashTransactions.net;
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
      end_time: distinctEndTime,
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

export const addCashTransaction = async (
  shiftId: string,
  amount: number,
  type: CashTransactionType,
  reason?: string
): Promise<ActionResponse<CashTransaction>> => {
  try {
    if (!shiftId) {
      throw new Error('Shift ID is required');
    }

    const safeAmount = parseAmount(amount, 'Transaction amount');

    if (type !== 'pay_in' && type !== 'pay_out' && type !== 'drop') {
      throw new Error('Transaction type is invalid');
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason) {
      throw new Error('Transaction reason is required');
    }

    const { data: shift, error: shiftError } = await supabase
      .from(TABLES.SHIFT_SESSIONS)
      .select('id, status')
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      throw new Error(shiftError?.message ?? 'Shift not found');
    }

    if ((shift as Pick<ShiftSession, 'status'>).status !== 'open') {
      throw new Error('Shift is already closed');
    }

    const { data: transaction, error: transactionError } = await supabase
      .from(TABLES.CASH_TRANSACTIONS)
      .insert({
        shift_id: shiftId,
        amount: safeAmount,
        type,
        reason: trimmedReason,
      })
      .select('*')
      .single();

    if (transactionError || !transaction) {
      throw new Error(
        transactionError?.message ?? 'Failed to add cash transaction'
      );
    }

    return { success: true, data: transaction as CashTransaction };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to add cash transaction'),
    };
  }
};

export const getShiftStatus = async (
  userId: string
): Promise<ActionResponse<ShiftStatus>> => {
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

    if (!data || data.length === 0) {
      throw new Error('No open shift found');
    }

    const shift = data[0] as ShiftSession;

    if (!shift.start_time) {
      throw new Error('Shift start time is missing');
    }

    const startingCash = parseAmount(shift.starting_cash, 'Starting cash');
    const snapshotTime = new Date().toISOString();

    const cashSales = await calculateCashSales(
      shift.user_id,
      shift.start_time,
      snapshotTime
    );

    const cashTransactions = await calculateCashTransactions(
      shift.id,
      snapshotTime
    );

    const expectedDrawerBalance =
      startingCash + cashSales + cashTransactions.net;

    return {
      success: true,
      data: {
        start_time: shift.start_time,
        starting_cash: startingCash,
        current_sales_cash: cashSales,
        current_transactions_net: cashTransactions.net,
        expected_drawer_balance: expectedDrawerBalance,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch shift status'),
    };
  }
};
