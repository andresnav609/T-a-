// Pantalla Hoy — sección 8.1. "Disponible hoy" es el protagonista.

import { useMemo, useState } from 'react';
import { useApp } from '../state/app';
import { Card, Button, ProgressBar, EmptyState, useConfirm } from '../components/ui';
import { ExpenseSheet } from '../components/ExpenseSheet';
import { fmtMoney, fmtDateShort, weekdayName } from '../lib/format';
import type { Expense, ExtraIncome } from '../lib/types';

export default function Today({ goPact, openClose }: { goPact: () => void; openClose: () => void }) {
  const app = useApp();
  const [sheet, setSheet] = useState<null | { kind: 'expense' | 'income'; editing?: Expense | ExtraIncome }>(null);
  const [pendingDelete, confirmDelete] = useConfirm();

  const t = app.todayComp;
  // El número grande es lo que QUEDA hoy: disponible − gastado (= arrastre parcial).
  const available = t?.carry ?? 0;
  const yesterdayCarry = t ? t.available - t.baseLimit : 0;
  const todayExpenses = useMemo(
    () => app.expenses.filter((e) => e.date === app.today).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [app.expenses, app.today],
  );
  const todayIncomes = useMemo(
    () => app.extraIncomes.filter((e) => e.date === app.today),
    [app.extraIncomes, app.today],
  );
  const mainGoal = useMemo(() => {
    const active = app.goals.filter((g) => g.status === 'active');
    return active.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] ?? null;
  }, [app.goals]);
  const catById = (id: string) => app.categories.find((c) => c.id === id);

  return (
    <div className="flex flex-col gap-3">
      {/* Disponible hoy */}
      <Card className="text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Disponible hoy</p>
        <p className={`my-1 text-6xl font-extrabold tabular-nums tracking-tight ${available >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {fmtMoney(available)}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-slate-400">Límite base</p>
            <p className="font-semibold tabular-nums">{fmtMoney(t?.baseLimit ?? 0)}</p>
          </div>
          <div>
            <p className="text-slate-400">Arrastre ayer</p>
            <p className={`font-semibold tabular-nums ${yesterdayCarry < 0 ? 'text-red-500' : ''}`}>{fmtMoney(yesterdayCarry)}</p>
          </div>
          <div>
            <p className="text-slate-400">Gastado hoy</p>
            <p className="font-semibold tabular-nums">{fmtMoney(t?.spent ?? 0)}</p>
          </div>
        </div>
      </Card>

      {/* Racha */}
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>🔥</span>
          <div>
            <p className="text-lg font-bold">{app.streak.current} {app.streak.current === 1 ? 'día' : 'días'} de racha</p>
            <p className="text-xs text-slate-400">Mejor: {app.streak.best} días</p>
          </div>
        </div>
        {app.streak.atRisk && (
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            ⚠️ En riesgo
          </span>
        )}
      </Card>

      {/* Meta principal */}
      {mainGoal && (
        <Card>
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="font-semibold">{mainGoal.name}</p>
            <p className="text-sm tabular-nums text-slate-500">{app.goalProgressFor(mainGoal).pct}%</p>
          </div>
          <ProgressBar pct={app.goalProgressFor(mainGoal).pct} color={app.profile!.color} />
        </Card>
      )}

      {/* Tarjetas pendientes */}
      {app.pendingClose && (
        <Card className="border-l-4 border-emerald-500">
          <p className="font-semibold">💰 Cierre de mes pendiente</p>
          <p className="mb-2 text-sm text-slate-500">Tu ciclo terminó: confirma cuánto vas a invertir.</p>
          <Button onClick={openClose} className="w-full">Ver cierre</Button>
        </Card>
      )}
      {app.pendingWeekly && (
        <WeeklyCard onSeen={() => app.markWeeklySeen(app.pendingWeekly!.id)} />
      )}

      {/* Gastos de hoy */}
      <Card>
        <p className="mb-2 font-semibold">Movimientos de hoy</p>
        {todayExpenses.length === 0 && todayIncomes.length === 0 ? (
          <EmptyState emoji="🌤️" text="Nada registrado todavía. Cuando gastes algo, anótalo aquí en segundos." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {todayIncomes.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <button className="flex min-h-[44px] flex-1 items-center gap-2 text-left" onClick={() => setSheet({ kind: 'income', editing: e })}>
                  <span aria-hidden>{catById(e.categoryId)?.emoji ?? '💵'}</span>
                  <span className="text-sm">{catById(e.categoryId)?.name ?? 'Ingreso'}{e.note ? ` · ${e.note}` : ''}</span>
                </button>
                <span className="font-semibold tabular-nums text-emerald-500">+{fmtMoney(e.amount)}</span>
                <DeleteBtn id={e.id} pending={pendingDelete} onConfirm={() => confirmDelete(e.id, () => app.deleteExtraIncome(e.id))} />
              </li>
            ))}
            {todayExpenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2.5">
                <button className="flex min-h-[44px] flex-1 items-center gap-2 text-left" onClick={() => setSheet({ kind: 'expense', editing: e })}>
                  <span aria-hidden>{catById(e.categoryId)?.emoji ?? '📦'}</span>
                  <span className="text-sm">{catById(e.categoryId)?.name ?? 'Gasto'}{e.note ? ` · ${e.note}` : ''}</span>
                </button>
                <span className="font-semibold tabular-nums">-{fmtMoney(e.amount)}</span>
                <DeleteBtn id={e.id} pending={pendingDelete} onConfirm={() => confirmDelete(e.id, () => app.deleteExpense(e.id))} />
              </li>
            ))}
          </ul>
        )}
        <Button variant="ghost" className="mt-1 w-full" onClick={() => setSheet({ kind: 'income' })}>
          + Ingreso extra
        </Button>
      </Card>

      {/* Botón flotante + Gasto */}
      <button
        onClick={() => setSheet({ kind: 'expense' })}
        aria-label="Registrar gasto"
        className="fixed bottom-24 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-white shadow-xl active:bg-emerald-600"
      >
        +
      </button>

      {sheet && (
        <ExpenseSheet
          key={sheet.editing?.id ?? sheet.kind}
          open
          kind={sheet.kind}
          editing={sheet.editing ?? null}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}

function DeleteBtn({ id, pending, onConfirm }: { id: string; pending: string | null; onConfirm: () => void }) {
  return (
    <button
      onClick={onConfirm}
      aria-label="Borrar"
      className={`ml-2 flex h-11 w-11 items-center justify-center rounded-full text-sm ${
        pending === id ? 'bg-red-500 text-white' : 'text-slate-300 dark:text-slate-600'
      }`}
    >
      {pending === id ? '✓?' : '✕'}
    </button>
  );
}

function WeeklyCard({ onSeen }: { onSeen: () => void }) {
  const app = useApp();
  const w = app.pendingWeekly!;
  const d = w.data;
  return (
    <Card className="border-l-4 border-blue-500">
      <p className="font-semibold">📊 Resumen semanal</p>
      <p className="mb-2 text-xs text-slate-400">
        {weekdayName(new Date(w.weekStart + 'T00:00').getDay())} {fmtDateShort(w.weekStart)} – {fmtDateShort(w.weekEnd)}
      </p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Stat label="Gastaste" value={fmtMoney(d.spent)} />
        <Stat label="Límite semanal" value={fmtMoney(d.weekLimit)} />
        <Stat label="Diferencia" value={fmtMoney(d.difference)} good={d.difference >= 0} />
        <Stat label="Días bajo el límite" value={`${d.daysUnderLimit} de 7`} />
        {d.topCategory && <Stat label="Top categoría" value={`${d.topCategory.emoji} ${d.topCategory.name} (${d.topCategory.pct}%)`} />}
        {d.vsPrevWeekPct !== null && (
          <Stat label="Vs semana anterior" value={`${d.vsPrevWeekPct > 0 ? '+' : ''}${d.vsPrevWeekPct}%`} good={d.vsPrevWeekPct <= 0} />
        )}
        <Stat label="Proyección de cierre" value={fmtMoney(d.projectedCarry)} good={d.projectedCarry >= 0} />
        <Stat label="Inversión estimada" value={fmtMoney(d.projectedInvestment)} good />
      </div>
      <Button variant="secondary" className="mt-3 w-full" onClick={onSeen}>Visto ✓</Button>
    </Card>
  );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-semibold tabular-nums ${good === true ? 'text-emerald-600 dark:text-emerald-400' : good === false ? 'text-red-500' : ''}`}>{value}</p>
    </div>
  );
}
