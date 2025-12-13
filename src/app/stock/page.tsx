"use client";

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getItems, addItem, updateItem, getStockMovements, addStockMovement } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Item, StockMovement } from '@/lib/types';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Upload,
  Download,
  PackagePlus,
  PackageMinus,
  History,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const CATEGORIES = [
  'Sarees',
  'Suits',
  'Lehengas',
  'Kurtis',
  'Dress Materials',
  'Blouses',
  'Dupattas',
  'Accessories',
  'Jewellery',
  'Other',
];

interface StockFormData {
  itemId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: string;
  reason: string;
  reference: string;
}

const initialFormData: StockFormData = {
  itemId: '',
  type: 'in',
  quantity: '',
  reason: '',
  reference: '',
};

export default function StockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<StockFormData>(initialFormData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      const itemsData = await getItems();
      const movementsData = await getStockMovements();
      setItems(itemsData);
      setStockMovements(movementsData);
    }
    loadData();
  }, []);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode.includes(search);
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.itemId || !formData.quantity || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const item = items.find(i => i.id === formData.itemId);
    if (!item) {
      toast.error('Item not found');
      return;
    }

    const qty = parseInt(formData.quantity);
    let newStock = item.stock;

    if (formData.type === 'in') {
      newStock += qty;
    } else if (formData.type === 'out') {
      if (item.stock < qty) {
        toast.error('Insufficient stock');
        return;
      }
      newStock -= qty;
    } else {
      newStock = qty;
    }

    const movement: StockMovement = {
      id: crypto.randomUUID(),
      itemId: item.id,
      itemName: item.name,
      type: formData.type,
      quantity: qty,
      reason: formData.reason,
      reference: formData.reference,
      createdAt: new Date().toISOString(),
    };

    await addStockMovement(movement);
    await updateItem({ ...item, stock: newStock, updatedAt: new Date().toISOString() });

    const updatedItems = await getItems();
    const updatedMovements = await getStockMovements();
    setItems(updatedItems);
    setStockMovements(updatedMovements);
    setIsDialogOpen(false);
    setFormData(initialFormData);
    toast.success('Stock updated successfully');
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        console.log('Excel columns:', Object.keys(jsonData[0] || {}));
        console.log('First row sample:', jsonData[0]);

        let imported = 0;
        let updated = 0;
        const currentItems = await getItems();
        
        for (const row of jsonData) {
          const name = String(row['Item name*'] || row['Item Name'] || row['item name'] || row['Name'] || row['name'] || '').trim();
          const itemCode = String(row['Item code'] || row['Item Code'] || row['item code'] || row['Code'] || row['code'] || row['Barcode'] || row['barcode'] || '').trim();
          const category = String(row['Category'] || row['category'] || 'Other').trim();
          
          if (!name || !itemCode) {
            console.log('Skipping row - missing name or code:', { name, itemCode });
            continue;
          }

          const existingItem = currentItems.find(i => i.barcode === itemCode);
          
          const salePrice = parseFloat(String(row['Sale price'] || row['Sale Price'] || row['sale price'] || row['Selling Price'] || row['sellingPrice'] || row['Price'] || '0')) || 0;
          const purchasePrice = parseFloat(String(row['Purchase price'] || row['Purchase Price'] || row['purchase price'] || row['Cost'] || row['purchasePrice'] || '0')) || 0;
          const currentStock = parseInt(String(row['Current stock quantity'] || row['Current Stock'] || row['current stock'] || row['Stock'] || row['stock'] || row['Quantity'] || '0')) || 0;

          if (existingItem) {
            existingItem.name = name;
            existingItem.category = category || 'Other';
            existingItem.purchasePrice = purchasePrice;
            existingItem.sellingPrice = salePrice;
            existingItem.stock = currentStock;
            existingItem.updatedAt = new Date().toISOString();
            await updateItem(existingItem);
            updated++;
          } else {
            const newItem: Item = {
              id: crypto.randomUUID(),
              name,
              sku: String(row['SKU'] || row['sku'] || `${(category || 'ITM').substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`),
              barcode: itemCode,
              category: category || 'Other',
              purchasePrice,
              sellingPrice: salePrice,
              stock: currentStock,
              minStock: 5,
              unit: 'pcs',
              description: String(row['Description'] || row['description'] || ''),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await addItem(newItem);
            imported++;
          }
        }

        const updatedItems = await getItems();
        setItems(updatedItems);
        toast.success(`Successfully imported ${imported} new items and updated ${updated} existing items`);
      } catch (error) {
        console.error('Import error:', error);
        toast.error('Failed to import Excel file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExcelExport = () => {
    const exportData = items.map(item => ({
      'Item Name': item.name,
      'Item Code': item.barcode,
      'Category': item.category,
      'Sale Price': item.sellingPrice,
      'Purchase Price': item.purchasePrice,
      'Current Stock': item.stock,
      'SKU': item.sku,
      'Unit': item.unit,
      'Description': item.description,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');
    XLSX.writeFile(workbook, `stock_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Stock exported successfully');
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Stock Management</h1>
          <p className="text-slate-400 mt-1">{items.length} items in inventory</p>
        </div>
        <div className="flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleExcelImport}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="border-slate-700 text-slate-300">
            <Upload className="mr-2 h-4 w-4" />
            Import Excel
          </Button>
          <Button variant="outline" onClick={handleExcelExport} className="border-slate-700 text-slate-300">
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setFormData(initialFormData);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold">
                <Plus className="mr-2 h-4 w-4" />
                Update Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-white">Update Stock</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-slate-300">Item *</Label>
                  <Select
                    value={formData.itemId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, itemId: value }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 max-h-[300px]">
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id} className="text-white">
                          {item.name} - {item.barcode} (Stock: {item.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Movement Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'in' | 'out' | 'adjustment') => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="in" className="text-white">
                        <div className="flex items-center gap-2">
                          <PackagePlus className="h-4 w-4 text-emerald-400" />
                          Stock In
                        </div>
                      </SelectItem>
                      <SelectItem value="out" className="text-white">
                        <div className="flex items-center gap-2">
                          <PackageMinus className="h-4 w-4 text-rose-400" />
                          Stock Out
                        </div>
                      </SelectItem>
                      <SelectItem value="adjustment" className="text-white">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-amber-400" />
                          Adjustment
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">
                    Quantity * {formData.type === 'adjustment' && '(New total stock)'}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white"
                    required
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Reason *</Label>
                  <Input
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="e.g., Purchase order, Customer return, Damage"
                    required
                  />
                </div>

                <div>
                  <Label className="text-slate-300">Reference</Label>
                  <Input
                    value={formData.reference}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white"
                    placeholder="e.g., PO-123, Invoice-456"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-slate-700">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900">
                    Update Stock
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by name, SKU, or barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all" className="text-white">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-white">{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Item Name</TableHead>
                <TableHead className="text-slate-400">Item Code</TableHead>
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400 text-right">Sale Price</TableHead>
                <TableHead className="text-slate-400 text-right">Purchase Price</TableHead>
                <TableHead className="text-slate-400 text-right">Current Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No items found. Import Excel to add items.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="border-slate-800">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300 font-mono text-sm">{item.barcode}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{item.category}</span>
                    </TableCell>
                    <TableCell className="text-right text-amber-400 font-medium">{formatCurrency(item.sellingPrice)}</TableCell>
                    <TableCell className="text-right text-slate-300">{formatCurrency(item.purchasePrice)}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.stock <= item.minStock ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                        {item.stock} {item.unit}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {stockMovements.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-800 mt-8">
          <CardHeader>
            <CardTitle className="text-white">Recent Stock Movements</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Item</TableHead>
                  <TableHead className="text-slate-400">Type</TableHead>
                  <TableHead className="text-slate-400 text-right">Quantity</TableHead>
                  <TableHead className="text-slate-400">Reason</TableHead>
                  <TableHead className="text-slate-400">Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockMovements.slice(0, 10).map((movement) => (
                  <TableRow key={movement.id} className="border-slate-800">
                    <TableCell className="text-slate-300 text-sm">
                      {new Date(movement.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-white">{movement.itemName}</TableCell>
                    <TableCell>
                      {movement.type === 'in' && (
                        <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-xs">
                          Stock In
                        </span>
                      )}
                      {movement.type === 'out' && (
                        <span className="px-2 py-1 bg-rose-900/30 text-rose-400 rounded text-xs">
                          Stock Out
                        </span>
                      )}
                      {movement.type === 'adjustment' && (
                        <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded text-xs">
                          Adjustment
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-slate-300 font-mono">{movement.quantity}</TableCell>
                    <TableCell className="text-slate-300">{movement.reason}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{movement.reference || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}