"use client";

import { useState, useRef } from 'react';
import { BarcodeScannerInput } from '@/components/BarcodeScannerInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getItemByBarcode, addSale, getNextInvoiceNumber } from '@/lib/store';
import { SaleItem, Sale } from '@/lib/types';
import { toast } from 'sonner';
import { Trash2, Plus, Minus, Printer, Tag } from 'lucide-react';

export default function SalesPage() {
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash');
  const [showCheckout, setShowCheckout] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const handleBarcodeScan = (barcode: string) => {
    const item = getItemByBarcode(barcode);
    
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

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(itemId);
      return;
    }

    const item = getItemByBarcode(saleItems.find(si => si.itemId === itemId)?.barcode || '');
    if (item && newQuantity > item.stock) {
      toast.error(`Only ${item.stock} items available in stock`);
      return;
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
    const totalDiscount = saleItems.reduce((sum, item) => sum + item.discount, 0);
    const tax = (subtotal - totalDiscount) * 0.18; // 18% GST
    const total = subtotal - totalDiscount + tax;
    return { subtotal, totalDiscount, tax, total };
  };

  const handleCheckout = () => {
    if (saleItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  const handleCompleteSale = () => {
    if (saleItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const { subtotal, totalDiscount, tax, total } = calculateTotals();
    
    const sale: Sale = {
      id: crypto.randomUUID(),
      invoiceNumber: getNextInvoiceNumber(),
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

    addSale(sale);
    toast.success(`Sale completed! Invoice: ${sale.invoiceNumber}`);
    
    // Print bill
    setTimeout(() => {
      handlePrintBill();
    }, 500);

    // Reset form
    setSaleItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('cash');
    setShowCheckout(false);
  };

  const handlePrintBill = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    const { subtotal, totalDiscount, tax, total } = calculateTotals();
    const invoiceNumber = getNextInvoiceNumber();
    const now = new Date();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 10mm;
              width: 80mm;
              background: white;
              color: black;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #333;
              padding-bottom: 10px;
              margin-bottom: 10px;
            }
            .business-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .business-info {
              font-size: 10px;
              line-height: 1.4;
            }
            .invoice-info {
              margin: 10px 0;
              font-size: 11px;
            }
            .invoice-info div {
              display: flex;
              justify-content: space-between;
              margin: 3px 0;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
              font-size: 11px;
            }
            .items-table th {
              border-top: 1px solid #333;
              border-bottom: 1px solid #333;
              padding: 5px 2px;
              text-align: left;
              font-weight: bold;
            }
            .items-table td {
              padding: 5px 2px;
              border-bottom: 1px dashed #ddd;
            }
            .items-table .item-name {
              max-width: 120px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .items-table .text-right {
              text-align: right;
            }
            .totals {
              margin-top: 10px;
              border-top: 2px solid #333;
              padding-top: 10px;
            }
            .totals div {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-size: 11px;
            }
            .totals .grand-total {
              font-size: 14px;
              font-weight: bold;
              border-top: 2px solid #333;
              border-bottom: 2px solid #333;
              padding: 8px 0;
              margin-top: 5px;
            }
            .payment-info {
              margin: 10px 0;
              font-size: 11px;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 2px dashed #333;
              font-size: 10px;
            }
            .footer-message {
              margin: 8px 0;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="business-name">SONAKSHI BOUTIQUE</div>
            <div class="business-info">
              Fashion & Lifestyle Store<br>
              123 Main Street, City - 123456<br>
              Tel: +91 98765 43210<br>
              GSTIN: 29ABCDE1234F1Z5
            </div>
          </div>

          <div class="invoice-info">
            <div>
              <span><strong>Invoice:</strong> ${invoiceNumber}</span>
              <span>${now.toLocaleDateString('en-IN')}</span>
            </div>
            <div>
              <span>${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            ${customerName ? `<div><strong>Customer:</strong> ${customerName}</div>` : ''}
            ${customerPhone ? `<div><strong>Phone:</strong> ${customerPhone}</div>` : ''}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${saleItems.map(item => `
                <tr>
                  <td class="item-name">${item.name}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">₹${item.price.toFixed(2)}</td>
                  <td class="text-right">₹${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div>
              <span>Subtotal:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${totalDiscount > 0 ? `
              <div>
                <span>Discount:</span>
                <span>- ₹${totalDiscount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div>
              <span>GST (18%):</span>
              <span>₹${tax.toFixed(2)}</span>
            </div>
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>₹${total.toFixed(2)}</span>
            </div>
          </div>

          <div class="payment-info">
            <strong>Payment Method:</strong> ${paymentMethod.toUpperCase()}
          </div>

          <div class="footer">
            <div class="footer-message">Thank you for shopping with us!</div>
            <div>Visit us again soon</div>
            <div style="margin-top: 5px;">*** ORIGINAL COPY ***</div>
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

  const handlePrintBarcode = (item: SaleItem) => {
    const printWindow = window.open('', '', 'width=400,height=300');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode Label</title>
          <style>
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            body {
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 30mm;
              width: 50mm;
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

  const { subtotal, totalDiscount, tax, total } = calculateTotals();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-serif">New Sale</h1>
        <p className="text-slate-400">Scan items to add them to the cart</p>
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
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>Discount:</span>
                        <span>- ₹{totalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>GST (18%):</span>
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
                {totalDiscount > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Discount:</span>
                    <span>- ₹{totalDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>GST (18%):</span>
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
    </div>
  );
}
