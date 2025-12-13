import { Item, Sale, StockMovement } from './types';

const STORAGE_KEYS = {
  ITEMS: 'sonakshi_items',
  SALES: 'sonakshi_sales',
  STOCK_MOVEMENTS: 'sonakshi_stock_movements',
  INVOICE_COUNTER: 'sonakshi_invoice_counter',
};

export function getItems(): Item[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.ITEMS);
  return data ? JSON.parse(data) : [];
}

export function saveItems(items: Item[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
}

export function getItemByBarcode(barcode: string): Item | undefined {
  const items = getItems();
  return items.find(item => item.barcode === barcode);
}

export function getItemById(id: string): Item | undefined {
  const items = getItems();
  return items.find(item => item.id === id);
}

export function addItem(item: Item): void {
  const items = getItems();
  items.push(item);
  saveItems(items);
}

export function updateItem(updatedItem: Item): void {
  const items = getItems();
  const index = items.findIndex(item => item.id === updatedItem.id);
  if (index !== -1) {
    items[index] = updatedItem;
    saveItems(items);
  }
}

export function deleteItem(id: string): void {
  const items = getItems();
  saveItems(items.filter(item => item.id !== id));
}

export function getSales(): Sale[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.SALES);
  return data ? JSON.parse(data) : [];
}

export function saveSales(sales: Sale[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
}

export function addSale(sale: Sale): void {
  const sales = getSales();
  sales.push(sale);
  saveSales(sales);
  
  const items = getItems();
  sale.items.forEach(saleItem => {
    const item = items.find(i => i.id === saleItem.itemId);
    if (item) {
      item.stock -= saleItem.quantity;
      item.updatedAt = new Date().toISOString();
    }
  });
  saveItems(items);
  
  sale.items.forEach(saleItem => {
    const item = items.find(i => i.id === saleItem.itemId);
    if (item) {
      addStockMovement({
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
  });
}

export function getStockMovements(): StockMovement[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEYS.STOCK_MOVEMENTS);
  return data ? JSON.parse(data) : [];
}

export function saveStockMovements(movements: StockMovement[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify(movements));
}

export function addStockMovement(movement: StockMovement): void {
  const movements = getStockMovements();
  movements.push(movement);
  saveStockMovements(movements);
}

export function adjustStock(itemId: string, quantity: number, type: 'in' | 'out' | 'adjustment', reason: string): void {
  const items = getItems();
  const item = items.find(i => i.id === itemId);
  if (item) {
    if (type === 'in') {
      item.stock += quantity;
    } else if (type === 'out') {
      item.stock -= quantity;
    } else {
      item.stock = quantity;
    }
    item.updatedAt = new Date().toISOString();
    saveItems(items);
    
    addStockMovement({
      id: crypto.randomUUID(),
      itemId,
      itemName: item.name,
      type,
      quantity,
      reason,
      createdAt: new Date().toISOString(),
    });
  }
}

export function getNextInvoiceNumber(): string {
  if (typeof window === 'undefined') return 'INV-000001';
  const counter = parseInt(localStorage.getItem(STORAGE_KEYS.INVOICE_COUNTER) || '0') + 1;
  localStorage.setItem(STORAGE_KEYS.INVOICE_COUNTER, counter.toString());
  return `INV-${counter.toString().padStart(6, '0')}`;
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
