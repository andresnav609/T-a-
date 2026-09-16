// Calculadora de inversiones — secciones 8.4 y 9.
// Implementada por SIMULACIÓN período a período para soportar frecuencias
// mixtas, momento del aporte y crecimiento anual del aporte.

export type ContributionFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type Compounding = 'daily' | 'monthly' | 'quarterly' | 'yearly';

export const CONTRIBUTIONS_PER_YEAR: Record<ContributionFrequency, number> = {
  daily: 365,
  weekly: 52,
  biweekly: 26,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

export const COMPOUNDINGS_PER_YEAR: Record<Compounding, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

export type ProjectionInput = {
  principal: number;
  contribution: number;
  contributionFreq: ContributionFrequency;
  years: number;
  annualRatePct: number;
  compounding: Compounding;
  timing: 'end' | 'begin';
  inflationPct?: number; // solo afecta valor real
  contributionGrowthPct?: number; // crecimiento anual del aporte
};

export type YearRow = {
  year: number;
  contributed: number; // acumulado aportado (incluye inicial)
  interest: number; // acumulado de intereses
  value: number;
};

export type ProjectionResult = {
  finalValue: number;
  totalContributed: number;
  totalInterest: number;
  multiplier: number;
  realValue: number | null;
  yearly: YearRow[];
};

/**
 * Simula al ritmo de los aportes (k períodos/año) usando la tasa efectiva
 * por período de aporte: (1 + r)^(m/k) − 1, con r = tasaAnual/m.
 */
export function project(input: ProjectionInput): ProjectionResult {
  const k = CONTRIBUTIONS_PER_YEAR[input.contributionFreq];
  const m = COMPOUNDINGS_PER_YEAR[input.compounding];
  const r = input.annualRatePct / 100 / m;
  const ratePerPeriod = Math.pow(1 + r, m / k) - 1;
  const totalPeriods = Math.round(input.years * k);
  const growth = (input.contributionGrowthPct ?? 0) / 100;

  let value = input.principal;
  let contributed = input.principal;
  let contribution = input.contribution;
  const yearly: YearRow[] = [];

  for (let p = 1; p <= totalPeriods; p++) {
    if (input.timing === 'begin') {
      value += contribution;
      contributed += contribution;
      value *= 1 + ratePerPeriod;
    } else {
      value *= 1 + ratePerPeriod;
      value += contribution;
      contributed += contribution;
    }
    if (p % k === 0) {
      const year = p / k;
      yearly.push({
        year,
        contributed: round2(contributed),
        interest: round2(value - contributed),
        value: round2(value),
      });
      contribution *= 1 + growth; // el aporte crece una vez al año
    }
  }
  // años fraccionales: agrega la última fila si no cayó exacta
  if (totalPeriods % k !== 0) {
    yearly.push({
      year: totalPeriods / k,
      contributed: round2(contributed),
      interest: round2(value - contributed),
      value: round2(value),
    });
  }

  const finalValue = round2(value);
  const totalContributed = round2(contributed);
  const inflation = input.inflationPct;
  return {
    finalValue,
    totalContributed,
    totalInterest: round2(finalValue - totalContributed),
    multiplier: totalContributed > 0 ? round2(finalValue / totalContributed) : 0,
    realValue:
      inflation !== undefined ? round2(finalValue / Math.pow(1 + inflation / 100, input.years)) : null,
    yearly,
  };
}

/** Modo C: aporte necesario por período para llegar a `goal`. */
export function requiredContribution(
  goal: number,
  base: Omit<ProjectionInput, 'contribution'>,
): number {
  const zero = project({ ...base, contribution: 0 });
  if (zero.finalValue >= goal) return 0; // meta ya alcanzada
  // Búsqueda binaria sobre el aporte (la proyección es monótona en el aporte).
  let lo = 0;
  let hi = Math.max(goal, 1);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = project({ ...base, contribution: mid }).finalValue;
    if (v < goal) lo = mid;
    else hi = mid;
  }
  return round2(hi);
}

/** Modo C inverso: años hasta la meta con un aporte dado. null = más de 100 años. */
export function yearsToGoal(
  goal: number,
  input: Omit<ProjectionInput, 'years'>,
): number | null {
  const k = CONTRIBUTIONS_PER_YEAR[input.contributionFreq];
  const m = COMPOUNDINGS_PER_YEAR[input.compounding];
  const r = input.annualRatePct / 100 / m;
  const ratePerPeriod = Math.pow(1 + r, m / k) - 1;
  const growth = (input.contributionGrowthPct ?? 0) / 100;
  let value = input.principal;
  let contribution = input.contribution;
  if (value >= goal) return 0;
  for (let p = 1; p <= 100 * k; p++) {
    if (input.timing === 'begin') {
      value += contribution;
      value *= 1 + ratePerPeriod;
    } else {
      value *= 1 + ratePerPeriod;
      value += contribution;
    }
    if (p % k === 0) contribution *= 1 + growth;
    if (value >= goal) return Math.round((p / k) * 10) / 10;
  }
  return null;
}

// Fórmulas cerradas — solo para verificación en tests (sección 9).
export function closedFormFV(P: number, A: number, annualRatePct: number, years: number, m = 12): number {
  const r = annualRatePct / 100 / m;
  const n = years * m;
  if (r === 0) return P + A * n;
  return P * Math.pow(1 + r, n) + A * ((Math.pow(1 + r, n) - 1) / r);
}

export function closedFormContribution(goal: number, P: number, annualRatePct: number, years: number, m = 12): number {
  const r = annualRatePct / 100 / m;
  const n = years * m;
  if (r === 0) return (goal - P) / n;
  return ((goal - P * Math.pow(1 + r, n)) * r) / (Math.pow(1 + r, n) - 1);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
