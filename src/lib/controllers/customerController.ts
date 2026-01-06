import { supabase } from '../../lib/supabase';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';
import type { Customer } from '../../types';

type ControllerResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type CustomerInsert = {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tax_id?: string;
};

type CustomerUpdate = Partial<
  Pick<Customer, 'name' | 'email' | 'address' | 'tax_id' | 'phone' | 'is_active'>
>;

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const isDuplicatePhoneError = (error: unknown) => {
  if (!error) {
    return false;
  }

  const err = error as SupabaseErrorLike;
  if (err.code === '23505') {
    return true;
  }

  const message = `${err.message ?? ''} ${err.details ?? ''}`.toLowerCase();
  return message.includes('duplicate') || message.includes('unique');
};

const ensurePhoneAvailable = async (phone: string, excludeId?: string) => {
  let query = supabase
    .from(TABLES.CUSTOMERS)
    .select('id')
    .eq('phone', phone)
    .limit(1);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  if (data && data.length > 0) {
    throw new Error('Customer with this phone already exists');
  }
};

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const searchCustomers = async (
  query: string
): Promise<ControllerResult<Customer[]>> => {
  try {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return { success: true, data: [] };
    }

    const search = `%${trimmedQuery}%`;
    const { data, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .select('*')
      .eq('is_active', true)
      .or(`phone.ilike.${search},name.ilike.${search}`)
      .limit(5);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Customer[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to search customers'),
    };
  }
};

export const getCustomers = async (
  page = 1
): Promise<ControllerResult<Customer[]>> => {
  try {
    const safePage = page > 0 ? page : 1;
    const from = (safePage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .select('*')
      .order('name', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Customer[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch customers'),
    };
  }
};

export const createCustomer = async (
  data: CustomerInsert
): Promise<ControllerResult<Customer>> => {
  try {
    const name = data.name?.trim();
    const phone = data.phone?.trim();
    const email = data.email?.trim();

    if (!name) {
      throw new Error('Customer name is required');
    }

    if (!phone) {
      throw new Error('Phone number is required');
    }

    if (email && !isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    await ensurePhoneAvailable(phone);

    const payload = {
      name,
      phone,
      email: email ?? null,
      address: data.address ?? null,
      tax_id: data.tax_id ?? null,
      loyalty_points: 0,
      is_active: true,
    };

    const { data: customer, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .insert(payload)
      .select('*')
      .single();

    if (error || !customer) {
      if (isDuplicatePhoneError(error)) {
        throw new Error('Customer with this phone already exists');
      }
      throw new Error(error?.message ?? 'Failed to create customer');
    }

    return { success: true, data: customer as Customer };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to create customer'),
    };
  }
};

export const getCustomerById = async (
  id: string
): Promise<ControllerResult<Customer>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Customer not found');
    }

    return { success: true, data: data as Customer };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to fetch customer'),
    };
  }
};

export const updateCustomer = async (
  id: string,
  data: CustomerUpdate
): Promise<ControllerResult<Customer>> => {
  try {
    const hasUpdates = Object.values(data).some((value) => value !== undefined);
    if (!hasUpdates) throw new Error('No updates provided');

    if (data.phone) {
      const trimmedPhone = data.phone.trim();
      if (!trimmedPhone) throw new Error('Phone cannot be empty');
      await ensurePhoneAvailable(trimmedPhone, id);
      data.phone = trimmedPhone;
    }

    if (data.name) data.name = data.name.trim();

    if (data.email) {
      const trimmedEmail = data.email.trim();
      if (!isValidEmail(trimmedEmail)) {
        throw new Error('Invalid email format');
      }
      data.email = trimmedEmail;
    }

    const { data: customer, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .update(data)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !customer) {
      if (isDuplicatePhoneError(error)) throw new Error('Phone already in use');
      throw new Error(error?.message ?? 'Failed to update customer');
    }

    return { success: true, data: customer as Customer };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update customer'),
    };
  }
};

export const deleteCustomer = async (
  id: string
): Promise<ControllerResult<Customer>> => {
  try {
    const { data: customer, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .update({ is_active: false })
      .eq('id', id)
      .select('*')
      .single();

    if (!error && customer) {
      return { success: true, data: customer as Customer };
    }

    const errorMessage = error?.message?.toLowerCase() ?? '';
    const missingIsActive =
      errorMessage.includes('is_active') && errorMessage.includes('column');

    if (!missingIsActive) {
      throw new Error(error?.message ?? 'Failed to delete customer');
    }

    const { data: sales, error: salesError } = await supabase
      .from(TABLES.SALES)
      .select('id')
      .eq('customer_id', id)
      .limit(1);

    if (salesError) {
      throw new Error(salesError.message);
    }

    if (sales && sales.length > 0) {
      throw new Error(
        'Customer has sales history. Hard delete is restricted to customers without sales.'
      );
    }

    const { data: deletedCustomer, error: deleteError } = await supabase
      .from(TABLES.CUSTOMERS)
      .delete()
      .eq('id', id)
      .select('*')
      .single();

    if (deleteError || !deletedCustomer) {
      throw new Error(deleteError?.message ?? 'Failed to delete customer');
    }

    return { success: true, data: deletedCustomer as Customer };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete customer'),
    };
  }
};

export const updateLoyaltyPoints = async (
  customerId: string,
  pointsChange: number
): Promise<ControllerResult<Customer>> => {
  try {
    const { data: customer, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .select('id, loyalty_points')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      throw new Error(error?.message ?? 'Customer not found');
    }

    const currentPoints = customer.loyalty_points ?? 0;
    const newTotal = currentPoints + pointsChange;

    const { data: updatedCustomer, error: updateError } = await supabase
      .from(TABLES.CUSTOMERS)
      .update({ loyalty_points: newTotal })
      .eq('id', customerId)
      .select('*')
      .single();

    if (updateError || !updatedCustomer) {
      throw new Error(updateError?.message ?? 'Failed to update loyalty points');
    }

    return { success: true, data: updatedCustomer as Customer };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update loyalty points'),
    };
  }
};

export const anonymizeCustomer = async (
  id: string
): Promise<ControllerResult<Customer>> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .update({
        name: `Deleted User ${id.slice(0, 8)}`,
        phone: `000000_${id.slice(0, 6)}`,
        email: null,
        address: null,
        tax_id: null,
        is_active: false,
        loyalty_points: 0,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: data as Customer };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to anonymize'),
    };
  }
};

export const adjustLoyaltyPointsSafe = async (
  customerId: string,
  amount: number
): Promise<ControllerResult<Customer>> => {
  try {
    const { data, error } = await supabase.rpc('increment_loyalty_points', {
      row_id: customerId,
      amount,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: data as Customer };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Loyalty update failed'),
    };
  }
};

export const bulkCreateCustomers = async (
  customers: CustomerInsert[]
): Promise<ControllerResult<Customer[]>> => {
  try {
    if (!customers.length) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .insert(customers)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Customer[] };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Bulk import failed'),
    };
  }
};

export const getAllCustomersForExport = async (): Promise<
  ControllerResult<Customer[]>
> => {
  try {
    const { data, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, data: (data ?? []) as Customer[] };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Export failed') };
  }
};
