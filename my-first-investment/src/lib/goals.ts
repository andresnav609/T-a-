// Metas — sección 7.7.

import type { Goal } from './types';

export type GoalContext = {
  totalInvested: number;
  currentCarry: number; // arrastre actual del ciclo
  savingsGoal: number;
  currentStreak: number;
  /** Aportes del compañero (último snapshot) para metas compartidas. */
  partnerTotalInvested?: number;
};

export function goalProgress(goal: Goal, ctx: GoalContext): { value: number; pct: number } {
  let value = 0;
  switch (goal.type) {
    case 'total_invested':
      value = ctx.totalInvested + (goal.shared ? ctx.partnerTotalInvested ?? 0 : 0);
      break;
    case 'monthly_savings':
      value = Math.max(ctx.currentCarry, 0) + ctx.savingsGoal;
      break;
    case 'streak':
      value = ctx.currentStreak;
      break;
    case 'custom':
      value = goal.manualProgress ?? 0;
      break;
  }
  const pct = goal.target > 0 ? Math.min((value / goal.target) * 100, 100) : 0;
  return { value, pct: Math.round(pct * 10) / 10 };
}

/** Meses estimados hasta lograr una meta de inversión con aporte mensual y tasa anual. */
export function monthsToInvestmentGoal(
  current: number,
  target: number,
  monthlyContribution: number,
  annualRatePct: number,
): number | null {
  if (current >= target) return 0;
  const r = annualRatePct / 100 / 12;
  let value = current;
  for (let m = 1; m <= 1200; m++) {
    value = value * (1 + r) + monthlyContribution;
    if (value >= target) return m;
  }
  return null; // más de 100 años
}
