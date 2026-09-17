// "Mi plata": contabilidad de la cuenta única de efectivo/banco.
// El saldo se DERIVA de lo que ya registras (gastos, ingresos, inversiones)
// a partir del último cuadre ('set'), que actúa como ancla. Así todo queda
// balanceado sin anotar nada dos veces: si inviertes $5, tu plata baja $5.

import type { CashEvent, Expense, ExtraIncome, Investment } from './types';
import { addDays } from './dates';

export type LedgerRow = {
  at: string; // ISO datetime
  label: string;
  emoji: string;
  delta: number | null; // null para el ancla (saldo fijado)
  balanceAfter: number;
  /** id del CashEvent si la fila es borrable (deposit/salary). */
  eventId?: string;
  diff?: number; // en cuadres: lo no registrado
};

export type CashInput = {
  events: CashEvent[];
  expenses: Pick<Expense, 'amount' | 'createdAt' | 'note'>[];
  extraIncomes: Pick<ExtraIncome, 'amount' | 'createdAt' | 'note'>[];
  investments: Pick<Investment, 'amount' | 'date' | 'createdAt' | 'source'>[];
};

function investmentTime(i: Pick<Investment, 'date' | 'createdAt'>): string {
  return i.createdAt ?? `${i.date}T12:00:00`;
}

/** Saldo actual: último 'set' + todos los flujos posteriores a él. */
export function computeCashBalance(input: CashInput): number | null {
  const anchor = latestSet(input.events);
  if (!anchor) return null;
  let balance = anchor.amount;
  for (const e of input.events) {
    if (e.kind !== 'set' && e.at > anchor.at) balance += e.amount;
  }
  for (const x of input.expenses) if (x.createdAt > anchor.at) balance -= x.amount;
  for (const x of input.extraIncomes) if (x.createdAt > anchor.at) balance += x.amount;
  for (const x of input.investments) if (investmentTime(x) > anchor.at) balance -= x.amount;
  return round2(balance);
}

export function latestSet(events: CashEvent[]): CashEvent | null {
  const sets = events.filter((e) => e.kind === 'set');
  if (sets.length === 0) return null;
  return sets.reduce((a, b) => (a.at > b.at ? a : b));
}

/** Libro de movimientos desde el último cuadre, más reciente primero. */
export function buildLedger(input: CashInput): LedgerRow[] {
  const anchor = latestSet(input.events);
  if (!anchor) return [];
  type Flow = { at: string; label: string; emoji: string; delta: number; eventId?: string };
  const flows: Flow[] = [];
  for (const e of input.events) {
    if (e.kind === 'set' || e.at <= anchor.at) continue;
    flows.push({
      at: e.at,
      label: e.kind === 'salary' ? (e.note ?? 'Pago del trabajo') : e.note ?? (e.amount >= 0 ? 'Depósito' : 'Retiro'),
      emoji: e.kind === 'salary' ? '💼' : e.amount >= 0 ? '⬆️' : '⬇️',
      delta: e.amount,
      eventId: e.id,
    });
  }
  for (const x of input.expenses) {
    if (x.createdAt > anchor.at) flows.push({ at: x.createdAt, label: x.note || 'Gasto', emoji: '🛒', delta: -x.amount });
  }
  for (const x of input.extraIncomes) {
    if (x.createdAt > anchor.at) flows.push({ at: x.createdAt, label: x.note || 'Ingreso extra', emoji: '💵', delta: x.amount });
  }
  for (const x of input.investments) {
    const t = investmentTime(x);
    if (t > anchor.at) flows.push({ at: t, label: x.source === 'monthly_close' ? 'Inversión (cierre de mes)' : 'Inversión', emoji: '📈', delta: -x.amount });
  }
  flows.sort((a, b) => a.at.localeCompare(b.at));
  let balance = anchor.amount;
  const rows: LedgerRow[] = [{
    at: anchor.at,
    label: anchor.diff !== undefined && Math.abs(anchor.diff) >= 0.01 ? 'Cuadre (saldo real)' : anchor.note ?? 'Saldo fijado',
    emoji: '🏦',
    delta: null,
    balanceAfter: round2(anchor.amount),
    diff: anchor.diff,
  }];
  for (const f of flows) {
    balance += f.delta;
    rows.push({ at: f.at, label: f.label, emoji: f.emoji, delta: round2(f.delta), balanceAfter: round2(balance), eventId: f.eventId });
  }
  return rows.reverse();
}

/** Diferencia de un cuadre: lo que hay de verdad − lo que dice la app.
 *  Negativa = gastaste plata sin anotarla. */
export function reconcileDiff(realBalance: number, computedBalance: number): number {
  return round2(realBalance - computedBalance);
}

/** Fecha (YYYY-MM-DD) del último día de cuadre vencido: la ocurrencia más
 *  reciente de `reconcileDay` que sea ≤ hoy. */
export function lastDueReconcileDate(todayISO: string, reconcileDay: number): string {
  const d = new Date(todayISO + 'T00:00');
  const back = (d.getDay() - reconcileDay + 7) % 7;
  return addDays(todayISO, -back);
}

/** true si toca cuadrar: ya pasó (o es) el día de cuadre y el último 'set'
 *  es anterior a esa fecha. */
export function reconcileIsDue(todayISO: string, reconcileDay: number, events: CashEvent[]): boolean {
  const anchor = latestSet(events);
  if (!anchor) return false;
  const due = lastDueReconcileDate(todayISO, reconcileDay);
  return anchor.at.slice(0, 10) < due;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
