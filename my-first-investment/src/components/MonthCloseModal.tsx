// Cierre de mes — sección 7.3. Modal con desglose, campo editable prellenado
// con la sugerencia, Confirmar inversión / Ahora no.

import { useState } from 'react';
import { useApp } from '../state/app';
import { Modal, Button, NumberInput } from './ui';
import { closeSuggestion } from '../lib/budget';
import { fmtMoney, fmtDateShort } from '../lib/format';
import type { CycleSummary } from '../lib/history';

export function MonthCloseModal({ cycle, onDone, onLater }: {
  cycle: CycleSummary;
  onDone: () => void;
  onLater: () => void;
}) {
  const app = useApp();
  const s = app.settings;
  const suggestion = closeSuggestion(cycle.finalCarry, cycle.totalExtraIncome, s);
  const [amount, setAmount] = useState(suggestion);
  const [saving, setSaving] = useState(false);

  const inc = s.suggestionIncludes;
  const rows: { label: string; value: number }[] = [];
  if (inc.positiveCarry) rows.push({ label: 'Arrastre positivo', value: Math.max(cycle.finalCarry, 0) });
  if (inc.extraIncome && s.extraIncomeMode === 'invest') rows.push({ label: 'Ingresos extra', value: cycle.totalExtraIncome });
  if (inc.savingsGoal) rows.push({ label: 'Meta de ahorro', value: s.savingsGoal });

  const confirm = async () => {
    setSaving(true);
    await app.confirmMonthClose(cycle, amount);
    onDone();
  };

  return (
    <Modal open title={`Cierre del ciclo ${fmtDateShort(cycle.start)} – ${fmtDateShort(cycle.end)}`}>
      <div className="mb-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
        <div className="flex justify-between py-0.5"><span>Gastado en el ciclo</span><span className="font-semibold tabular-nums">{fmtMoney(cycle.totalSpent)}</span></div>
        <div className="flex justify-between py-0.5">
          <span>Arrastre final</span>
          <span className={`font-semibold tabular-nums ${cycle.finalCarry < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtMoney(cycle.finalCarry)}</span>
        </div>
        {cycle.finalCarry < 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {s.negativeCarryMode === 'deduct' ? 'El negativo se descuenta del mes siguiente.' : 'El negativo se reinicia en cero.'}
          </p>
        )}
      </div>

      <p className="mb-1 text-sm font-medium text-slate-500">Sugerencia de inversión</p>
      <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between py-0.5">
            <span>{r.label}</span><span className="tabular-nums">{fmtMoney(r.value)}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-emerald-200 pt-1 font-bold dark:border-emerald-900">
          <span>Total sugerido</span><span className="tabular-nums">{fmtMoney(suggestion)}</span>
        </div>
      </div>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm font-medium">¿Cuánto vas a invertir?</span>
        <NumberInput value={amount} onChange={setAmount} min={0} ariaLabel="Monto a invertir" />
      </label>

      <div className="flex flex-col gap-2">
        <Button onClick={confirm} disabled={saving || amount < 0}>Confirmar inversión</Button>
        <Button variant="secondary" onClick={onLater}>Ahora no</Button>
      </div>
    </Modal>
  );
}
