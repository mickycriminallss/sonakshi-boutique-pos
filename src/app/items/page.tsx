"use client";

import { useEffect, useState, useRef, useMemo } from 'react';
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
import { getItems, addItem, updateItem, deleteItem, generateBarcode, generateSKU } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';
import { Item } from '@/lib/types';
import { BarcodeGenerator } from '@/components/BarcodeGenerator';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Upload,
  Download,
  Barcode,
} from 'lucide-react';
import * as XLSX from 'xlsx';

const DEFAULT_CATEGORIES = [
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

const UNITS = ['pcs', 'sets', 'pairs', 'meters', 'kg'];

interface ItemFormData {
  name: string;
  category: string;
  purchasePrice: string;
  sellingPrice: string;
  stock: string;
  minStock: string;
  unit: string;
  description: string;
  barcode: string;
  sku: string;
}

const initialFormData: ItemFormData = {
  name: '',
  category: '',
  purchasePrice: '',
  sellingPrice: '',
  stock: '',
  minStock: '5',
  unit: 'pcs',
  description: '',
  barcode: '',
  sku: '',
};

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<ItemFormData>(initialFormData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [items]);

  useEffect(() => {
    async function loadData() {
      const data = await getItems();
      setItems(data);
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

  const handleGenerateBarcode = () => {
    const barcode = generateBarcode();
    setFormData(prev => ({ ...prev, barcode }));
  };

  const handleGenerateSKU = () => {
    if (formData.category && formData.name) {
      const sku = generateSKU(formData.category, formData.name);
      setFormData(prev => ({ ...prev, sku }));
    } else {
      toast.error('Please enter category and name first');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.sellingPrice || !formData.barcode) {
      toast.error('Please fill in all required fields');
      return;
    }

    const existingBarcode = items.find(i => i.barcode === formData.barcode && i.id !== editingItem?.id);
    if (existingBarcode) {
      toast.error('Barcode already exists for another item');
      return;
    }

    const itemData: Item = {
      id: editingItem?.id || crypto.randomUUID(),
      name: formData.name,
      sku: formData.sku || generateSKU(formData.category, formData.name),
      barcode: formData.barcode,
      category: formData.category,
      purchasePrice: parseFloat(formData.purchasePrice) || 0,
      sellingPrice: parseFloat(formData.sellingPrice),
      stock: parseInt(formData.stock) || 0,
      minStock: parseInt(formData.minStock) || 5,
      unit: formData.unit,
      description: formData.description,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingItem) {
        await updateItem(itemData);
        toast.success('Item updated successfully');
      } else {
        await addItem(itemData);
        toast.success('Item added successfully');
      }

      const updatedItems = await getItems();
      setItems(updatedItems);
      setIsDialogOpen(false);
      setFormData(initialFormData);
      setEditingItem(null);
    } catch (error) {
      toast.error('Failed to save item');
      console.error(error);
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      purchasePrice: item.purchasePrice.toString(),
      sellingPrice: item.sellingPrice.toString(),
      stock: item.stock.toString(),
      minStock: item.minStock.toString(),
      unit: item.unit,
      description: item.description,
      barcode: item.barcode,
      sku: item.sku,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await deleteItem(id);
        const updatedItems = await getItems();
        setItems(updatedItems);
        toast.success('Item deleted successfully');
      } catch (error) {
        toast.error('Failed to delete item');
        console.error(error);
      }
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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

        let imported = 0;
        let skipped = 0;
        let deduped = 0;
        const currentItems = await getItems();
        const existingBarcodes = new Set(currentItems.map(i => i.barcode));
        
        for (const row of jsonData) {
          // Map Excel columns to item fields
          const name = String(row['Item name*'] || row['Item name'] || row['Name'] || row['name'] || '').trim();
          const itemCode = String(row['Item code'] || row['Barcode'] || row['barcode'] || '').trim();
          const category = String(row['Category'] || row['category'] || 'Other').trim();
          
          if (!name) {
            skipped++;
            continue;
          }

          // Resolve barcode and remove duplicates (in DB or current file)
          const resolvedBarcode = itemCode || generateBarcode();
          if (existingBarcodes.has(resolvedBarcode)) {
            deduped++;
            continue;
          }
          existingBarcodes.add(resolvedBarcode);

          const newItem: Item = {
            id: crypto.randomUUID(),
            name,
            sku: String(row['SKU'] || row['sku'] || generateSKU(category, name)),
            barcode: resolvedBarcode,
            category,
            purchasePrice: parseFloat(String(row['Purchase price'] || row['purchasePrice'] || row['Cost'] || '0')) || 0,
            sellingPrice: parseFloat(String(row['Sale price'] || row['Selling Price'] || row['sellingPrice'] || row['Price'] || '0')) || 0,
            stock: parseInt(String(row['Current stock quantity'] || row['Stock'] || row['stock'] || row['Quantity'] || '0')) || 0,
            minStock: parseInt(String(row['Minimum stock quantity'] || row['Min Stock'] || row['minStock'] || '5')) || 5,
            unit: String(row['Base Unit (x)'] || row['Unit'] || row['unit'] || 'pcs').toLowerCase(),
            description: String(row['Description'] || row['description'] || ''),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          try {
            await addItem(newItem);
            imported++;
          } catch (error) {
            console.error(`Failed to import item: ${name}`, error);
            skipped++;
          }
        }

        const updatedItems = await getItems();
        setItems(updatedItems);
        toast.success(`Imported ${imported} items. Removed ${deduped} duplicates. Skipped ${skipped} rows.`);
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
      'Name': item.name,
      'SKU': item.sku,
      'Barcode': item.barcode,
      'Category': item.category,
      'Purchase Price': item.purchasePrice,
      'Selling Price': item.sellingPrice,
      'Stock': item.stock,
      'Min Stock': item.minStock,
      'Unit': item.unit,
      'Description': item.description,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');
    XLSX.writeFile(workbook, `sonakshi_items_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Items exported successfully');
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Items</h1>
          <p className="text-slate-400 mt-1">{items.length} products in inventory</p>
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
              setEditingItem(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-white">{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat} className="text-white">{cat}</SelectItem>
                          ))}
                        </SelectContent>

                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Barcode *</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.barcode}
                        onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                        className="bg-slate-800 border-slate-700 text-white font-mono"
                        required
                      />
                      <Button type="button" onClick={handleGenerateBarcode} variant="outline" className="border-slate-700">
                        <Barcode className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-slate-300">SKU</Label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.sku}
                        onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                        className="bg-slate-800 border-slate-700 text-white font-mono"
                      />
                      <Button type="button" onClick={handleGenerateSKU} variant="outline" className="border-slate-700 text-xs">
                        Gen
                      </Button>
                    </div>
                  </div>
                </div>

                {formData.barcode && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <BarcodeGenerator value={formData.barcode} height={60} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Purchase Price (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Selling Price (₹) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.sellingPrice}
                      onChange={(e) => setFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-slate-300">Stock</Label>
                    <Input
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Min Stock Alert</Label>
                    <Input
                      type="number"
                      value={formData.minStock}
                      onChange={(e) => setFormData(prev => ({ ...prev, minStock: e.target.value }))}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-300">Unit</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit} className="text-white">{unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Description</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-slate-700">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900">
                    {editingItem ? 'Update Item' : 'Add Item'}
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
                  {categories.map((cat) => (
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
                <TableHead className="text-slate-400">Name</TableHead>
                <TableHead className="text-slate-400">SKU</TableHead>
                <TableHead className="text-slate-400">Category</TableHead>
                <TableHead className="text-slate-400 text-right">Price</TableHead>
                <TableHead className="text-slate-400 text-right">Stock</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    No items found. Add your first item to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="border-slate-800">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{item.barcode}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300 font-mono text-sm">{item.sku}</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300">{item.category}</span>
                    </TableCell>
                    <TableCell className="text-right text-amber-400 font-medium">{formatCurrency(item.sellingPrice)}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.stock <= item.minStock ? 'text-rose-400' : 'text-emerald-400'}>
                        {item.stock} {item.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(item)} className="text-slate-400 hover:text-white">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-rose-400">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}