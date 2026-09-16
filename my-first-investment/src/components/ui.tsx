// Componentes compartidos: hoja inferior, barras, teclado numérico, etc.
// Objetivos táctiles ≥ 44px en todos los controles.

import React, { useEffect, useRef, useState } from 'react';

export function Sheet({ open, onClose, children, title }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/50" aria-label="Cerrar" onClick={onClose} />
      <div className="mfi-sheet relative w-full max-w-md rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:bg-slate-900 max-h-[92dvh] overflow-y-auto">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Modal({ open, children, title }: { open: boolean; children: React.ReactNode; title?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="mfi-celebrate relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 max-h-[90dvh] overflow-y-auto">
        {title && <h2 className="mb-3 text-lg font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ pct, color = 'var(--color-brand)' }: { pct: number; color?: string }) {
  const clamped = Math.max(0, Math.min(pct, 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, backgroundColor: color }} />
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled }: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const base = 'min-h-[44px] rounded-2xl px-4 font-semibold transition-colors disabled:opacity-40';
  const styles = {
    primary: 'bg-emerald-500 text-white active:bg-emerald-600',
    secondary: 'bg-slate-200 text-slate-800 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:active:bg-slate-700',
    ghost: 'text-emerald-600 dark:text-emerald-400',
    danger: 'bg-red-500 text-white active:bg-red-600',
  } as const;
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-800';

export function NumberInput({ value, onChange, min, max, step = 'any', ariaLabel }: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: string;
  ariaLabel?: string;
}) {
  // Estado local en texto para permitir borrar/escribir con decimales.
  const [text, setText] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      className={inputCls}
      value={text}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(String(value)); }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parseFloat(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
    />
  );
}

/** Teclado numérico grande para registrar montos en segundos. */
export function Keypad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const press = (k: string) => {
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (k === '.') {
      if (value.includes('.')) return;
      return onChange(value === '' ? '0.' : value + '.');
    }
    const [, dec] = value.split('.');
    if (dec !== undefined && dec.length >= 2) return; // máx. 2 decimales
    if (value.replace('.', '').length >= 7) return;
    onChange(value === '0' ? k : value + k);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Teclado numérico">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="min-h-[56px] rounded-2xl bg-slate-100 text-2xl font-semibold active:bg-slate-200 dark:bg-slate-800 dark:active:bg-slate-700"
          aria-label={k === '⌫' ? 'Borrar' : k}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

export function Chip({ selected, onClick, children, color }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[44px] whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
        selected
          ? 'border-transparent text-white'
          : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
      }`}
      style={selected ? { backgroundColor: color ?? 'var(--color-brand)' } : undefined}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900 ${className}`}>
      {children}
    </div>
  );
}

export function EmptyState({ emoji, text, action }: { emoji: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500 dark:text-slate-400">
      <span className="text-4xl" aria-hidden>{emoji}</span>
      <p className="max-w-[26ch] text-sm">{text}</p>
      {action}
    </div>
  );
}

/** Confirmación en dos toques para acciones destructivas. */
export function useConfirm(): [string | null, (id: string, fn: () => void) => void] {
  const [pending, setPending] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const confirm = (id: string, fn: () => void) => {
    if (pending === id) {
      setPending(null);
      clearTimeout(timer.current);
      fn();
    } else {
      setPending(id);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setPending(null), 2500);
    }
  };
  return [pending, confirm];
}
