"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getItems, getSales } from '@/lib/store';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { Item, Sale } from '@/lib/types';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  AlertTriangle,
  IndianRupee,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    async function loadData() {
      const [itemsData, salesData] = await Promise.all([getItems(), getSales()]);
      setItems(itemsData);
      setSales(salesData);
    }
    loadData();
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySales = sales.filter(s => new Date(s.createdAt) >= today);
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthlySales = sales.filter(s => new Date(s.createdAt) >= monthStart);
  const monthlyTotal = monthlySales.reduce((sum, s) => sum + s.total, 0);

  const lowStockItems = items.filter(item => item.stock <= item.minStock);

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const chartData = last7Days.map(date => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const daySales = sales.filter(s => {
      const saleDate = new Date(s.createdAt);
      return saleDate >= dayStart && saleDate <= dayEnd;
    });
    
    return {
      name: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      sales: daySales.reduce((sum, s) => sum + s.total, 0),
    };
  });

  const recentSales = [...sales].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">{formatDateShort(new Date())}</p>
        </div>
        <Link href="/sales">
          <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-900 font-semibold">
            <ShoppingCart className="mr-2 h-4 w-4" />
            New Sale
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-400">Today&apos;s Sales</CardTitle>
            <IndianRupee className="h-5 w-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(todayTotal)}</div>
            <p className="text-xs text-slate-400 mt-1">{todaySales.length} transactions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400">Monthly Sales</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(monthlyTotal)}</div>
            <p className="text-xs text-slate-400 mt-1">{monthlySales.length} transactions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-400">Total Items</CardTitle>
            <Package className="h-5 w-5 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{items.length}</div>
            <p className="text-xs text-slate-400 mt-1">products in inventory</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/20 to-pink-500/20 border-rose-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-400">Low Stock</CardTitle>
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{lowStockItems.length}</div>
            <p className="text-xs text-slate-400 mt-1">items need restock</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BarChart3 className="h-5 w-5 text-amber-400" />
              Sales Trend (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f8fafc' }}
                    formatter={(value: number) => [formatCurrency(value), 'Sales']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    fill="url(#salesGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No sales yet</p>
            ) : (
              <div className="space-y-4">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{sale.invoiceNumber}</p>
                      <p className="text-xs text-slate-400">{formatDateShort(sale.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-amber-400">{formatCurrency(sale.total)}</p>
                      <p className="text-xs text-slate-400">{sale.items.length} items</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="mt-6 bg-rose-500/10 border-rose-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockItems.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-white">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-rose-400">{item.stock} {item.unit}</p>
                    <p className="text-xs text-slate-400">Min: {item.minStock}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}