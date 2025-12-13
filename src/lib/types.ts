export interface Item {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  itemId: string;
  name: string;
  barcode: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'credit';
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  reference?: string;
  createdAt: string;
}

export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  totalItems: number;
  lowStockItems: number;
  monthlySales: number;
  monthlyProfit: number;
}
