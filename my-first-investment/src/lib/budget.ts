// Lógica de límite diario, disponible y arrastre — sección 7.1 y 7.2.
// Funciones puras: reciben datos, devuelven cálculos, sin tocar la BD.

import type { Settings, Expense, ExtraIncome, DaySnapshot } from './types';
import { cycleStartFor, cycleEndFor, daysInCycle, diffDays, rangeDays } from './dates';

/** limiteBase = (salario − metaAhorro + ajusteArrastreAnterior) / diasDelCiclo */
export function baseDailyLimit(
  salary: number,
  savingsGoal: number,
  days: number,
  prevCarryAdjust = 0,
): number {
  return (salary - savingsGoal + prevCarryAdjust) / days;
}

export type DayComputation = {
  date: string;
  baseLimit: number;
  spent: number;
  available: number; // disponible = limiteBase + arrastre de ayer
  carry: number; // arrastre = disponible − gastado (puede ser negativo)
};

export type CycleInput = {
  settings: Pick<Settings, 'salary' | 'savingsGoal' | 'cycleStartDay' | 'extraIncomeMode' | 'negativeCarryMode'>;
  /** Arrastre negativo del ciclo anterior (número ≤ 0 o 0) ya resuelto según negativeCarryMode. */
  prevCarryAdjust?: number;
  expenses: Pick<Expense, 'date' | 'amount'>[];
  extraIncomes: Pick<ExtraIncome, 'date' | 'amount'>[];
  /** Snapshots de límites de días pasados (cambios de parámetros a mitad de ciclo). */
  snapshots?: Pick<DaySnapshot, 'date' | 'baseLimit'>[];
  /** Los días anteriores a esta fecha no existen para el usuario (inicio del
   *  pacto a mitad de ciclo): no generan arrastre ni aparecen en el resultado. */
  accrualStart?: string;
};

/**
 * Calcula día a día un ciclo completo: límite base, gastado, disponible y arrastre.
 * `upToDate` limita el cálculo (típicamente hoy); si se omite, calcula el ciclo entero.
 */
export function computeCycle(
  anyDateInCycle: string,
  input: CycleInput,
  upToDate?: string,
): DayComputation[] {
  const { settings } = input;
  const start = cycleStartFor(anyDateInCycle, settings.cycleStartDay);
  const end = cycleEndFor(anyDateInCycle, settings.cycleStartDay);
  const totalDays = daysInCycle(anyDateInCycle, settings.cycleStartDay);
  const last = upToDate && upToDate < end ? upToDate : end;
  if (last < start) return [];

  const spentByDay = new Map<string, number>();
  for (const e of input.expenses) {
    if (e.date >= start && e.date <= end) {
      spentByDay.set(e.date, (spentByDay.get(e.date) ?? 0) + e.amount);
    }
  }
  const snapByDay = new Map<string, number>();
  for (const s of input.snapshots ?? []) snapByDay.set(s.date, s.baseLimit);

  // Ingresos extra en modo 'available' suben el límite de los días restantes.
  const incomeBoosts: { fromDate: string; perDay: number }[] = [];
  if (settings.extraIncomeMode === 'available') {
    for (const inc of input.extraIncomes) {
      if (inc.date >= start && inc.date <= end) {
        const remaining = diffDays(inc.date, end) + 1;
        incomeBoosts.push({ fromDate: inc.date, perDay: inc.amount / remaining });
      }
    }
  }

  // Precisión completa internamente; el redondeo es solo de presentación.
  const base = baseDailyLimit(settings.salary, settings.savingsGoal, totalDays, input.prevCarryAdjust ?? 0);
  const out: DayComputation[] = [];
  let carry = 0; // el arrastre del primer día del ciclo es 0
  const firstDay = input.accrualStart && input.accrualStart > start ? input.accrualStart : start;
  if (firstDay > last) return [];
  for (const date of rangeDays(firstDay, last)) {
    const baseLimit = snapByDay.get(date) ?? base + incomeBoosts
      .filter((b) => date >= b.fromDate)
      .reduce((s, b) => s + b.perDay, 0);
    const spent = spentByDay.get(date) ?? 0;
    const available = baseLimit + carry;
    const dayCarry = available - spent;
    out.push({ date, baseLimit, spent, available, carry: dayCarry });
    carry = dayCarry;
  }
  return out;
}

/** Sugerencia de inversión al cierre — sección 7.3. */
export function closeSuggestion(
  finalCarry: number,
  totalExtraIncome: number,
  settings: Pick<Settings, 'savingsGoal' | 'extraIncomeMode' | 'suggestionIncludes'>,
): number {
  const inc = settings.suggestionIncludes;
  return round2(
    (inc.positiveCarry ? Math.max(finalCarry, 0) : 0) +
      (inc.extraIncome && settings.extraIncomeMode === 'invest' ? totalExtraIncome : 0) +
      (inc.savingsGoal ? settings.savingsGoal : 0),
  );
}

/** Ajuste de arrastre para el ciclo siguiente según configuración. */
export function carryToNextCycle(
  finalCarry: number,
  negativeCarryMode: Settings['negativeCarryMode'],
): number {
  if (finalCarry >= 0) return 0; // lo positivo se sugiere invertir, no se arrastra
  return negativeCarryMode === 'deduct' ? finalCarry : 0;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
