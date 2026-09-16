// Tests obligatorios — sección 11 de la spec.
import { describe, it, expect } from 'vitest';
import { baseDailyLimit, computeCycle, closeSuggestion } from './budget';
import { computeStreak } from './streak';
import { buildWeeklySummary } from './weekly';
import { goalProgress } from './goals';
import { project, requiredContribution, yearsToGoal } from './investment';
import { buildProgressCard, parseProgressCard } from './share';
import { cycleStartFor, cycleEndFor, daysInCycle, prevWeekRange } from './dates';
import type { Goal, Profile, PrivacySettings, WeeklySummaryData } from './types';

// Ciclo de 30 días: septiembre (1–30) con inicio de ciclo el día 1.
const SETTINGS = {
  salary: 850,
  savingsGoal: 300,
  cycleStartDay: 1,
  extraIncomeMode: 'invest' as const,
  negativeCarryMode: 'deduct' as const,
  suggestionIncludes: { positiveCarry: true, extraIncome: true, savingsGoal: true },
};

describe('límite diario (7.1)', () => {
  it('salario 850, meta 300, ciclo 30 días → 18.33', () => {
    expect(baseDailyLimit(850, 300, 30)).toBeCloseTo(18.33, 2);
  });
});

describe('arrastre (7.2)', () => {
  it('día 1 gasta 10 → arrastre 8.33; disponible día 2 = 26.67', () => {
    const days = computeCycle('2025-09-01', {
      settings: SETTINGS,
      expenses: [{ date: '2025-09-01', amount: 10 }],
      extraIncomes: [],
    }, '2025-09-02');
    expect(days[0].carry).toBeCloseTo(8.33, 2);
    expect(days[1].available).toBeCloseTo(26.67, 2);
  });

  it('día 1 gasta 25 → arrastre −6.67; disponible día 2 = 11.67', () => {
    const days = computeCycle('2025-09-01', {
      settings: SETTINGS,
      expenses: [{ date: '2025-09-01', amount: 25 }],
      extraIncomes: [],
    }, '2025-09-02');
    expect(days[0].carry).toBeCloseTo(-6.67, 2);
    expect(days[1].available).toBeCloseTo(11.67, 2);
  });

  it('los días anteriores al inicio del pacto no generan arrastre', () => {
    const days = computeCycle('2025-09-01', {
      settings: SETTINGS,
      expenses: [],
      extraIncomes: [],
      accrualStart: '2025-09-16',
    }, '2025-09-16');
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe('2025-09-16');
    expect(days[0].available).toBeCloseTo(18.33, 2);
  });

  it('días sin gastos generan arrastre completo', () => {
    const days = computeCycle('2025-09-01', { settings: SETTINGS, expenses: [], extraIncomes: [] }, '2025-09-03');
    expect(days[2].carry).toBeCloseTo(55, 1); // 3 × 18.333
  });
});

describe('sugerencia de cierre (7.3)', () => {
  it('arrastre 45, extra 100 (invest), meta 300, todo incluido → 445', () => {
    expect(closeSuggestion(45, 100, SETTINGS)).toBe(445);
  });

  it('arrastre −20, extra 0, meta 300 → 300', () => {
    expect(closeSuggestion(-20, 0, SETTINGS)).toBe(300);
  });
});

describe('racha (7.5)', () => {
  const day = (i: number, carry: number) => ({ date: `2025-09-${String(i).padStart(2, '0')}`, carry });

  it('5 días ≥ 0, 1 negativo, 2 ≥ 0 → actual 2, mejor 5', () => {
    const days = [day(1, 5), day(2, 3), day(3, 0), day(4, 8), day(5, 2), day(6, -4), day(7, 1), day(8, 6)];
    const r = computeStreak(days);
    expect(r.current).toBe(2);
    expect(r.best).toBe(5);
  });

  it('hoy en negativo, ayer y anteayer ≥ 0 → actual 2 + aviso en riesgo', () => {
    const r = computeStreak([day(1, 3), day(2, 1)], -5);
    expect(r.current).toBe(2);
    expect(r.atRisk).toBe(true);
  });
});

describe('resumen semanal (7.6)', () => {
  it('gastos 7 días = 100, límite 18.33/día → diferencia 28.33', () => {
    const weekDays = computeCycle('2025-09-01', {
      settings: SETTINGS,
      expenses: [
        { date: '2025-09-01', amount: 20 },
        { date: '2025-09-03', amount: 20 },
        { date: '2025-09-05', amount: 60 },
      ],
      extraIncomes: [],
    }, '2025-09-07');
    const data = buildWeeklySummary({
      weekDays,
      weekExpenses: [
        { amount: 20, categoryId: 'c1' },
        { amount: 20, categoryId: 'c1' },
        { amount: 60, categoryId: 'c2' },
      ],
      categories: [
        { id: 'c1', name: 'Comida', emoji: '🍽️' },
        { id: 'c2', name: 'Salidas', emoji: '🎉' },
      ],
      prevWeekSpent: null,
      cycle: { currentCarry: 28.33, baseLimit: 18.33, daysRemaining: 23, avgDailySpend: 14.29, totalExtraIncome: 0 },
      settings: SETTINGS,
    });
    expect(data.spent).toBe(100);
    expect(data.difference).toBeCloseTo(28.33, 2);
    // Días bajo el límite: día 1 (gasto 20, arrastre −1.67) y día 5 (gasto 50,
    // arrastre −8.33) quedan en negativo → 5 de 7.
    expect(data.daysUnderLimit).toBe(5);
    expect(data.topCategory?.name).toBe('Salidas');
    expect(data.topCategory?.pct).toBe(60);
  });
});

describe('metas (7.7)', () => {
  const ctx = { totalInvested: 750, currentCarry: 0, savingsGoal: 300, currentStreak: 10 };
  const goal = (over: Partial<Goal>): Goal => ({
    id: 'g', userId: 'u', type: 'total_invested', name: 'Meta', target: 1000,
    shared: false, status: 'active', createdAt: '2025-01-01', ...over,
  });

  it('invertido 750, target 1,000 → 75%', () => {
    expect(goalProgress(goal({}), ctx).pct).toBe(75);
  });

  it('compartida: tú 750, compañero 500, target 2,000 → 62.5%', () => {
    const g = goal({ shared: true, target: 2000 });
    expect(goalProgress(g, { ...ctx, partnerTotalInvested: 500 }).pct).toBe(62.5);
  });
});

describe('calculadora (9)', () => {
  const base = {
    principal: 1000,
    contributionFreq: 'monthly' as const,
    compounding: 'monthly' as const,
    timing: 'end' as const,
  };

  it('P 1,000; A 152.08 mensual; 10%; 20 años → ≈ 122,800 (±100)', () => {
    const r = project({ ...base, contribution: 152.08, years: 20, annualRatePct: 10 });
    expect(Math.abs(r.finalValue - 122800)).toBeLessThanOrEqual(100);
  });

  it('comparar: 8% ≈ 94,500 y 15% ≈ 247,400 (±150)', () => {
    const r8 = project({ ...base, contribution: 152.08, years: 20, annualRatePct: 8 });
    const r15 = project({ ...base, contribution: 152.08, years: 20, annualRatePct: 15 });
    expect(Math.abs(r8.finalValue - 94500)).toBeLessThanOrEqual(150);
    expect(Math.abs(r15.finalValue - 247400)).toBeLessThanOrEqual(150);
  });

  it('tasa 0%: P 1,000; A 100 mensual; 10 años → 13,000', () => {
    const r = project({ ...base, contribution: 100, years: 10, annualRatePct: 0 });
    expect(r.finalValue).toBeCloseTo(13000, 0);
  });

  it('meta 100,000; P 1,000; 10%; 20 años → aporte ≈ 123/mes', () => {
    const a = requiredContribution(100000, { ...base, years: 20, annualRatePct: 10 });
    expect(Math.abs(a - 123)).toBeLessThanOrEqual(2);
  });

  it('meta ya alcanzada → aporte 0', () => {
    expect(requiredContribution(500, { ...base, years: 10, annualRatePct: 10 })).toBe(0);
  });

  it('meta inalcanzable en modo inverso → null (más de 100 años)', () => {
    expect(yearsToGoal(1e12, { ...base, contribution: 1, annualRatePct: 0 })).toBeNull();
  });
});

describe('privacidad de la tarjeta (4.3)', () => {
  const profile: Profile = {
    id: 'u1', name: 'Andrés', emoji: '🚀', color: '#10b981',
    pactStartDate: '2025-09-01', createdAt: '2025-09-01T00:00:00Z',
  };
  const privacy: PrivacySettings = {
    streak: true, savingsPct: true, totalInvested: true, goals: true,
    weekly: true, amounts: false, expenses: false,
  };
  const weekly: WeeklySummaryData = {
    spent: 123.45, weekLimit: 128.33, difference: 4.88, topCategory: { name: 'Comida', emoji: '🍽️', pct: 40 },
    daysUnderLimit: 5, vsPrevWeekPct: -10, projectedCarry: 50, projectedInvestment: 350,
  };

  it('amounts = false → el snapshot no contiene salario ni montos de gasto', () => {
    const card = buildProgressCard({
      profile, privacy,
      streak: { current: 4, best: 9 },
      savingsPct: 80,
      totalInvested: 750,
      monthlyInvestAvg: 250,
      goals: [],
      goalProgressPct: () => 0,
      weekly,
    });
    const json = JSON.stringify(card);
    expect(json).not.toContain('salary');
    expect(json).not.toContain('123.45'); // gastado de la semana no viaja
    expect(card.data.weekly?.spent).toBe(0);
    expect(card.data.weekly?.daysUnderLimit).toBe(5); // lo relativo sí viaja
    // La firma valida el viaje de ida y vuelta.
    const parsed = parseProgressCard(json);
    expect(parsed.ok).toBe(true);
  });

  it('una tarjeta modificada no pasa la firma', () => {
    const card = buildProgressCard({
      profile, privacy, streak: { current: 4, best: 9 }, savingsPct: 80,
      totalInvested: 750, monthlyInvestAvg: 250, goals: [], goalProgressPct: () => 0, weekly: null,
    });
    const tampered = JSON.stringify({ ...card, data: { ...card.data, totalInvested: 99999 } });
    const parsed = parseProgressCard(tampered);
    expect(parsed.ok).toBe(false);
  });
});

describe('ciclos y semanas (fechas)', () => {
  it('ciclo con inicio el 1 cubre el mes calendario', () => {
    expect(cycleStartFor('2025-09-16', 1)).toBe('2025-09-01');
    expect(cycleEndFor('2025-09-16', 1)).toBe('2025-09-30');
    expect(daysInCycle('2025-09-16', 1)).toBe(30);
  });

  it('ciclo con inicio el 15: el 10 pertenece al ciclo del mes anterior', () => {
    expect(cycleStartFor('2025-09-10', 15)).toBe('2025-08-15');
    expect(cycleEndFor('2025-09-10', 15)).toBe('2025-09-14');
  });

  it('semana anterior con resumen en domingo', () => {
    // 2025-09-16 es martes; el último domingo fue el 14 → semana 8–14... no:
    // la semana resumida termina el día ANTERIOR al día de resumen (sábado 13),
    // y empieza el domingo 7.
    const { start, end } = prevWeekRange('2025-09-16', 0);
    expect(end).toBe('2025-09-13');
    expect(start).toBe('2025-09-07');
  });
});
