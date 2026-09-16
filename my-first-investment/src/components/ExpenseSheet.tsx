// Registro de gasto / ingreso extra en menos de 10 segundos:
// abrir (+) → monto en el teclado → chip de categoría → Guardar. 4 toques.

import { useMemo, useState } from 'react';
import { useApp } from '../state/app';
import { Sheet, Keypad, Chip, Button, inputCls } from './ui';
import { fmtMoney } from '../lib/format';
import { todayISO } from '../lib/dates';
import type { Expense, ExtraIncome } from '../lib/types';

export function ExpenseSheet({ open, onClose, kind, editing }: {
  open: boolean;
  onClose: () => void;
  kind: 'expense' | 'income';
  editing?: Expense | ExtraIncome | null;
}) {
  const app = useApp();
  const cats = useMemo(
    () => app.categories.filter((c) => c.kind === kind && !c.archived),
    [app.categories, kind],
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '');
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? cats[0]?.id ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [showExtra, setShowExtra] = useState(false);

  const n = parseFloat(amount);
  const valid = !Number.isNaN(n) && n > 0 && categoryId !== '';

  const save = async () => {
    if (!valid) return;
    const base = { date, amount: n, categoryId, note: note.trim() || undefined };
    if (kind === 'expense') {
      if (editing) await app.updateExpense({ ...(editing as Expense), ...base });
      else await app.addExpense(base);
    } else {
      if (editing) {
        await app.deleteExtraIncome(editing.id);
        await app.addExtraIncome(base);
      } else await app.addExtraIncome(base);
    }
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Editar' : kind === 'expense' ? 'Nuevo gasto' : 'Ingreso extra'}>
      <p className={`mb-2 text-center text-5xl font-extrabold tabular-nums ${kind === 'income' ? 'text-emerald-500' : ''}`}>
        {amount === '' ? '$0' : fmtMoney(n || 0)}
      </p>
      <Keypad value={amount} onChange={setAmount} />

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Categoría">
        {cats.map((c) => (
          <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)} color={c.color}>
            {c.emoji} {c.name}
          </Chip>
        ))}
      </div>

      {showExtra ? (
        <div className="mt-3 flex gap-2">
          <input
            className={inputCls}
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Nota"
          />
          <input
            type="date"
            className={`${inputCls} w-40`}
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Fecha"
          />
        </div>
      ) : (
        <button className="mt-2 min-h-[44px] w-full text-sm text-slate-400" onClick={() => setShowExtra(true)}>
          + nota o fecha
        </button>
      )}

      <Button className="mt-3 w-full" disabled={!valid} onClick={save}>
        {editing ? 'Guardar cambios' : 'Guardar'}
      </Button>
    </Sheet>
  );
}
