// Resumen semanal — sección 7.6.

import type { WeeklySummaryData, Expense, Category, Settings } from './types';
import type { DayComputation } from './budget';
import { closeSuggestion, round2 } from './budget';

export type WeeklyInput = {
  /** Cálculo día a día de la semana resumida (7 días terminados). */
  weekDays: DayComputation[];
  /** Gastos de la semana, para categoría principal. */
  weekExpenses: Pick<Expense, 'amount' | 'categoryId'>[];
  categories: Pick<Category, 'id' | 'name' | 'emoji'>[];
  /** Gastado la semana anterior a la resumida (para % de cambio), o null. */
  prevWeekSpent: number | null;
  /** Estado del ciclo actual al momento de generar. */
  cycle: {
    currentCarry: number;
    baseLimit: number;
    daysRemaining: number;
    avgDailySpend: number;
    totalExtraIncome: number;
  };
  settings: Pick<Settings, 'savingsGoal' | 'extraIncomeMode' | 'suggestionIncludes'>;
};

export function buildWeeklySummary(input: WeeklyInput): WeeklySummaryData {
  const spent = round2(input.weekDays.reduce((s, d) => s + d.spent, 0));
  const weekLimit = round2(input.weekDays.reduce((s, d) => s + d.baseLimit, 0));
  const difference = round2(weekLimit - spent);
  const daysUnderLimit = input.weekDays.filter((d) => d.carry >= 0).length;

  const byCat = new Map<string, number>();
  for (const e of input.weekExpenses) byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + e.amount);
  let topCategory: WeeklySummaryData['topCategory'] = null;
  if (spent > 0 && byCat.size > 0) {
    const [topId, topAmt] = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
    const cat = input.categories.find((c) => c.id === topId);
    topCategory = {
      name: cat?.name ?? 'Otros',
      emoji: cat?.emoji ?? '📦',
      pct: Math.round((topAmt / spent) * 100),
    };
  }

  const vsPrevWeekPct =
    input.prevWeekSpent === null || input.prevWeekSpent === 0
      ? null
      : Math.round(((spent - input.prevWeekSpent) / input.prevWeekSpent) * 100);

  // Proyección: arrastre actual + (límite base × días restantes) − (promedio diario × días restantes)
  const { currentCarry, baseLimit, daysRemaining, avgDailySpend, totalExtraIncome } = input.cycle;
  const projectedCarry = round2(currentCarry + baseLimit * daysRemaining - avgDailySpend * daysRemaining);
  const projectedInvestment = closeSuggestion(projectedCarry, totalExtraIncome, input.settings);

  return { spent, weekLimit, difference, topCategory, daysUnderLimit, vsPrevWeekPct, projectedCarry, projectedInvestment };
}
