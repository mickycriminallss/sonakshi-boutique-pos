"use client";

import React, { useState, useRef, useEffect } from 'react';
import { BarcodeScannerInput } from '@/components/BarcodeScannerInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getItemByBarcode, addSale, getNextInvoiceNumber } from '@/lib/store';
import { SaleItem, Sale } from '@/lib/types';
import { toast } from 'sonner';
import { Trash2, Plus, Minus, Printer, Tag, Settings } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function SalesPage() {
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash');
  const [showCheckout, setShowCheckout] = useState(false);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [gstRate, setGstRate] = useState(18);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [billWidth, setBillWidth] = useState('80');
  const [labelWidth, setLabelWidth] = useState('38');
  const [labelHeight, setLabelHeight] = useState('25');
  const [showBillSizeDialog, setShowBillSizeDialog] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const savedBillWidth = localStorage.getItem('billPrintWidth');
    const savedLabelWidth = localStorage.getItem('labelWidth');
    const savedLabelHeight = localStorage.getItem('labelHeight');
    if (savedBillWidth) setBillWidth(savedBillWidth.replace('mm', ''));
    if (savedLabelWidth) setLabelWidth(savedLabelWidth.replace('mm', ''));
    if (savedLabelHeight) setLabelHeight(savedLabelHeight.replace('mm', ''));
  }, []);

  const handleBarcodeScan = async (barcode: string) => {
    const item = await getItemByBarcode(barcode);
    
    if (!item) {
      toast.error(`Item with barcode ${barcode} not found`);
      return;
    }

    if (item.stock <= 0) {
      toast.error(`${item.name} is out of stock`);
      return;
    }

    const existingItem = saleItems.find(si => si.itemId === item.id);
    
    if (existingItem) {
      if (existingItem.quantity >= item.stock) {
        toast.error(`Cannot add more. Only ${item.stock} in stock`);
        return;
      }
      updateQuantity(item.id, existingItem.quantity + 1);
    } else {
      const newSaleItem: SaleItem = {
        itemId: item.id,
        name: item.name,
        barcode: item.barcode,
        quantity: 1,
        price: item.sellingPrice,
        discount: 0,
        total: item.sellingPrice,
      };
      setSaleItems([...saleItems, newSaleItem]);
      toast.success(`${item.name} added to cart`);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    const saleItem = saleItems.find(si => si.itemId === itemId);
    if (saleItem) {
      const item = await getItemByBarcode(saleItem.barcode);
      if (item && newQuantity > item.stock) {
        toast.error(`Only ${item.stock} items available in stock`);
        return;
      }
    }

    setSaleItems(saleItems.map(si => {
      if (si.itemId === itemId) {
        const total = (si.price * newQuantity) - si.discount;
        return { ...si, quantity: newQuantity, total };
      }
      return si;
    }));
  };

  const removeItem = (itemId: string) => {
    setSaleItems(saleItems.filter(si => si.itemId !== itemId));
    toast.info('Item removed from cart');
  };

  const calculateTotals = () => {
    const subtotal = saleItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemDiscount = saleItems.reduce((sum, item) => sum + item.discount, 0);
    const percentageDiscount = (subtotal - itemDiscount) * (discountPercent / 100);
    const totalDiscount = itemDiscount + percentageDiscount;
    const tax = gstEnabled ? (subtotal - totalDiscount) * (gstRate / 100) : 0;
    const total = subtotal - totalDiscount + tax;
    return { subtotal, totalDiscount, percentageDiscount, tax, total };
  };

    const handleCheckout = () => {
      if (saleItems.length === 0) {
        toast.error('Cart is empty');
        return;
      }
      setShowBillSizeDialog(true);
    };

    const handleBillSizeConfirm = () => {
      localStorage.setItem('billPrintWidth', `${billWidth}mm`);
      setShowBillSizeDialog(false);
      setShowCheckout(true);
    };

    const [showInteractiveBill, setShowInteractiveBill] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);

    const handleCompleteSale = async () => {
      if (saleItems.length === 0) {
        toast.error('Cart is empty');
        return;
      }

      try {
        const { subtotal, totalDiscount, percentageDiscount, tax, total } = calculateTotals();
        const invoiceNumber = await getNextInvoiceNumber();
        
        const sale: Sale = {
          id: crypto.randomUUID(),
          invoiceNumber,
          items: saleItems,
          subtotal,
          discount: totalDiscount,
          tax,
          total,
          paymentMethod,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          createdAt: new Date().toISOString(),
        };

        await addSale(sale);
        setCompletedSale(sale);
        setShowCheckout(false);
        setShowInteractiveBill(true);
      } catch (error) {
        console.error('Error completing sale:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to complete sale: ${errorMessage}`);
      }
    };

    const handleNewSale = () => {
      setSaleItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setPaymentMethod('cash');
      setGstEnabled(true);
      setGstRate(18);
      setDiscountPercent(0);
      setShowInteractiveBill(false);
      setCompletedSale(null);
    };

  const handlePrintBill = async (invoiceNumber?: string) => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const { subtotal, totalDiscount, percentageDiscount, tax, total } = calculateTotals();
    const invoice = invoiceNumber || await getNextInvoiceNumber();
    const now = new Date();
    
    const billWidth = localStorage.getItem('billPrintWidth') || '80mm';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice}</title>
          <style>
            @page {
              size: ${billWidth} auto;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
              font-size: 12px;
              line-height: 1.4;
              padding: 10mm;
              width: ${billWidth};
              background: white;
              color: black;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px solid #eee;
              padding-bottom: 15px;
            }
            .org-name {
              font-size: 24px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 2px;
              margin-bottom: 4px;
              color: #000;
            }
            .tagline {
              font-size: 11px;
              font-style: italic;
              color: #666;
              margin-bottom: 12px;
            }
            .owner-details {
              font-size: 10px;
              color: #444;
            }
            .invoice-meta {
              display: flex;
              justify-content: space-between;
              margin-bottom: 20px;
              font-size: 11px;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .customer-section {
              margin-bottom: 20px;
              font-size: 11px;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .items-table th {
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
              color: #888;
              border-bottom: 2px solid #000;
              padding: 8px 0;
            }
            .items-table td {
              padding: 10px 0;
              border-bottom: 1px solid #eee;
              font-size: 11px;
            }
            .text-right { text-align: right; }
            .totals-section {
              margin-left: auto;
              width: 100%;
              max-width: 200px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 11px;
            }
            .grand-total {
              font-size: 16px;
              font-weight: bold;
              border-top: 2px solid #000;
              margin-top: 8px;
              padding-top: 8px;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              font-size: 10px;
              color: #888;
            }
            .thank-you {
              font-size: 14px;
              font-weight: 600;
              color: #000;
              margin-bottom: 5px;
            }
            @media print {
              body { padding: 5mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="org-name">SONAKSHI BOUTIQUE</div>
            <div class="tagline">From our hands to your heart</div>
            <div class="owner-details">
              Owner: Sonali | Tel: +91 7413956875<br>
              GSTIN: 29ABCDE1234F1Z5
            </div>
          </div>

          <div class="invoice-meta">
            <div>
              <strong>Invoice #:</strong> ${invoice}<br>
              <strong>Date:</strong> ${now.toLocaleDateString('en-IN')}
            </div>
            <div class="text-right">
              <strong>Time:</strong> ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          ${(customerName || customerPhone) ? `
            <div class="customer-section">
              <strong>Billed To:</strong><br>
              ${customerName || 'Valued Customer'}<br>
              ${customerPhone || ''}
            </div>
          ` : ''}

          <table class="items-table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Price</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${saleItems.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">₹${item.price.toFixed(2)}</td>
                  <td class="text-right">₹${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals-section">
            <div class="total-row">
              <span>Subtotal</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${percentageDiscount > 0 ? `
              <div class="total-row">
                <span>Discount (${discountPercent}%)</span>
                <span>- ₹${percentageDiscount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${tax > 0 ? `
              <div class="total-row">
                <span>GST (${gstRate}%)</span>
                <span>₹${tax.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>TOTAL</span>
              <span>₹${total.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <div class="thank-you">Thank You!</div>
            <div>We appreciate your business. Visit us again soon!</div>
            <div style="margin-top: 15px; font-size: 8px; letter-spacing: 1px; color: #ccc;">*** ORIGINAL INVOICE ***</div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Use an onload listener for more reliable printing
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      // Optional: close after printing, but some users prefer it stays open to see
      // printWindow.close(); 
    };

    // Fallback if onload doesn't fire
    setTimeout(() => {
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }
    }, 1000);
  };

  const handlePrintBarcode = (item: SaleItem) => {
    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) return;
    
    const labelWidth = localStorage.getItem('labelWidth') || '50mm';
    const labelHeight = localStorage.getItem('labelHeight') || '30mm';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Label</title>
          <style>
            @page {
              size: ${labelWidth} ${labelHeight};
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: ${labelHeight};
              width: ${labelWidth};
              margin: 0;
              padding: 2mm;
              text-align: center;
            }
            .label {
              width: 100%;
            }
            .item-name {
              font-size: 10px;
              font-weight: bold;
              margin-bottom: 2mm;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .barcode {
              font-family: 'Libre Barcode 128', cursive;
              font-size: 32px;
              margin: 2mm 0;
            }
            .barcode-number {
              font-size: 8px;
              letter-spacing: 2px;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="item-name">${item.name}</div>
            <div class="barcode">${item.barcode}</div>
            <div class="barcode-number">${item.barcode}</div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const { subtotal, totalDiscount, percentageDiscount, tax, total } = calculateTotals();

  const handleSaveSettings = () => {
    localStorage.setItem('billPrintWidth', `${billWidth}mm`);
    localStorage.setItem('labelWidth', `${labelWidth}mm`);
    localStorage.setItem('labelHeight', `${labelHeight}mm`);
    setShowSettings(false);
    toast.success('Print settings saved');
  };

    if (showInteractiveBill && completedSale) {
      return (
        <div className="p-8 max-w-3xl mx-auto">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-purple-500/10 blur-3xl animate-pulse" />
            
            <Card className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-amber-500/30 shadow-2xl overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-500/20 to-transparent rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-emerald-500/20 to-transparent rounded-full blur-3xl" />
              
              <CardContent className="relative pt-12 pb-8 px-8">
                <div className="text-center mb-8">
                  <div className="inline-block animate-bounce mb-4">
                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold text-white mb-2">Sale Complete!</h2>
                  <p className="text-emerald-400 text-lg">Thank you for shopping with us</p>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-amber-500/20">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-400 text-sm">Invoice Number</span>
                    <span className="text-2xl font-bold text-amber-400">{completedSale.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Date & Time</span>
                    <span className="text-white">{new Date(completedSale.createdAt).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {(completedSale.customerName || completedSale.customerPhone) && (
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-purple-500/20">
                    <h3 className="text-purple-400 font-semibold mb-3">Customer Details</h3>
                    {completedSale.customerName && (
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-400">Name</span>
                        <span className="text-white">{completedSale.customerName}</span>
                      </div>
                    )}
                    {completedSale.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Phone</span>
                        <span className="text-white">{completedSale.customerPhone}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-blue-500/20">
                  <h3 className="text-blue-400 font-semibold mb-4">Items Purchased</h3>
                  <div className="space-y-3">
                    {completedSale.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                        <div>
                          <p className="text-white font-medium">{item.name}</p>
                          <p className="text-slate-400 text-sm">Qty: {item.quantity} × ₹{item.price.toFixed(2)}</p>
                        </div>
                        <span className="text-white font-semibold">₹{item.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 backdrop-blur-sm rounded-xl p-6 mb-6 border border-emerald-500/30">
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-300">
                      <span>Subtotal</span>
                      <span>₹{completedSale.subtotal.toFixed(2)}</span>
                    </div>
                    {completedSale.discount > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Discount</span>
                        <span className="text-rose-400">- ₹{completedSale.discount.toFixed(2)}</span>
                      </div>
                    )}
                    {completedSale.tax > 0 && (
                      <div className="flex justify-between text-slate-300">
                        <span>Tax (GST)</span>
                        <span>₹{completedSale.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-3xl font-bold text-white border-t-2 border-emerald-500/50 pt-3 mt-3">
                      <span>Total Paid</span>
                      <span className="text-emerald-400">₹{completedSale.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center mb-6">
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-full px-6 py-3 border border-slate-700">
                    <span className="text-slate-400 mr-2">Payment:</span>
                    <span className="text-white font-semibold uppercase">{completedSale.paymentMethod}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => handlePrintBill(completedSale.invoiceNumber)}
                    className="flex-1 h-14 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
                  >
                    <Printer className="mr-2 h-5 w-5" />
                    Print Bill
                  </Button>
                  <Button
                    onClick={handleNewSale}
                    className="flex-1 h-14 text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20"
                  >
                    New Sale
                  </Button>
                </div>

                <div className="text-center mt-8 text-slate-400 text-sm italic">
                  "From our hands to your heart"
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-serif">New Sale</h1>
            <p className="text-slate-400">Scan items to add them to the cart</p>
          </div>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
                <Settings className="mr-2 h-4 w-4" />
                Print Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Printer Configuration</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div>
                  <Label htmlFor="billWidth" className="text-slate-300">Bill Width (mm)</Label>
                  <Input
                    id="billWidth"
                    type="number"
                    value={billWidth}
                    onChange={(e) => setBillWidth(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white mt-2"
                    placeholder="80"
                  />
                  <p className="text-xs text-slate-500 mt-1">Standard: 80mm, 58mm</p>
                </div>
                <div>
                  <Label className="text-slate-300">Barcode Label Size</Label>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <Label htmlFor="labelWidth" className="text-slate-400 text-xs">Width (mm)</Label>
                      <Input
                        id="labelWidth"
                        type="number"
                        value={labelWidth}
                        onChange={(e) => setLabelWidth(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="38"
                      />
                    </div>
                    <div>
                      <Label htmlFor="labelHeight" className="text-slate-400 text-xs">Height (mm)</Label>
                      <Input
                        id="labelHeight"
                        type="number"
                        value={labelHeight}
                        onChange={(e) => setLabelHeight(e.target.value)}
                        className="bg-slate-800 border-slate-600 text-white mt-1"
                        placeholder="25"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Your size: 38×25mm, Common: 50×30mm</p>
                </div>
                <Button onClick={handleSaveSettings} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {!showCheckout ? (
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Scan Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BarcodeScannerInput 
                onScan={handleBarcodeScan}
                placeholder="Scan barcode or type code..."
                autoFocus={true}
              />
            </CardContent>
          </Card>

          {saleItems.length > 0 && (
            <>
              <Card className="bg-slate-900/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Cart Items ({saleItems.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-slate-800/50">
                        <TableHead className="text-slate-300">Item</TableHead>
                        <TableHead className="text-slate-300">Barcode</TableHead>
                        <TableHead className="text-slate-300">Price</TableHead>
                        <TableHead className="text-slate-300">Quantity</TableHead>
                        <TableHead className="text-slate-300">Total</TableHead>
                        <TableHead className="text-slate-300">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleItems.map((item) => (
                        <TableRow key={item.itemId} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-white font-medium">{item.name}</TableCell>
                          <TableCell className="text-slate-400 font-mono text-sm">{item.barcode}</TableCell>
                          <TableCell className="text-white">₹{item.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                                className="h-8 w-8 p-0 border-slate-600 text-white hover:bg-slate-800"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="text-white font-medium w-8 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                                className="h-8 w-8 p-0 border-slate-600 text-white hover:bg-slate-800"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-white font-semibold">₹{item.total.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePrintBarcode(item)}
                                className="text-blue-400 hover:text-blue-300 hover:bg-slate-800"
                              >
                                <Tag className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeItem(item.itemId)}
                                className="text-red-400 hover:text-red-300 hover:bg-slate-800"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

                <Card className="bg-slate-900/50 border-slate-700">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal:</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                      </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <div className="flex items-center gap-2">
                            <Label htmlFor="discount-percent" className="text-slate-400">
                              Discount
                            </Label>
                            <Input
                              id="discount-percent"
                              type="number"
                              value={discountPercent}
                              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                              className="w-16 h-8 bg-slate-800 border-slate-600 text-white text-sm px-2"
                              min="0"
                              max="100"
                              step="0.1"
                            />
                            <span className="text-slate-400">%</span>
                          </div>
                          <span>- ₹{percentageDiscount.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="gst-enabled"
                              checked={gstEnabled}
                              onCheckedChange={(checked) => setGstEnabled(checked as boolean)}
                              className="border-slate-600"
                            />
                            <Label htmlFor="gst-enabled" className="text-slate-400 cursor-pointer">
                              GST
                            </Label>
                            {gstEnabled && (
                              <Input
                                type="number"
                                value={gstRate}
                                onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                                className="w-16 h-8 bg-slate-800 border-slate-600 text-white text-sm px-2"
                                min="0"
                                max="100"
                                step="0.1"
                              />
                            )}
                            {gstEnabled && <span className="text-slate-400">%</span>}
                          </div>
                          <span>₹{tax.toFixed(2)}</span>
                        </div>
                      <div className="flex justify-between text-2xl font-bold text-white border-t border-slate-700 pt-3">
                        <span>Total:</span>
                        <span>₹{total.toFixed(2)}</span>
                      </div>
                    </div>

                  <Button
                    onClick={handleCheckout}
                    className="w-full mt-6 h-14 text-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Proceed to Checkout
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Customer Details (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customerName" className="text-slate-300">Customer Name</Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="text-slate-300">Phone Number</Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {(['cash', 'card', 'upi', 'credit'] as const).map((method) => (
                  <Button
                    key={method}
                    variant={paymentMethod === method ? 'default' : 'outline'}
                    onClick={() => setPaymentMethod(method)}
                    className={paymentMethod === method 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                      : 'border-slate-600 text-white hover:bg-slate-800'
                    }
                  >
                    {method.toUpperCase()}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="checkout-discount-percent" className="text-slate-400">
                          Discount
                        </Label>
                        <Input
                          id="checkout-discount-percent"
                          type="number"
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                          className="w-16 h-8 bg-slate-800 border-slate-600 text-white text-sm px-2"
                          min="0"
                          max="100"
                          step="0.1"
                        />
                        <span className="text-slate-400">%</span>
                      </div>
                      <span>- ₹{percentageDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="checkout-gst-enabled"
                          checked={gstEnabled}
                          onCheckedChange={(checked) => setGstEnabled(checked as boolean)}
                          className="border-slate-600"
                        />
                        <Label htmlFor="checkout-gst-enabled" className="text-slate-400 cursor-pointer">
                          GST
                        </Label>
                        {gstEnabled && (
                          <Input
                            type="number"
                            value={gstRate}
                            onChange={(e) => setGstRate(parseFloat(e.target.value) || 0)}
                            className="w-16 h-8 bg-slate-800 border-slate-600 text-white text-sm px-2"
                            min="0"
                            max="100"
                            step="0.1"
                          />
                        )}
                        {gstEnabled && <span className="text-slate-400">%</span>}
                      </div>
                      <span>₹{tax.toFixed(2)}</span>
                    </div>
                  <div className="flex justify-between text-2xl font-bold text-white border-t border-slate-700 pt-3">
                    <span>Total:</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                </div>

              <div className="flex gap-4">
                <Button
                  onClick={() => setShowCheckout(false)}
                  variant="outline"
                  className="flex-1 h-14 text-lg border-slate-600 text-white hover:bg-slate-800"
                >
                  Back to Cart
                </Button>
                <Button
                  onClick={handleCompleteSale}
                  className="flex-1 h-14 text-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Printer className="mr-2 h-5 w-5" />
                  Complete Sale & Print
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        <div ref={printRef} style={{ display: 'none' }} />

        {/* Bill Size Configuration Dialog */}
        <Dialog open={showBillSizeDialog} onOpenChange={setShowBillSizeDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle>Configure Bill Size</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bill-width" className="text-slate-300">Bill Width (mm)</Label>
                <Input
                  id="bill-width"
                  type="number"
                  value={billWidth}
                  onChange={(e) => setBillWidth(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white"
                  placeholder="80"
                />
                <p className="text-xs text-slate-400">Common sizes: 58mm, 80mm, 110mm</p>
              </div>
              <Button
                onClick={handleBillSizeConfirm}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                Continue to Checkout
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }