// Pantalla Hoy — sección 8.1. "Disponible hoy" es el protagonista.
// Las mini-estadísticas y los widgets son configurables en Ajustes.

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useApp } from '../state/app';
import { Card, Button, ProgressBar, EmptyState, useConfirm, Sheet, NumberInput, Field } from '../components/ui';
import { ExpenseSheet } from '../components/ExpenseSheet';
import { fmtMoney, fmtDateShort, weekdayName } from '../lib/format';
import { diffDays } from '../lib/dates';
import type { Expense, ExtraIncome, HomeStatId } from '../lib/types';

export const HOME_STAT_LABELS: Record<HomeStatId, string> = {
  baseLimit: 'Límite base',
  carryYesterday: 'Arrastre ayer',
  spentToday: 'Gastado hoy',
  monthSpent: 'Gasto del mes',
  totalInvested: 'Total invertido',
  daysToClose: 'Días p/ cierre',
  cashBalance: 'Mi plata',
};

export default function Today({ goPact, openClose }: { goPact: () => void; openClose: () => void }) {
  const app = useApp();
  const [sheet, setSheet] = useState<null | { kind: 'expense' | 'income'; editing?: Expense | ExtraIncome }>(null);
  const [limitSheet, setLimitSheet] = useState(false);
  const [pendingDelete, confirmDelete] = useConfirm();

  const t = app.todayComp;
  // El número grande es lo que QUEDA hoy: disponible − gastado (= arrastre parcial).
  const available = t?.carry ?? 0;
  const yesterdayCarry = t ? t.available - t.baseLimit : 0;
  const cycle = app.currentCycle;
  const daysToClose = cycle ? diffDays(app.today, cycle.end) : 0;

  const statFor = (id: HomeStatId): { label: string; value: string; danger?: boolean } => {
    switch (id) {
      case 'baseLimit':
        return { label: HOME_STAT_LABELS[id], value: fmtMoney(t?.baseLimit ?? 0) };
      case 'carryYesterday':
        return { label: HOME_STAT_LABELS[id], value: fmtMoney(yesterdayCarry), danger: yesterdayCarry < 0 };
      case 'spentToday':
        return { label: HOME_STAT_LABELS[id], value: fmtMoney(t?.spent ?? 0) };
      case 'monthSpent':
        return { label: HOME_STAT_LABELS[id], value: fmtMoney(cycle?.totalSpent ?? 0) };
      case 'totalInvested':
        return { label: HOME_STAT_LABELS[id], value: fmtMoney(app.totalInvested) };
      case 'daysToClose':
        return { label: HOME_STAT_LABELS[id], value: String(daysToClose) };
      case 'cashBalance':
        return {
          label: HOME_STAT_LABELS[id],
          value: app.cashBalance === null ? '—' : fmtMoney(app.cashBalance),
          danger: app.cashBalance !== null && app.cashBalance < 0,
        };
    }
  };
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
        <p
          className={`my-1 text-6xl font-extrabold tabular-nums tracking-tight ${available < 0 ? 'text-red-500' : ''}`}
          style={available >= 0 ? { color: 'var(--accent)' } : undefined}
        >
          {fmtMoney(available)}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
          {app.settings.homeStats.slice(0, 3).map((id) => {
            const s = statFor(id);
            return (
              <div key={id}>
                <p className="text-slate-400">{s.label}</p>
                <p className={`font-semibold tabular-nums ${s.danger ? 'text-red-500' : ''}`}>{s.value}</p>
              </div>
            );
          })}
        </div>
        <button className="mt-2 min-h-[44px] text-sm text-slate-400" onClick={() => setLimitSheet(true)}>
          ✎ Ajustar límite de hoy{app.todayOverridden ? ' (ajustado)' : ''}
        </button>
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

      {/* Mi plata */}
      {app.settings.cash.enabled && <CashWidget />}
      {app.settings.cash.enabled && app.settings.cash.dailyReminder && <DailyReminderCard />}

      {/* Widgets configurables */}
      {app.settings.homeWidgets.monthBudget && cycle && <MonthBudgetWidget />}
      {app.settings.homeWidgets.daysToClose && cycle && (
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold">📆 Cierre del ciclo</p>
            <p className="text-xs text-slate-400">Termina el {fmtDateShort(cycle.end)}</p>
          </div>
          <p className="text-2xl font-extrabold tabular-nums">
            {daysToClose} {daysToClose === 1 ? 'día' : 'días'}
          </p>
        </Card>
      )}
      {app.settings.homeWidgets.weekChart && <WeekChartWidget />}

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
        style={{ backgroundColor: 'var(--accent)' }}
        className="fixed bottom-24 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-white shadow-xl active:brightness-90"
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

      {limitSheet && <TodayLimitSheet onClose={() => setLimitSheet(false)} />}
    </div>
  );
}

/** Ajuste del límite de SOLO hoy: no toca los demás días ni los Ajustes. */
function TodayLimitSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const current = app.todayComp?.baseLimit ?? 0;
  const [value, setValue] = useState(Math.round(current * 100) / 100);
  return (
    <Sheet open onClose={onClose} title="Límite de hoy">
      <p className="mb-3 text-sm text-slate-500">
        Cambia el límite base <strong>solo de hoy</strong> (día especial, viaje, etc.). Mañana vuelve al
        límite normal. Para cambiarlo todos los días, usa Ajustes → Presupuesto.
      </p>
      <Field label="Límite base de hoy (USD)">
        <NumberInput value={value} onChange={setValue} min={0} ariaLabel="Límite de hoy" />
      </Field>
      <div className="flex flex-col gap-2">
        <Button disabled={value < 0} onClick={async () => { await app.setTodayLimit(value); onClose(); }}>
          Guardar solo por hoy
        </Button>
        {app.todayOverridden && (
          <Button variant="secondary" onClick={async () => { await app.clearTodayLimit(); onClose(); }}>
            Restaurar límite calculado
          </Button>
        )}
      </div>
    </Sheet>
  );
}

/** Mi plata: saldo derivado, cuadre semanal y libro de movimientos. */
function CashWidget() {
  const app = useApp();
  const [sheet, setSheet] = useState<null | 'reconcile' | 'ledger' | 'deposit'>(null);
  const hasAnchor = app.cashBalance !== null;
  const patrimonio = (app.cashBalance ?? 0) + app.totalInvested;

  return (
    <>
      <Card className={app.cashReconcileDue ? 'border-l-4 border-amber-400' : ''}>
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">💰 Mi plata</p>
          {hasAnchor && (
            <p className={`text-2xl font-extrabold tabular-nums ${app.cashBalance! < 0 ? 'text-red-500' : ''}`}>
              {fmtMoney(app.cashBalance!)}
            </p>
          )}
        </div>
        {hasAnchor ? (
          <>
            <p className="mt-0.5 text-xs text-slate-400">
              + {fmtMoney(app.totalInvested)} invertido = <strong>{fmtMoney(patrimonio)}</strong> en total
            </p>
            {app.cashReconcileDue && (
              <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                📋 Toca hacer el cuadre semanal: ¿cuánto tienes de verdad?
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Button variant={app.cashReconcileDue ? 'primary' : 'secondary'} className="flex-1" onClick={() => setSheet('reconcile')}>
                Cuadrar
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setSheet('deposit')}>+ Depósito</Button>
              <Button variant="secondary" className="flex-1" onClick={() => setSheet('ledger')}>Movimientos</Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 mt-1 text-sm text-slate-500">
              Dime cuánto tienes hoy en tu cuenta y a partir de ahí llevo la contabilidad sola:
              gastos bajan, ingresos suben, inversiones pasan a Invertido.
            </p>
            <Button className="w-full" onClick={() => setSheet('reconcile')}>Poner mi saldo inicial</Button>
          </>
        )}
      </Card>
      {sheet === 'reconcile' && <CashReconcileSheet initial={!hasAnchor} onClose={() => setSheet(null)} />}
      {sheet === 'deposit' && <CashDepositSheet onClose={() => setSheet(null)} />}
      {sheet === 'ledger' && <CashLedgerSheet onClose={() => setSheet(null)} />}
    </>
  );
}

/** Cuadre: pregunta el pago del trabajo (si aplica) y el saldo real, y
 *  muestra la discrepancia contra lo calculado. */
function CashReconcileSheet({ initial, onClose }: { initial: boolean; onClose: () => void }) {
  const app = useApp();
  const cash = app.settings.cash;
  const [step, setStep] = useState<'salary' | 'balance' | 'done'>(
    !initial && cash.askSalary ? 'salary' : 'balance',
  );
  const [salary, setSalary] = useState(cash.weeklyPay ?? 0);
  const [real, setReal] = useState(app.cashBalance ?? 0);
  const [result, setResult] = useState<number | null>(null);

  const confirmBalance = async () => {
    const diff = await app.setCashBalance(real, initial ? 'Saldo inicial' : undefined);
    setResult(diff);
    setStep('done');
  };

  return (
    <Sheet open onClose={onClose} title={initial ? 'Mi saldo inicial' : 'Cuadre semanal'}>
      {step === 'salary' && (
        <>
          <p className="mb-3 text-sm text-slate-500">💼 ¿Te entró plata del trabajo desde el último cuadre?</p>
          <Field label="Monto (USD)">
            <NumberInput value={salary} onChange={setSalary} min={0} ariaLabel="Pago recibido" />
          </Field>
          <div className="flex flex-col gap-2">
            <Button disabled={salary <= 0} onClick={async () => { await app.addCashSalary(salary); setStep('balance'); }}>
              Sí, sumar {fmtMoney(salary)}
            </Button>
            <Button variant="secondary" onClick={() => setStep('balance')}>No / aún no</Button>
          </div>
        </>
      )}
      {step === 'balance' && (
        <>
          <p className="mb-1 text-sm text-slate-500">
            {initial
              ? '¿Cuánto tienes AHORA en tu cuenta (banco + efectivo)?'
              : '¿Cuánto tienes AHORA de verdad en tu cuenta?'}
          </p>
          {!initial && app.cashBalance !== null && (
            <p className="mb-2 text-xs text-slate-400">Según lo registrado deberías tener {fmtMoney(app.cashBalance)}.</p>
          )}
          <Field label="Saldo real (USD)">
            <NumberInput value={real} onChange={setReal} ariaLabel="Saldo real" />
          </Field>
          <Button className="w-full" onClick={confirmBalance}>Guardar</Button>
        </>
      )}
      {step === 'done' && result !== null && (
        <div className="text-center">
          {Math.abs(result) < 0.01 || initial ? (
            <>
              <p className="text-4xl" aria-hidden>✅</p>
              <p className="mt-2 font-semibold">{initial ? 'Listo, contabilidad activada.' : '¡Todo cuadra! Ni un centavo perdido.'}</p>
            </>
          ) : (
            <>
              <p className="text-4xl" aria-hidden>🤔</p>
              <p className="mt-2 font-semibold">
                Hay {fmtMoney(Math.abs(result))} {result < 0 ? 'menos' : 'más'} de lo registrado.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {result < 0
                  ? '¿Se te olvidó anotar algún gasto? Quedó registrado como diferencia en el cuadre; si lo recuerdas, anótalo como gasto para tu historial.'
                  : '¿Te entró plata que no anotaste? Quedó registrada como diferencia en el cuadre.'}
              </p>
            </>
          )}
          <Button className="mt-4 w-full" onClick={onClose}>Entendido</Button>
        </div>
      )}
    </Sheet>
  );
}

function CashDepositSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  return (
    <Sheet open onClose={onClose} title="Depósito o retiro">
      <div className="mb-3 flex gap-2">
        <ChipBtn selected={!withdraw} onClick={() => setWithdraw(false)}>⬆️ Me entró plata</ChipBtn>
        <ChipBtn selected={withdraw} onClick={() => setWithdraw(true)}>⬇️ Saqué plata</ChipBtn>
      </div>
      <Field label="Monto (USD)"><NumberInput value={amount} onChange={setAmount} min={0} ariaLabel="Monto del depósito" /></Field>
      <Field label="Nota (opcional)">
        <input className="w-full min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-base dark:border-slate-700 dark:bg-slate-800" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button className="w-full" disabled={amount <= 0}
        onClick={async () => { await app.addCashDeposit(withdraw ? -amount : amount, note.trim() || undefined); onClose(); }}>
        Guardar
      </Button>
    </Sheet>
  );
}

function ChipBtn({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      style={selected ? { backgroundColor: 'var(--accent)' } : undefined}
      className={`min-h-[44px] flex-1 rounded-full border-2 px-3 text-sm font-medium ${selected ? 'border-transparent text-white' : 'border-slate-300 dark:border-slate-700'}`}>
      {children}
    </button>
  );
}

function CashLedgerSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  return (
    <Sheet open onClose={onClose} title="Movimientos de Mi plata">
      <p className="mb-2 text-xs text-slate-400">Desde el último cuadre. Gastos e ingresos vienen de lo que registras; edítalos en Hoy o Historial.</p>
      {app.cashLedger.length === 0 ? (
        <EmptyState emoji="🏦" text="Sin movimientos todavía." />
      ) : (
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {app.cashLedger.map((r, i) => (
            <li key={i} className="flex items-center gap-2 py-2">
              <span aria-hidden>{r.emoji}</span>
              <div className="flex-1">
                <p>{r.label}</p>
                <p className="text-xs text-slate-400">{new Date(r.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                {r.diff !== undefined && Math.abs(r.diff) >= 0.01 && (
                  <p className={`text-xs ${r.diff < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    diferencia {fmtMoney(r.diff)} sin registrar
                  </p>
                )}
              </div>
              <div className="text-right">
                {r.delta !== null && (
                  <p className={`font-semibold tabular-nums ${r.delta < 0 ? '' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {r.delta >= 0 ? '+' : ''}{fmtMoney(r.delta)}
                  </p>
                )}
                <p className="text-xs tabular-nums text-slate-400">= {fmtMoney(r.balanceAfter)}</p>
              </div>
              {r.eventId && (
                <button aria-label="Borrar movimiento" className="flex h-11 w-9 items-center justify-center text-slate-300 dark:text-slate-600"
                  onClick={() => app.deleteCashEvent(r.eventId!)}>✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/** Recordatorio diario: si ayer no anotaste nada, pregunta al abrir la app. */
function DailyReminderCard() {
  const app = useApp();
  const key = 'mfi-reminder-dismissed';
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === app.today; } catch { return false; }
  });
  if (dismissed || !app.yesterdayEmpty) return null;
  const dismiss = () => {
    try { localStorage.setItem(key, app.today); } catch { /* sin localStorage, se repite y ya */ }
    setDismissed(true);
  };
  return (
    <Card className="flex items-center gap-3 border-l-4 border-blue-400">
      <span className="text-2xl" aria-hidden>🔔</span>
      <p className="flex-1 text-sm">Ayer no anotaste ningún movimiento. ¿Se te pasó algún gasto?</p>
      <Button variant="secondary" onClick={dismiss}>No gasté</Button>
    </Card>
  );
}

/** Gasto del ciclo vs presupuesto total del ciclo. */
function MonthBudgetWidget() {
  const app = useApp();
  const cycle = app.currentCycle!;
  const budget = useMemo(() => {
    // Presupuesto = límites de los días transcurridos + límite de hoy × días restantes.
    const spent = cycle.days.reduce((s, d) => s + d.baseLimit, 0);
    const todayLimit = app.todayComp?.baseLimit ?? 0;
    const remaining = Math.max(0, diffDays(app.today, cycle.end));
    return spent + todayLimit * remaining;
  }, [cycle, app.todayComp, app.today]);
  const pct = budget > 0 ? (cycle.totalSpent / budget) * 100 : 0;
  return (
    <Card>
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="font-semibold">💵 Gasto del mes</p>
        <p className="text-sm tabular-nums text-slate-500">
          {fmtMoney(cycle.totalSpent)} de {fmtMoney(budget)}
        </p>
      </div>
      <ProgressBar pct={pct} {...(pct > 100 ? { color: '#ef4444' } : {})} />
      <p className="mt-1 text-xs text-slate-400">
        {pct <= 100 ? `Vas por el ${Math.round(pct)}% del presupuesto del ciclo.` : '⚠️ Ya pasaste el presupuesto del ciclo.'}
      </p>
    </Card>
  );
}

/** Mini-gráfico: gastado en los últimos 7 días (verde = bajo el límite). */
function WeekChartWidget() {
  const app = useApp();
  const data = useMemo(() => {
    const all = app.cycles.flatMap((c) => c.days);
    return all.slice(-7).map((d) => ({
      day: fmtDateShort(d.date).split(' ')[0],
      gastado: Math.round(d.spent * 100) / 100,
      ok: d.carry >= 0,
    }));
  }, [app.cycles]);
  if (data.length < 2) return null;
  return (
    <Card>
      <p className="mb-1 font-semibold">📊 Últimos 7 días</p>
      <div className="h-24">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => fmtMoney(v)} />
            <Bar dataKey="gastado" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.ok ? 'var(--accent)' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
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
