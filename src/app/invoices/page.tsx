"use client";

import { useState, useEffect } from 'react';
import { getSales, deleteSale } from '@/lib/store';
import { Sale } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileText, Search, Printer, Eye, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function InvoicesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);

  useEffect(() => {
    async function loadSales() {
      const allSales = await getSales();
      const sortedSales = allSales.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setSales(sortedSales);
      setFilteredSales(sortedSales);
    }
    loadSales();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSales(sales);
    } else {
      const filtered = sales.filter(sale => 
        sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customerPhone?.includes(searchTerm)
      );
      setFilteredSales(filtered);
    }
  }, [searchTerm, sales]);

  const handlePrintInvoice = (sale: Sale) => {
    const billWidth = localStorage.getItem('billPrintWidth') || '80mm';
    const billHeight = localStorage.getItem('billPrintHeight') || 'auto';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Please allow pop-ups to print the bill');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${sale.invoiceNumber}</title>
            <style>
              @page {
                size: A5;
                width: 148mm;
                height: 210mm;
                margin: 10mm;
              }
              * {
                box-sizing: border-box;
                -webkit-print-color-adjust: exact;
              }
              body {
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                font-size: ${parseInt(billWidth) >= 140 ? '16px' : parseInt(billWidth) > 100 ? '14px' : '12px'};
                line-height: 1.5;
                padding: ${parseInt(billWidth) >= 140 ? '15mm' : parseInt(billWidth) > 100 ? '10mm' : '4mm'};
                width: ${billWidth};
                min-height: ${billHeight === 'auto' ? 'auto' : billHeight};
                background: white;
                color: black;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                margin-bottom: ${parseInt(billWidth) >= 140 ? '30px' : '20px'};
                border-bottom: 2px solid #000;
                padding-bottom: ${parseInt(billWidth) >= 140 ? '20px' : '10px'};
              }
              .business-name {
                font-size: ${parseInt(billWidth) >= 140 ? '36px' : parseInt(billWidth) > 100 ? '28px' : '20px'};
                font-weight: 800;
                margin-bottom: 8px;
                letter-spacing: 2px;
                text-transform: uppercase;
                color: #000;
              }
              .business-info {
                font-size: ${parseInt(billWidth) >= 140 ? '14px' : parseInt(billWidth) > 100 ? '12px' : '10px'};
                color: #333;
                line-height: 1.6;
              }
              .invoice-title {
                text-align: center;
                font-size: ${parseInt(billWidth) >= 140 ? '20px' : '16px'};
                font-weight: bold;
                margin: 20px 0;
                text-decoration: underline;
                text-transform: uppercase;
                letter-spacing: 1px;
              }
              .meta-container {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                font-size: ${parseInt(billWidth) >= 140 ? '14px' : parseInt(billWidth) > 100 ? '13px' : '11px'};
                background: ${parseInt(billWidth) >= 140 ? '#f8f8f8' : 'transparent'};
                padding: ${parseInt(billWidth) >= 140 ? '10px' : '0'};
                border-radius: 4px;
              }
              .meta-column {
                flex: 1;
              }
              .meta-column:last-child {
                text-align: right;
              }
              .table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              .table th {
                text-align: left;
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
                padding: ${parseInt(billWidth) >= 140 ? '12px 8px' : '8px 4px'};
                font-weight: bold;
                background: #eee;
              }
              .table td {
                padding: ${parseInt(billWidth) >= 140 ? '12px 8px' : '8px 4px'};
                border-bottom: 1px solid #eee;
              }
              .text-right { text-align: right; }
              .totals-container {
                margin-top: 30px;
                width: 100%;
                display: flex;
                justify-content: flex-end;
              }
              .totals-table {
                width: ${parseInt(billWidth) >= 140 ? '40%' : parseInt(billWidth) > 100 ? '50%' : '100%'};
              }
              .total-row {
                display: flex;
                justify-content: space-between;
                padding: 6px 0;
              }
              .grand-total {
                font-size: ${parseInt(billWidth) >= 140 ? '24px' : parseInt(billWidth) > 100 ? '20px' : '16px'};
                font-weight: bold;
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
                margin-top: 10px;
                padding: 10px 0;
                color: #000;
              }
              .footer {
                text-align: center;
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                font-size: 12px;
                color: #666;
              }
              .thank-you {
                font-weight: bold;
                font-size: 16px;
                color: #000;
                margin-bottom: 8px;
              }
              .signature-section {
                display: ${parseInt(billWidth) >= 140 ? 'flex' : 'none'};
                justify-content: space-between;
                margin-top: 60px;
                padding: 0 10px;
              }
              .signature-box {
                text-align: center;
                width: 150px;
                border-top: 1px solid #000;
                padding-top: 5px;
                font-size: 12px;
              }
              @media print {
                body { margin: 0; padding: ${parseInt(billWidth) >= 140 ? '15mm' : parseInt(billWidth) > 100 ? '10mm' : '4mm'}; }
              }
            </style>
        </head>
        <body>
          <div class="header">
            <div class="business-name">SONAKSHI BOUTIQUE</div>
            <div style="font-size: 12px; font-style: italic; margin-bottom: 8px;">From our hands to your heart</div>
            <div class="business-info">
              Fashion & Lifestyle | Owner: Sonali<br>
              Tel: +91 7413956875 | GSTIN: 29ABCDE1234F1Z5
            </div>
          </div>

          <div class="invoice-title">Tax Invoice</div>

          <div class="meta-container">
            <div class="meta-column">
              <strong>Invoice No:</strong> ${sale.invoiceNumber}<br>
              <strong>Date:</strong> ${new Date(sale.createdAt).toLocaleDateString('en-IN')}<br>
              <strong>Time:</strong> ${new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="meta-column">
              ${sale.customerName ? `<strong>Customer:</strong> ${sale.customerName}<br>` : '<strong>Customer:</strong> Cash Sale<br>'}
              ${sale.customerPhone ? `<strong>Phone:</strong> ${sale.customerPhone}` : ''}
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th>Item Description</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Rate</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">${item.price.toFixed(2)}</td>
                  <td class="text-right">${(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals-container">
            <div class="totals-table">
              <div class="total-row">
                <span>Subtotal</span>
                <span>₹${sale.subtotal.toFixed(2)}</span>
              </div>
              ${sale.discount > 0 ? `
                <div class="total-row">
                  <span>Discount</span>
                  <span>- ₹${sale.discount.toFixed(2)}</span>
                </div>
              ` : ''}
              ${sale.tax > 0 ? `
                <div class="total-row">
                  <span>GST</span>
                  <span>₹${sale.tax.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>NET AMOUNT</span>
                <span>₹${sale.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

            <div class="footer">
              <div class="thank-you">Thank You for Shopping!</div>
              <div>Visit us again at SONAKSHI BOUTIQUE</div>
              <div style="margin-top: 10px; font-size: 10px; color: #999;">*** DUPLICATE INVOICE ***</div>
            </div>

            <div class="signature-section">
              <div class="signature-box">Customer's Signature</div>
              <div class="signature-box">Authorized Signatory</div>
            </div>

            <script>
            window.onload = () => {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;
    
    try {
      await deleteSale(saleToDelete.id);
      const updatedSales = await getSales();
      const sortedSales = updatedSales.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setSales(sortedSales);
      setFilteredSales(sortedSales);
      toast.success(`Invoice ${saleToDelete.invoiceNumber} deleted successfully`);
      setSaleToDelete(null);
    } catch (error) {
      console.error('Error deleting sale:', error);
      toast.error('Failed to delete invoice');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentBadgeColor = (method: string) => {
    switch (method) {
      case 'cash': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'card': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'upi': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'credit': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-serif">Invoices</h1>
        <p className="text-slate-400">View and manage all sales invoices</p>
      </div>

      <Card className="bg-slate-900/50 border-slate-700 mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search by invoice number, customer name, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
        </CardContent>
      </Card>

      {filteredSales.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-16 w-16 text-slate-700 mb-4" />
            <p className="text-slate-400 text-lg">
              {searchTerm ? 'No invoices found matching your search' : 'No invoices yet'}
            </p>
            <p className="text-slate-500 text-sm mt-2">
              {searchTerm ? 'Try a different search term' : 'Sales will appear here once transactions are completed'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/30 border-emerald-700/30">
              <CardHeader>
                <CardTitle className="text-emerald-400 text-sm font-medium">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">
                  ₹{filteredSales.reduce((sum, sale) => sum + sale.total, 0).toFixed(2)}
                </p>
                <p className="text-slate-400 text-sm mt-1">{filteredSales.length} invoices</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/30 to-blue-950/30 border-blue-700/30">
              <CardHeader>
                <CardTitle className="text-blue-400 text-sm font-medium">Average Sale</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">
                  ₹{(filteredSales.reduce((sum, sale) => sum + sale.total, 0) / Math.max(filteredSales.length, 1)).toFixed(2)}
                </p>
                <p className="text-slate-400 text-sm mt-1">Per transaction</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-900/30 to-amber-950/30 border-amber-700/30">
              <CardHeader>
                <CardTitle className="text-amber-400 text-sm font-medium">Total Items Sold</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-white">
                  {filteredSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)}
                </p>
                <p className="text-slate-400 text-sm mt-1">Units</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900/50 border-slate-700">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-800/50">
                    <TableHead className="text-slate-300">Invoice</TableHead>
                    <TableHead className="text-slate-300">Date & Time</TableHead>
                    <TableHead className="text-slate-300">Customer</TableHead>
                    <TableHead className="text-slate-300">Items</TableHead>
                    <TableHead className="text-slate-300">Payment</TableHead>
                    <TableHead className="text-slate-300 text-right">Amount</TableHead>
                    <TableHead className="text-slate-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="border-slate-700 hover:bg-slate-800/50">
                      <TableCell className="text-white font-mono font-medium">{sale.invoiceNumber}</TableCell>
                      <TableCell className="text-slate-400 text-sm">{formatDate(sale.createdAt)}</TableCell>
                      <TableCell className="text-white">
                        {sale.customerName ? (
                          <div>
                            <div className="font-medium">{sale.customerName}</div>
                            {sale.customerPhone && (
                              <div className="text-xs text-slate-400">{sale.customerPhone}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Walk-in</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <Badge className={getPaymentBadgeColor(sale.paymentMethod)}>
                          {sale.paymentMethod.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white font-semibold text-right">
                        ₹{sale.total.toFixed(2)}
                      </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewDetails(sale)}
                              className="text-blue-400 hover:text-blue-300 hover:bg-slate-800"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePrintInvoice(sale)}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-slate-800"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSaleToDelete(sale)}
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
        </>
      )}

      {selectedSale && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedSale(null)}>
          <Card className="bg-slate-900 border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white text-2xl">{selectedSale.invoiceNumber}</CardTitle>
                  <p className="text-slate-400 text-sm mt-1">{formatDate(selectedSale.createdAt)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSale(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {selectedSale.customerName && (
                <div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Customer Details</h3>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-white font-medium">{selectedSale.customerName}</p>
                    {selectedSale.customerPhone && (
                      <p className="text-slate-400 text-sm mt-1">{selectedSale.customerPhone}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-slate-400 text-sm font-medium mb-2">Items</h3>
                <div className="bg-slate-800/50 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-300">Item</TableHead>
                        <TableHead className="text-slate-300 text-right">Qty</TableHead>
                        <TableHead className="text-slate-300 text-right">Price</TableHead>
                        <TableHead className="text-slate-300 text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items.map((item) => (
                        <TableRow key={item.itemId} className="border-slate-700">
                          <TableCell className="text-white">{item.name}</TableCell>
                          <TableCell className="text-slate-400 text-right">{item.quantity}</TableCell>
                          <TableCell className="text-slate-400 text-right">₹{item.price.toFixed(2)}</TableCell>
                          <TableCell className="text-white text-right">₹{(item.price * item.quantity).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>₹{selectedSale.subtotal.toFixed(2)}</span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Discount:</span>
                    <span>- ₹{selectedSale.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>GST (18%):</span>
                  <span>₹{selectedSale.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-white text-xl font-bold border-t border-slate-700 pt-3">
                  <span>Total:</span>
                  <span>₹{selectedSale.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Payment Method</p>
                  <Badge className={`${getPaymentBadgeColor(selectedSale.paymentMethod)} mt-1`}>
                    {selectedSale.paymentMethod.toUpperCase()}
                  </Badge>
                </div>
                <Button
                  onClick={() => handlePrintInvoice(selectedSale)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Invoice
                </Button>
              </div>
            </CardContent>
            </Card>
          </div>
        )}

        <AlertDialog open={!!saleToDelete} onOpenChange={() => setSaleToDelete(null)}>
          <AlertDialogContent className="bg-slate-900 border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete Invoice?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                Are you sure you want to delete invoice <span className="font-mono font-semibold text-white">{saleToDelete?.invoiceNumber}</span>?
                <br /><br />
                This action will restore the stock for all items in this sale and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Invoice
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }
