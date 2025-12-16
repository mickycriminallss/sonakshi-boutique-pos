"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  FileText,
  Barcode,
  Settings,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sales', label: 'New Sale', icon: ShoppingCart },
  { href: '/items', label: 'Items', icon: Package },
  { href: '/stock', label: 'Stock', icon: Boxes },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/barcodes', label: 'Barcodes', icon: Barcode },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-800 flex flex-col z-50">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            SONAKSHI
          </h1>
          <p className="text-xs text-slate-500 tracking-widest mt-0.5">BOUTIQUE POS</p>
          <p className="text-[10px] text-slate-600 italic mt-1" style={{ fontFamily: 'Georgia, serif' }}>De Manibus Nostris Ad Cor Tuum</p>
        </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-amber-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg p-4 border border-amber-500/20">
            <p className="text-xs text-slate-400 font-semibold">Owner</p>
            <p className="text-sm text-white font-medium mt-1">Sonali</p>
            <p className="text-xs text-slate-400 mt-2">Contact</p>
            <p className="text-sm text-amber-400 font-mono">+91 74139 56875</p>
          </div>
        </div>
    </aside>
  );
}
