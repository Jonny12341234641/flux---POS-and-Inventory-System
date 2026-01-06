import { supabase } from '../../lib/supabase';
import { ITEMS_PER_PAGE, TABLES } from '../../lib/constants';
import type { Customer } from '../../types';
import { z } from 'zod';

type ControllerResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type CustomerInsert = {
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  tax_id?: string | null;
  store_credit?: number | null;
  tier_id?: string | null;
};

type CustomerUpdate = Partial<Pick<Customer, 'name' | 'phone' | 'is_active'>> & {
  email?: string | null;
  address?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  tax_id?: string | null;
  store_credit?: number | null;
  tier_id?: string | null;
};

type CustomerSearchParams = {
  page?: number;
  limit?: number;
  min_loyalty_points?: number;
  created_after_date?: string | Date;
};

type LoyaltyLog = {
  id: string;
  customer_id: string;
  points_change: number;
  reason: string;
  created_by?: string | null;
  created_at?: string;
};

type CustomerAuditAction = 'CUSTOMER_CREATE' | 'CUSTOMER_UPDATE';
type CustomerAuditDetails = Record<string, unknown> | string | null;

type CustomerAddressInput = {
  address?: string | null;
  address_street?: string | null;
};

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof z.ZodError && error.errors.length > 0) {
    return error.errors[0]?.message ?? fallback;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
};

const escapeHtml = (value: string) => {
  return value.replace(/[<>]/g, (char) => (char === '<' ? '&lt;' : '&gt;'));
};

const sanitizeString = (value: string) => {
  return escapeHtml(value.trim());
};

const sanitizeSearchQuery = (value: string) => {
  return sanitizeString(value).replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
};

const normalizeRequiredString = (value: unknown) => {
  if (typeof value !== 'string') {
    return value;
  }
  return sanitizeString(value);
};

const normalizeNullableString = (value: unknown) => {
  if (value === null || typeof value === 'undefined') {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const sanitized = sanitizeString(value);
  return sanitized ? sanitized : null;
};

const coerceNumber = (value: unknown) => {
  if (value === null || typeof value === 'undefined') {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value;
};

const normalizePhoneNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  if (!hasPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return `+${digits}`;
};

const buildAnonymizedPhone = (id: string) => {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000000000000;
  }
  const padded = hash.toString().padStart(12, '0');
  return `+99${padded}`;
};

const normalizeDateString = (value: unknown) => {
  if (value === null || typeof value === 'undefined') {
    return undefined;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return value;
    }
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const timestamp = Date.parse(trimmed);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }
  return value;
};

const isValidEmail = (email: string) => {
  return EMAIL_REGEX.test(email);
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

const OptionalSanitizedStringSchema = z.preprocess(
  normalizeNullableString,
  z.string().min(1).nullable().optional()
);

const OptionalEmailSchema = z.preprocess(
  normalizeNullableString,
  z
    .string()
    .refine(isValidEmail, { message: 'Invalid email format' })
    .nullable()
    .optional()
);

const PhoneSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .string()
    .min(1, 'Phone number is required')
    .transform((value, ctx) => {
      const normalized = normalizePhoneNumber(value);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid phone number format',
        });
        return z.NEVER;
      }
      return normalized;
    })
);

const CustomerInsertSchema = z
  .object({
    name: z.preprocess(
      normalizeRequiredString,
      z.string().min(1, 'Customer name is required')
    ),
    phone: PhoneSchema,
    email: OptionalEmailSchema,
    address: OptionalSanitizedStringSchema,
    address_street: OptionalSanitizedStringSchema,
    address_city: OptionalSanitizedStringSchema,
    address_state: OptionalSanitizedStringSchema,
    address_zip: OptionalSanitizedStringSchema,
    tax_id: OptionalSanitizedStringSchema,
    store_credit: z.preprocess(coerceNumber, z.number().min(0).optional()),
    tier_id: OptionalSanitizedStringSchema,
  })
  .strict();

const CustomerUpdateSchema = CustomerInsertSchema.partial().extend({
  is_active: z.boolean().optional(),
});

const CustomerSearchSchema = z
  .object({
    page: z.preprocess(coerceNumber, z.number().int().min(1).default(1)),
    limit: z.preprocess(
      coerceNumber,
      z.number().int().min(1).max(100).default(50)
    ),
    min_loyalty_points: z.preprocess(
      coerceNumber,
      z.number().min(0).optional()
    ),
    created_after_date: z.preprocess(
      normalizeDateString,
      z.string().datetime().optional()
    ),
  })
  .strict();

const LoyaltyTransactionSchema = z
  .object({
    customer_id: z.preprocess(
      normalizeRequiredString,
      z.string().min(1, 'Customer id is required')
    ),
    amount: z.preprocess(coerceNumber, z.number().int()),
    reason: z.preprocess(
      normalizeRequiredString,
      z.string().min(1, 'Reason is required')
    ),
    created_by: z.preprocess(
      normalizeNullableString,
      z.string().min(1).nullable().optional()
    ),
  })
  .strict();

const applyLegacyAddress = <T extends CustomerAddressInput>(data: T) => {
  if (!Object.prototype.hasOwnProperty.call(data, 'address')) {
    return data;
  }
  if (typeof data.address_street !== 'undefined') {
    return data;
  }
  return {
    ...data,
    address_street: data.address ?? null,
  };
};

const normalizeAuditDetails = (details: CustomerAuditDetails): string | null => {
  if (details === null || typeof details === 'undefined') {
    return null;
  }
  if (typeof details === 'string') {
    return details;
  }
  return JSON.stringify(details);
};

const logCustomerAudit = async (
  userId: string,
  action: CustomerAuditAction,
  details: CustomerAuditDetails
): Promise<void> => {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      details: normalizeAuditDetails(details),
      ip_address: null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error(
      'Customer audit log failed:',
      getErrorMessage(error, 'Audit log error')
    );
  }
};

export const searchCustomers = async (
  query: string,
  options: CustomerSearchParams = {}
): Promise<ControllerResult<Customer[]>> => {
  try {
    const trimmedQuery = sanitizeSearchQuery(query ?? '');
    const { page, limit, min_loyalty_points, created_after_date } =
      CustomerSearchSchema.parse(options ?? {});

    const hasFilters =
      Boolean(trimmedQuery) ||
      typeof min_loyalty_points !== 'undefined' ||
      typeof created_after_date !== 'undefined';

    if (!hasFilters) {
      return { success: true, data: [] };
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let request = supabase
      .from(TABLES.CUSTOMERS)
      .select('*')
      .eq('is_active', true);

    if (trimmedQuery) {
      const search = `%${trimmedQuery}%`;
      request = request.or(
        `phone.ilike.${search},name.ilike.${search},email.ilike.${search}`
      );
    }

    if (typeof min_loyalty_points !== 'undefined') {
      request = request.gte('loyalty_points', min_loyalty_points);
    }

    if (created_after_date) {
      request = request.gte('created_at', created_after_date);
    }

    const { data, error } = await request
      .order('created_at', { ascending: false })
      .range(from, to);

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
  data: CustomerInsert,
  actorId?: string
): Promise<ControllerResult<Customer>> => {
  try {
    const parsed = CustomerInsertSchema.parse(data);
    const normalized = applyLegacyAddress(parsed);
    const normalizedData = { ...normalized };
    if ('address' in normalizedData) {
      delete normalizedData.address;
    }

    await ensurePhoneAvailable(normalizedData.phone);

    const payload = {
      name: normalizedData.name,
      phone: normalizedData.phone,
      email: normalizedData.email ?? null,
      address_street: normalizedData.address_street ?? null,
      address_city: normalizedData.address_city ?? null,
      address_state: normalizedData.address_state ?? null,
      address_zip: normalizedData.address_zip ?? null,
      tax_id: normalizedData.tax_id ?? null,
      store_credit: normalizedData.store_credit ?? 0,
      tier_id: normalizedData.tier_id ?? null,
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

    if (actorId) {
      await logCustomerAudit(actorId, 'CUSTOMER_CREATE', {
        customer_id: customer.id,
      });
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
  data: CustomerUpdate,
  actorId?: string
): Promise<ControllerResult<Customer>> => {
  try {
    const parsed = CustomerUpdateSchema.parse(data);
    const normalized = applyLegacyAddress(parsed);
    const updates = { ...normalized };
    if ('address' in updates) {
      delete updates.address;
    }
    const hasUpdates = Object.values(updates).some((value) => value !== undefined);
    if (!hasUpdates) {
      throw new Error('No updates provided');
    }

    if (updates.phone) {
      await ensurePhoneAvailable(updates.phone, id);
    }

    const { data: customer, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error || !customer) {
      if (isDuplicatePhoneError(error)) throw new Error('Phone already in use');
      throw new Error(error?.message ?? 'Failed to update customer');
    }

    if (actorId) {
      const fields = Object.entries(updates)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      await logCustomerAudit(actorId, 'CUSTOMER_UPDATE', {
        customer_id: id,
        fields,
      });
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

export const addLoyaltyTransaction = async (
  customerId: string,
  amount: number,
  reason: string,
  actorId?: string
): Promise<ControllerResult<LoyaltyLog>> => {
  try {
    const parsed = LoyaltyTransactionSchema.parse({
      customer_id: customerId,
      amount,
      reason,
      created_by: actorId ?? null,
    });

    const { data, error } = await supabase
      .from('loyalty_logs')
      .insert({
        customer_id: parsed.customer_id,
        points_change: parsed.amount,
        reason: parsed.reason,
        created_by: parsed.created_by ?? null,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to log loyalty transaction');
    }

    return { success: true, data: data as LoyaltyLog };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to log loyalty transaction'),
    };
  }
};

export const updateLoyaltyPoints = async (
  customerId: string,
  pointsChange: number,
  reason: string,
  actorId?: string
): Promise<ControllerResult<Customer>> => {
  try {
    const transactionInput = LoyaltyTransactionSchema.parse({
      customer_id: customerId,
      amount: pointsChange,
      reason,
      created_by: actorId ?? null,
    });

    const { data: customer, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .select('id, loyalty_points')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      throw new Error(error?.message ?? 'Customer not found');
    }

    const currentPoints = customer.loyalty_points ?? 0;
    const newTotal = currentPoints + transactionInput.amount;

    const { data: updatedCustomer, error: updateError } = await supabase
      .from(TABLES.CUSTOMERS)
      .update({ loyalty_points: newTotal })
      .eq('id', customerId)
      .select('*')
      .single();

    if (updateError || !updatedCustomer) {
      throw new Error(updateError?.message ?? 'Failed to update loyalty points');
    }

    const logResult = await addLoyaltyTransaction(
      transactionInput.customer_id,
      transactionInput.amount,
      transactionInput.reason,
      transactionInput.created_by ?? undefined
    );
    if (!logResult.success) {
      throw new Error(
        logResult.error ?? 'Failed to log loyalty transaction'
      );
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
        name: 'Deleted User',
        phone: buildAnonymizedPhone(id),
        email: null,
        address_street: null,
        address_city: null,
        address_state: null,
        address_zip: null,
        tax_id: null,
        tier_id: null,
        store_credit: 0,
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
  amount: number,
  reason: string,
  actorId?: string
): Promise<ControllerResult<Customer>> => {
  try {
    const transactionInput = LoyaltyTransactionSchema.parse({
      customer_id: customerId,
      amount,
      reason,
      created_by: actorId ?? null,
    });

    const { data, error } = await supabase.rpc('increment_loyalty_points', {
      row_id: transactionInput.customer_id,
      amount: transactionInput.amount,
    });

    if (error) {
      throw new Error(error.message);
    }

    const logResult = await addLoyaltyTransaction(
      transactionInput.customer_id,
      transactionInput.amount,
      transactionInput.reason,
      transactionInput.created_by ?? undefined
    );
    if (!logResult.success) {
      throw new Error(
        logResult.error ?? 'Failed to log loyalty transaction'
      );
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

    const parsedCustomers = CustomerInsertSchema.array().parse(customers);
    const payload = parsedCustomers.map((customer) => {
      const normalized = applyLegacyAddress(customer);
      const normalizedData = { ...normalized };
      if ('address' in normalizedData) {
        delete normalizedData.address;
      }
      return {
        name: normalizedData.name,
        phone: normalizedData.phone,
        email: normalizedData.email ?? null,
        address_street: normalizedData.address_street ?? null,
        address_city: normalizedData.address_city ?? null,
        address_state: normalizedData.address_state ?? null,
        address_zip: normalizedData.address_zip ?? null,
        tax_id: normalizedData.tax_id ?? null,
        store_credit: normalizedData.store_credit ?? 0,
        tier_id: normalizedData.tier_id ?? null,
        loyalty_points: 0,
        is_active: true,
      };
    });

    const { data, error } = await supabase
      .from(TABLES.CUSTOMERS)
      .insert(payload)
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
