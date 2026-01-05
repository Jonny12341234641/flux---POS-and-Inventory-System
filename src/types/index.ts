// // --- 1. SECURITY & USERS [cite: 7] ---


// //---1. Security and Users
// export type User = {
//     id : string;
//     username : string;
//     password_hash : string;
//     full_name : string;
//     role : 'admin' | 'cashier';
//     status : 'active' | 'inactive';
//     last_login? : string;
//     created_at? : string;
// };


// // --- 2. INVENTORY MANAGEMENT ---

// //---2. Inventory Management
// export type Category = {
//     id : string;
//     name : string;
//     description? : string;
//     color_code? : string;
//     is_active? : boolean;
//     created_at? : string;
//     updated_at? : string;
// };

// //---3. Supplier
// export type Supplier = {
//   id: string;
//   name: string;
//   contact_person: string;
//   phone: string;
//   email?: string;
//   address?: string;
//   tax_id?: string;
//   is_active: boolean;
//   created_at: string;
//   updated_at: string;
// };

// //---4. Products table
// export type Product = {
//   id: string;
//   barcode: string;           
//   name: string;
//   description?: string;
//   category_id: string;
//   price: number;
//   cost_price: number;
//   stock_quantity: number; 
//   unit: string;
//   reorder_level: number;
//   image_url?: string;
//   is_active: boolean;
//   created_at: string;
//   updated_at: string;
// };



// // --- 3. BUYING (SUPPLY CHAIN) ---

// //---5. Purchase Orders Table
// export type PurchaseOrder = {
//     id: string;
//     supplier_id: string;
//     reference_number?: string;
//     total_amount: number;
//     order_date: string;
//     expected_date?: string;
//     status: 'pending' | 'received' | 'cancelled';
//     created_by: string;
//     notes? : string;
//     created_at: string;
//     updated_at: string;

// }

// //---6. Purchase Items Table
// export type PurchaseItem = {
//     id : string;
//     purchase_order_id : string;
//     product_id : string;
//     quantity : number;
//     unit_cost : number;
//     total_cost : number;
// };


// // --- 4. SELLING (TRANSACTIONS) ---

// //---7. Customers Table
// export type Customer = {
//     id : string;
//     name : string;
//     phone : string;
//     email? : string;
//     address? : string;
//     loyality_points : number;
//     is_active : boolean;
//     created_at : string;
//     updated_at : string;
// };

// //---8. Sales Table
// export type Sale = {
//   id: string;
//   receipt_number: string;
//   cashier_id: string;
//   customer_id?: string;
//   sub_total: number;
//   tax_total: number;
//   discount_total: number;
//   grand_total: number;
//   payment_method: 'cash' | 'card' | 'bank_transfer';
//   amount_paid: number;
//   change_given: number;
//   status: 'completed' | 'refunded' | 'voided' | 'draft';
//   created_at: string;
// };

// //---9. Sale Items Table
// export type SaleItem = {
//     id : string;
//     sale_id : String;
//     product_id : string;
//     quantity : number;
//     unit_price : number;
//     sub_total : number;
//     discount : number;
//     tax_amount : number;
// };


// // --- 5. AUDITING & LOGS ---

// //---10. Stock Movement Table
// export type StockMovement = {
//     //id, product_id, type, quantity_change, reference_id?, remarks?, created_by, created_at
//     id : string;
//     product_id : string;
//     type : 'sale' | 'purchase' | 'return' | 'adjustment';
//     quantity_change : number;
//     reference_id? : string;
//     remarks? : string;
//     created_by : string;
//     created_at : string;
// };

// //---11. Shift Sessions table
// export type ShiftSession = {
//     id : string;
//     user_id : string;
//     start_time : string;
//     end_time? : string;
//     starting_cash : number;
//     cash_sales : number;
//     expected_cash : number;
//     ending_cash? : number;
//     difference? : number;
//     status : 'open' | 'closed';
//     notes? : string;
// }


// // --- 6. CONFIGURATION ---

// //---12. Settings Table
// export type Settings = {
//   id: number;
//   store_name: string;
//   store_address: string;
//   store_phone: string;
//   store_email?: string;
//   currency_symbol: string;
//   default_tax_rate: number;
//   receipt_header?: string;
//   receipt_footer?: string;
//   logo_url?: string;
//   updated_at: string;
// };

//here is the updated code.

// --- 1. SECURITY & USERS [cite: 74] ---
export type User = {
    id: string;
    username: string;
    password_hash: string;
    full_name: string;
    role: 'admin' | 'cashier';
    status: 'active' | 'inactive';
    last_login?: string;
    created_at?: string;
};

// --- 2. INVENTORY MANAGEMENT ---


export type Category = {
    id: string;
    name: string;
    description?: string;
    color_code?: string;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
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
    price: number;
    cost_price: number;
    stock_quantity: number;
    unit: string;
    reorder_level: number;
    image_url?: string;
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
    order_date: string;
    expected_date?: string;
    status: 'pending' | 'received' | 'cancelled';
    created_by: string;
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
    loyalty_points: number;
    tax_id?: string; 
    is_active: boolean;
    created_at: string;
    updated_at: string;
};


export type Sale = {
    id: string;
    receipt_number: string;
    cashier_id: string;
    customer_id?: string;
    sub_total: number;
    tax_total: number;
    discount_total: number;
    grand_total: number;
    payment_method: 'cash' | 'card' | 'bank_transfer';
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
};

// --- 5. AUDITING & LOGS ---


export type StockMovement = {
    id: string;
    product_id: string;
    type: 'sale' | 'purchase' | 'return' | 'adjustment' | 'damage'; 
    quantity_change: number;
    reference_id?: string;
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

// 1. Standard API/Action Response
export type ActionResponse<T = undefined> = {
    success: boolean;
    data?: T;
    error?: string;
};

// 2. Extended Types (Joined Data for UI)
export type SaleWithDetails = Sale & {
    cashier?: { full_name: string } | null;
    customer?: { name: string } | null;
    sale_items?: SaleItem[]; 
};

export type PurchaseOrderWithDetails = PurchaseOrder & {
    supplier?: { name: string } | null;
    purchase_items?: PurchaseItem[];
};

export type StockMovementWithDetails = StockMovement & {
    product?: { name: string; barcode: string };
    creator?: { full_name: string };
};

// 3. Form Input Types
export type ProductFormData = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'is_active'>;
export type SupplierFormData = Omit<Supplier, 'id' | 'created_at' | 'updated_at' | 'is_active'>;
export type CustomerFormData = Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'is_active' | 'loyalty_points'>;

export type CartItem = {
    product: Product; // Full product object for UI display
    quantity: number;
    discount?: number; // Per unit or total depending on logic
};