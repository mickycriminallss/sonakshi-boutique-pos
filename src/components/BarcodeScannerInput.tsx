"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Scan } from 'lucide-react';

interface BarcodeScannerInputProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function BarcodeScannerInput({ 
  onScan, 
  placeholder = "Scan barcode or type manually...",
  autoFocus = true 
}: BarcodeScannerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const lastKeyTime = useRef<number>(0);
  const buffer = useRef<string>('');

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const currentTime = Date.now();
    
    if (currentTime - lastKeyTime.current > 100) {
      buffer.current = '';
    }
    lastKeyTime.current = currentTime;

    if (e.key === 'Enter' && buffer.current.length > 0) {
      onScan(buffer.current);
      buffer.current = '';
      setValue('');
      e.preventDefault();
    } else if (e.key.length === 1) {
      buffer.current += e.key;
    }
  }, [onScan]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const input = inputRef.current;
    if (input) {
      input.addEventListener('keydown', handleKeyDown);
      return () => input.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onScan(value.trim());
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-11 h-14 text-lg font-mono bg-slate-900 border-emerald-500/30 focus:border-emerald-500 text-white placeholder:text-slate-500"
        autoComplete="off"
        autoFocus={autoFocus}
      />
    </form>
  );
}
