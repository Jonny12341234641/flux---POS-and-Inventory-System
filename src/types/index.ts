// =========================================
// FLUX RETAIL - CENTRAL TYPE DEFINITIONS
// =========================================

// --- 1. SECURITY & USERS ---

// Internal Database Row (Includes Sensitive Data)
// ⚠️ Use this ONLY in backend controllers (authController, etc.)
export type UserRow = {
    id: string;
    username: string;
    password_hash: string;
    full_name: string;
    role: 'admin' | 'cashier';
    status: 'active' | 'inactive';
    last_login?: string;
    created_at: string;
    updated_at?: string;
};

// Safe Frontend Type (Public Data)
// ✅ Use this in your UI components
export type User = Omit<UserRow, 'password_hash'>;


// --- 2. INVENTORY MANAGEMENT ---

export type Category = {
    id: string;
    name: string;
    description?: string;
    color_code?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type Supplier = {
    id: string;
    name: string;
    contact_person: string;
    phone: string;
    email?: string;
    address?: string;
    tax_id?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type Product = {
    id: string;
    barcode: string;
    name: string;
    description?: string;
    category_id: string;
    
    // Financials
    // Note: Store as decimals (e.g., 10.99) or cents (1099) consistently.
    price: number; 
    cost_price: number;
    
    // Taxation & Inventory
    tax_rate?: number; // Override default store tax if needed (e.g., 0 for exempt items)
    stock_quantity: number;
    unit: string; // e.g., 'pcs', 'kg', 'box'
    reorder_level: number;
    image_url?: string;
    
    // Variants (Optional JSONB structure for simple variants)
    attributes?: { size?: string; color?: string; material?: string }; 
    
    is_active: boolean;
    created_at: string;
    updated_at: string;
};


// --- 3. BUYING (SUPPLY CHAIN) ---

export type PurchaseOrder = {
    id: string;
    supplier_id: string;
    reference_number?: string;
    total_amount: number;
    order_date: string; // Date of issuance
    expected_date?: string;
    status: 'pending' | 'received' | 'cancelled';
    created_by: string; // User ID
    notes?: string;
    created_at: string;
    updated_at: string;
};

export type PurchaseItem = {
    id: string;
    purchase_order_id: string;
    product_id: string;
    quantity: number;
    unit_cost: number;
    total_cost: number;
    expiry_date?: string; 
};


// --- 4. SELLING (TRANSACTIONS) ---

export type Customer = {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
    address_street?: string;
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    loyalty_points: number;
    store_credit?: number;
    tier_id?: string;
    tax_id?: string; // For business customers
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export type Sale = {
    id: string;
    receipt_number: string;
    cashier_id: string;
    customer_id?: string;
    
    // Financials
    sub_total: number;
    tax_total: number;
    discount_total: number;
    grand_total: number;
    
    // Payment Method
    // 'split' implies looking at the 'payments' relation for details
    payment_method: 'cash' | 'card' | 'bank_transfer' | 'split'; 
    amount_paid: number;
    change_given: number;
    
    status: 'completed' | 'refunded' | 'voided' | 'draft';
    created_at: string;
};

export type SaleItem = {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    sub_total: number;
    discount: number;
    tax_amount: number;
    note?: string; // e.g., "No sugar"
};

// New: For handling Split Payments (Cash + Card)
export type SalePayment = {
    id: string;
    sale_id: string;
    amount: number;
    method: 'cash' | 'card' | 'bank_transfer';
    reference_id?: string; // Transaction ID from terminal
    created_at: string;
};


// --- 5. AUDITING & LOGS ---

export type StockMovement = {
    id: string;
    product_id: string;
    // Includes 'damage' matching your inventoryController logic
    type: 'sale' | 'purchase' | 'return' | 'adjustment' | 'damage'; 
    quantity_change: number;
    reference_id?: string; // Sale ID or PO ID
    remarks?: string;
    created_by: string;
    created_at: string;
};

export type ShiftSession = {
    id: string;
    user_id: string;
    start_time: string;
    end_time?: string;
    starting_cash: number;
    cash_sales: number;
    expected_cash: number;
    ending_cash?: number;
    difference?: number;
    status: 'open' | 'closed';
    notes?: string;
};


// --- 6. CONFIGURATION ---

export type Settings = {
    id: number;
    store_name: string;
    store_address: string;
    store_phone: string;
    store_email?: string;
    currency_symbol: string;
    default_tax_rate: number;
    receipt_header?: string;
    receipt_footer?: string;
    logo_url?: string;
    updated_at: string;
};


// --- 7. APPLICATION UTILITIES (DTOs & Responses) ---

// Standard API Response Wrapper
export type ActionResponse<T = undefined> = {
    success: boolean;
    data?: T;
    error?: string;
    message?: string; // Optional success message
};

export type PaginatedResponse<T> = ActionResponse<T[]> & {
    metadata: {
        current_page: number;
        total_pages: number;
        total_items: number;
        items_per_page: number;
    }
};

// --- Extended Types (For UI Display) ---
// These join data together so your Table components are happy

export type SaleWithDetails = Sale & {
    cashier?: { full_name: string } | null;
    customer?: { name: string } | null;
    sale_items?: SaleItem[]; 
    payments?: SalePayment[];
};

export type PurchaseOrderWithDetails = PurchaseOrder & {
    supplier?: { name: string } | null;
    purchase_items?: PurchaseItem[];
};

export type StockMovementWithDetails = StockMovement & {
    product?: { name: string; barcode: string };
    creator?: { full_name: string };
};

// --- Form Input Types (DTOs) ---
// Use these in your React Forms

export type ProductFormData = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_active'>;
export type SupplierFormData = Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'is_active'>;
export type CustomerFormData = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'is_active' | 'loyalty_points'>;

export type CartItem = {
    product: Product; // Full product object for display
    quantity: number;
    discount?: number;
    tax_amount?: number;
};

// --- 5. AUDITING & LOGS --- 

export type AuditLog = {
    id: string;
    user_id: string;
    action: string;
    details?: string;
    ip_address?: string;
    created_at: string;
};
