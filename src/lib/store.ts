import { Item, Sale, StockMovement } from './types';
import { supabase } from './supabase';

export async function getItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching items:', error);
    return [];
  }
  
  return (data || []).map(item => ({
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcode: item.barcode,
    category: item.category,
    purchasePrice: parseFloat(item.purchase_price),
    sellingPrice: parseFloat(item.selling_price),
    stock: item.stock,
    minStock: item.min_stock,
    unit: item.unit,
    description: item.description || '',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

export async function getItemByBarcode(barcode: string): Promise<Item | undefined> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('barcode', barcode)
    .single();
  
  if (error || !data) return undefined;
  
  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    barcode: data.barcode,
    category: data.category,
    purchasePrice: parseFloat(data.purchase_price),
    sellingPrice: parseFloat(data.selling_price),
    stock: data.stock,
    minStock: data.min_stock,
    unit: data.unit,
    description: data.description || '',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getItemById(id: string): Promise<Item | undefined> {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) return undefined;
  
  return {
    id: data.id,
    name: data.name,
    sku: data.sku,
    barcode: data.barcode,
    category: data.category,
    purchasePrice: parseFloat(data.purchase_price),
    sellingPrice: parseFloat(data.selling_price),
    stock: data.stock,
    minStock: data.min_stock,
    unit: data.unit,
    description: data.description || '',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function addItem(item: Item): Promise<void> {
  const { error } = await supabase
    .from('items')
    .insert({
      id: item.id,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode,
      category: item.category,
      purchase_price: item.purchasePrice,
      selling_price: item.sellingPrice,
      stock: item.stock,
      min_stock: item.minStock,
      unit: item.unit,
      description: item.description,
      created_at: item.createdAt,
      updated_at: item.updatedAt,
    });
  
  if (error) {
    console.error('Error adding item:', error);
    throw error;
  }
}

export async function updateItem(updatedItem: Item): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({
      name: updatedItem.name,
      sku: updatedItem.sku,
      barcode: updatedItem.barcode,
      category: updatedItem.category,
      purchase_price: updatedItem.purchasePrice,
      selling_price: updatedItem.sellingPrice,
      stock: updatedItem.stock,
      min_stock: updatedItem.minStock,
      unit: updatedItem.unit,
      description: updatedItem.description,
      updated_at: updatedItem.updatedAt,
    })
    .eq('id', updatedItem.id);
  
  if (error) {
    console.error('Error updating item:', error);
    throw error;
  }
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting item:', error);
    throw error;
  }
}

export async function getSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching sales:', error);
    return [];
  }
  
  return (data || []).map(sale => ({
    id: sale.id,
    invoiceNumber: sale.invoice_number,
    items: sale.items,
    subtotal: parseFloat(sale.subtotal),
    discount: parseFloat(sale.discount),
    tax: parseFloat(sale.tax),
    total: parseFloat(sale.total),
    paymentMethod: sale.payment_method,
    customerName: sale.customer_name,
    customerPhone: sale.customer_phone,
    createdAt: sale.created_at,
  }));
}

export async function addSale(sale: Sale): Promise<void> {
  const { error } = await supabase
    .from('sales')
    .insert({
      id: sale.id,
      invoice_number: sale.invoiceNumber,
      items: sale.items,
      subtotal: sale.subtotal,
      discount: sale.discount,
      tax: sale.tax,
      total: sale.total,
      payment_method: sale.paymentMethod,
      customer_name: sale.customerName,
      customer_phone: sale.customerPhone,
      created_at: sale.createdAt,
    });
  
  if (error) {
    console.error('Error adding sale:', error);
    throw error;
  }
  
  for (const saleItem of sale.items) {
    const item = await getItemById(saleItem.itemId);
    if (!item) continue;
    
    const newStock = item.stock - saleItem.quantity;
    
    const { error: updateError } = await supabase
      .from('items')
      .update({
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', saleItem.itemId);
    
    if (updateError) {
      console.error('Error updating stock:', updateError);
      throw updateError;
    }
    
    await addStockMovement({
      id: crypto.randomUUID(),
      itemId: saleItem.itemId,
      itemName: saleItem.name,
      type: 'out',
      quantity: saleItem.quantity,
      reason: 'Sale',
      reference: sale.invoiceNumber,
      createdAt: new Date().toISOString(),
    });
  }
}

export async function getStockMovements(): Promise<StockMovement[]> {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching stock movements:', error);
    return [];
  }
  
  return (data || []).map(movement => ({
    id: movement.id,
    itemId: movement.item_id,
    itemName: movement.item_name,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    reference: movement.reference,
    createdAt: movement.created_at,
  }));
}

export async function addStockMovement(movement: StockMovement): Promise<void> {
  const { error } = await supabase
    .from('stock_movements')
    .insert({
      id: movement.id,
      item_id: movement.itemId,
      item_name: movement.itemName,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      reference: movement.reference,
      created_at: movement.createdAt,
    });
  
  if (error) {
    console.error('Error adding stock movement:', error);
    throw error;
  }
}

export async function adjustStock(itemId: string, quantity: number, type: 'in' | 'out' | 'adjustment', reason: string): Promise<void> {
  const item = await getItemById(itemId);
  if (!item) return;
  
  let newStock = item.stock;
  if (type === 'in') {
    newStock += quantity;
  } else if (type === 'out') {
    newStock -= quantity;
  } else {
    newStock = quantity;
  }
  
  const { error } = await supabase
    .from('items')
    .update({
      stock: newStock,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId);
  
  if (error) {
    console.error('Error adjusting stock:', error);
    throw error;
  }
  
  await addStockMovement({
    id: crypto.randomUUID(),
    itemId,
    itemName: item.name,
    type,
    quantity,
    reason,
    createdAt: new Date().toISOString(),
  });
}

export async function getNextInvoiceNumber(): Promise<string> {
  // First, try to get and increment in one transaction-like operation
  const { data, error } = await supabase
    .from('invoice_counter')
    .select('counter')
    .eq('id', 1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching invoice counter:', error);
    throw new Error(`Failed to fetch invoice counter: ${error.message}`);
  }
  
  const currentCounter = data?.counter || 0;
  const nextCounter = currentCounter + 1;
  
  // Update the counter
  const { error: updateError } = await supabase
    .from('invoice_counter')
    .upsert({ id: 1, counter: nextCounter }, { onConflict: 'id' });
  
  if (updateError) {
    console.error('Error updating invoice counter:', updateError);
    throw new Error(`Failed to update invoice counter: ${updateError.message}`);
  }
  
  return `INV-${nextCounter.toString().padStart(6, '0')}`;
}

export function generateBarcode(): string {
  const prefix = '200';
  const random = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  const code = prefix + random;
  const checkDigit = calculateEAN13CheckDigit(code);
  return code + checkDigit;
}

function calculateEAN13CheckDigit(code: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

export function generateSKU(category: string, name: string): string {
  const catCode = category.substring(0, 3).toUpperCase();
  const nameCode = name.substring(0, 3).toUpperCase();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${catCode}-${nameCode}-${random}`;
}