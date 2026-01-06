// App metadata and branding values.
export const APP_NAME = 'Flux Retail';
export const COMPANY_NAME = 'Flux Inc.';
export const SUPPORT_EMAIL = 'support@fluxretail.com';

// Database table names used across the app (source of truth).
export const TABLES = {
  USERS: 'users',
  CATEGORIES: 'categories',
  SUPPLIERS: 'suppliers',
  PRODUCTS: 'products',
  PURCHASE_ORDERS: 'purchase_orders',
  PURCHASE_ITEMS: 'purchase_items',
  CUSTOMERS: 'customers',
  SALES: 'sales',
  SALE_ITEMS: 'sale_items',
  SALE_PAYMENTS: 'sale_payments',
  STOCK_MOVEMENTS: 'stock_movements',
  SHIFT_SESSIONS: 'shift_sessions',
  SETTINGS: 'settings',
} as const;

// Financial defaults and formatting fallbacks.
export const DEFAULT_CURRENCY = '$';
export const DEFAULT_TAX_RATE = 0.15;
export const CURRENCY_LOCALE = 'en-US';

// Status enums for business logic consistency.
export const ORDER_STATUS = {
  PENDING: 'pending',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
} as const;

export const SALE_STATUS = {
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
  DRAFT: 'draft',
} as const;

export const SHIFT_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

export const USER_ROLE = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
} as const;

export const STOCK_MOVEMENT_TYPE = {
  SALE: 'sale',
  PURCHASE: 'purchase',
  RETURN: 'return',
  ADJUSTMENT: 'adjustment',
  DAMAGE: 'damage',
} as const;

// UI defaults and pagination thresholds.
export const ITEMS_PER_PAGE = 10;
export const LOW_STOCK_THRESHOLD = 10;
