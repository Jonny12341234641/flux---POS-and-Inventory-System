import { supabase } from '../../lib/supabase';
import { Sale, SaleItem, Product } from '../../types';

// Helper to generate a short Receipt Number (e.g., REC-1001)
function generateReceiptNumber() {
  return `REC-${Date.now().toString().slice(-6)}`;
}

/**
 * Create a new sale record with its items and update the inventory
 * @param {object} data - The sale data
 * @param {object} data.items - An array of objects with product_id and quantity
 * @param {string} data.payment_method - The payment method
 * @param {number} data.amount_paid - The amount paid
 * @param {string} data.cashier_id - The cashier's ID
 * @returns {Promise<object>} - The sale ID and receipt number
 * @throws {Error} - If products are not found or insufficient stock
 */
export async function createSale(data: { 
  items: { product_id: string; quantity: number }[], 
  payment_method: string,
  amount_paid: number,
  cashier_id: string 
}) {
  
  // 1. Fetch all products involved to get REAL prices and check Stock
  const productIds = data.items.map(item => item.product_id);
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds);

  if (productError || !products) throw new Error("Failed to fetch products");

  // 2. Calculate Totals & Verify Stock
  let subTotal = 0;
  let taxTotal = 0;
  const saleItemsToInsert: any[] = [];
  const stockUpdates: any[] = [];

  for (const item of data.items) {
    const product = products.find(p => p.id === item.product_id);
    
    if (!product) throw new Error(`Product ${item.product_id} not found`);
    if (product.stock_quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    // Commercial Math: Use the DB price, not what the frontend sent
    const lineTotal = product.price * item.quantity;
    const taxAmount = lineTotal * 0.10; // Assuming 10% tax for now (can be changed later)

    subTotal += lineTotal;
    taxTotal += taxAmount;

    // Prepare the Item Record
    saleItemsToInsert.push({
      product_id: product.id,
      quantity: item.quantity,
      unit_price: product.price,
      sub_total: lineTotal,
      tax_amount: taxAmount,
      discount: 0
    });

    // Prepare Stock Update (Decrement)
    stockUpdates.push({
      id: product.id,
      stock_quantity: product.stock_quantity - item.quantity
    });
  }

  const grandTotal = subTotal + taxTotal;

  // 3. Create the Sale Record (The Header)
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      receipt_number: generateReceiptNumber(),
      cashier_id: data.cashier_id, // We will get this from the logged-in user later
      sub_total: subTotal,
      tax_total: taxTotal,
      grand_total: grandTotal,
      payment_method: data.payment_method,
      amount_paid: data.amount_paid,
      change_given: data.amount_paid - grandTotal,
      status: 'completed'
    })
    .select()
    .single();

  if (saleError) throw new Error(saleError.message);

  // 4. Link Items to the Sale ID
  const finalItems = saleItemsToInsert.map(item => ({
    ...item,
    sale_id: sale.id
  }));

  // 5. Save Items
  const { error: itemsError } = await supabase.from('sale_items').insert(finalItems);
  if (itemsError) throw new Error(itemsError.message);

  // 6. Update Inventory (Subtract Stock)
  for (const update of stockUpdates) {
    await supabase
      .from('products')
      .update({ stock_quantity: update.stock_quantity })
      .eq('id', update.id);
  }

  return { success: true, sale_id: sale.id, receipt: sale.receipt_number };
}