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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getItems, addItem, generateBarcode, generateSKU } from '@/lib/store';
import { Item } from '@/lib/types';
import { BarcodeGenerator } from '@/components/BarcodeGenerator';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Printer,
  Download,
} from 'lucide-react';

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

export default function BarcodesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ItemFormData>(initialFormData);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadItems() {
      const itemsData = await getItems();
      setItems(itemsData);
    }
    loadItems();
  }, []);

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.sku.toLowerCase().includes(search.toLowerCase()) ||
    item.barcode.includes(search)
  );

  const handleToggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handlePrintSelected = () => {
    if (selectedItems.size === 0) {
      toast.error('Please select items to print');
      return;
    }

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print');
      return;
    }

    const selectedItemsList = items.filter(item => selectedItems.has(item.id));
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Labels</title>
          <style>
            @page {
              size: 2.25in 1.25in;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .label {
              width: 2.25in;
              height: 1.25in;
              padding: 0.1in;
              box-sizing: border-box;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
            }
            .label:last-child {
              page-break-after: auto;
            }
            .item-name {
              font-size: 9pt;
              font-weight: bold;
              margin-bottom: 2px;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .item-price {
              font-size: 11pt;
              font-weight: bold;
              margin-bottom: 3px;
            }
            .barcode-container {
              margin: 2px 0;
            }
            .barcode-container svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
    `);

    selectedItemsList.forEach(item => {
      const canvas = document.createElement('canvas');
      const JsBarcode = require('jsbarcode');
      JsBarcode(canvas, item.barcode, {
        format: 'CODE128',
        width: 1.5,
        height: 35,
        displayValue: true,
        fontSize: 10,
        margin: 2,
      });

      printWindow.document.write(`
        <div class="label">
          <div class="item-name">${item.name}</div>
          <div class="item-price">₹${item.sellingPrice.toFixed(2)}</div>
          <div class="barcode-container">
            <img src="${canvas.toDataURL()}" style="max-width: 100%; height: auto;" />
          </div>
        </div>
      `);
    });

    printWindow.document.write(`
        </body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);

    toast.success(`Printing ${selectedItems.size} barcode labels`);
  };

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

    const existingBarcode = items.find(i => i.barcode === formData.barcode);
    if (existingBarcode) {
      toast.error('Barcode already exists');
      return;
    }

    const itemData: Item = {
      id: crypto.randomUUID(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await addItem(itemData);
    const updatedItems = await getItems();
    setItems(updatedItems);
    toast.success('Item added successfully');
    
    setSelectedItems(new Set([itemData.id]));
    
    setIsDialogOpen(false);
    setFormData(initialFormData);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Barcode Labels</h1>
          <p className="text-slate-400 mt-1">Generate and print barcode labels</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setFormData(initialFormData);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold">
                <Plus className="mr-2 h-4 w-4" />
                Add New Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-slate-900 border-slate-800">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Item & Generate Barcode</DialogTitle>
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
                        {CATEGORIES.map((cat) => (
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
                        Gen
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
                    Add Item & Generate Barcode
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Select Items</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="border-slate-700 text-slate-300"
                >
                  {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  size="sm"
                  onClick={handlePrintSelected}
                  disabled={selectedItems.size === 0}
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-900"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print ({selectedItems.size})
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  No items found
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSelection(item.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedItems.has(item.id)
                        ? 'bg-amber-500/20 border-amber-500/50'
                        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white">{item.name}</p>
                        <div className="flex gap-4 mt-1">
                          <p className="text-xs text-slate-400">SKU: {item.sku}</p>
                          <p className="text-xs text-slate-400 font-mono">Barcode: {item.barcode}</p>
                        </div>
                        <p className="text-sm text-amber-400 font-semibold mt-1">₹{item.sellingPrice.toFixed(2)}</p>
                      </div>
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedItems.has(item.id)
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-slate-600'
                      }`}>
                        {selectedItems.has(item.id) && (
                          <svg className="w-3 h-3 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedItems.size === 0 ? (
                <div className="text-center text-slate-500 py-12">
                  Select items to preview labels
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">
                    {selectedItems.size} label{selectedItems.size !== 1 ? 's' : ''} selected
                  </p>
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {items
                      .filter(item => selectedItems.has(item.id))
                      .slice(0, 5)
                      .map((item) => (
                        <div key={item.id} className="bg-white p-3 rounded-lg">
                          <p className="text-xs font-semibold text-slate-900 text-center truncate">
                            {item.name}
                          </p>
                          <p className="text-sm font-bold text-slate-900 text-center mb-1">
                            ₹{item.sellingPrice.toFixed(2)}
                          </p>
                          <div className="flex justify-center">
                            <BarcodeGenerator value={item.barcode} width={1.5} height={35} />
                          </div>
                        </div>
                      ))}
                    {selectedItems.size > 5 && (
                      <p className="text-xs text-slate-500 text-center">
                        +{selectedItems.size - 5} more...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div ref={printRef} className="hidden" />
    </div>
  );
}