// Historial multiciclo: encadena computeCycle desde el inicio del pacto
// hasta hoy, resolviendo el arrastre negativo entre ciclos.

import type { Settings, Expense, ExtraIncome, DaySnapshot, MonthClose } from './types';
import { computeCycle, carryToNextCycle, type DayComputation } from './budget';
import { cycleStartFor, cycleEndFor, addDays } from './dates';

export type CycleSummary = {
  start: string;
  end: string;
  days: DayComputation[];
  finalCarry: number; // arrastre del último día calculado
  totalSpent: number;
  totalExtraIncome: number;
  isCurrent: boolean;
  close?: MonthClose;
};

export type HistoryInput = {
  pactStartDate: string;
  today: string;
  settings: Settings;
  expenses: Expense[];
  extraIncomes: ExtraIncome[];
  daySnapshots: DaySnapshot[];
  monthCloses: MonthClose[];
};

export function computeHistory(input: HistoryInput): CycleSummary[] {
  const { settings, today } = input;
  const cycles: CycleSummary[] = [];
  let cursor = cycleStartFor(input.pactStartDate, settings.cycleStartDay);
  let prevAdjust = 0;
  // Límite de seguridad: 10 años de ciclos.
  for (let i = 0; i < 120 && cursor <= today; i++) {
    const end = cycleEndFor(cursor, settings.cycleStartDay);
    const isCurrent = today >= cursor && today <= end;
    const close = input.monthCloses.find((m) => m.cycleStart === cursor);
    const days = computeCycle(cursor, {
      settings,
      prevCarryAdjust: prevAdjust,
      expenses: input.expenses,
      extraIncomes: input.extraIncomes,
      snapshots: input.daySnapshots,
      // El primer ciclo puede empezar a mitad: antes del pacto no hay arrastre.
      accrualStart: input.pactStartDate,
    }, isCurrent ? today : undefined);
    const finalCarry = days.length ? days[days.length - 1].carry : 0;
    const totalSpent = days.reduce((s, d) => s + d.spent, 0);
    const totalExtraIncome = input.extraIncomes
      .filter((e) => e.date >= cursor && e.date <= end)
      .reduce((s, e) => s + e.amount, 0);
    cycles.push({ start: cursor, end, days, finalCarry, totalSpent, totalExtraIncome, isCurrent, close });
    // Ajuste para el ciclo siguiente: lo registrado en el cierre, o lo calculado.
    prevAdjust = close ? close.carryToNextCycle : carryToNextCycle(finalCarry, settings.negativeCarryMode);
    cursor = addDays(end, 1);
  }
  return cycles;
}

/** Días TERMINADOS (fecha < hoy y >= inicio del pacto), para la racha. */
export function finishedDays(cycles: CycleSummary[], pactStartDate: string, today: string): DayComputation[] {
  const out: DayComputation[] = [];
  for (const c of cycles) {
    for (const d of c.days) {
      if (d.date >= pactStartDate && d.date < today) out.push(d);
    }
  }
  return out;
}
