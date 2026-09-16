// Estado global de la app: carga datos del repositorio, calcula derivados
// (ciclos, racha, pendientes) y expone acciones. La UI nunca toca Dexie
// directamente — todo pasa por Repository (requisito de Fase 1 para que la
// Fase 2 con Supabase sea un cambio de implementación, no de UI).

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getRepository } from '../data';
import type { BackupData } from '../data';
import type {
  Profile, Settings, Category, Expense, ExtraIncome, DaySnapshot,
  MonthClose, Investment, Goal, WeeklySummary, PartnerSnapshot,
} from '../lib/types';
import { computeHistory, finishedDays, type CycleSummary } from '../lib/history';
import { computeStreak, milestoneReached, type StreakResult } from '../lib/streak';
import { closeSuggestion, carryToNextCycle, round2, type DayComputation } from '../lib/budget';
import { buildWeeklySummary } from '../lib/weekly';
import { goalProgress, type GoalContext } from '../lib/goals';
import { todayISO, prevWeekRange, addDays, diffDays, rangeDays, cycleStartFor } from '../lib/dates';
import { buildProgressCard, parseProgressCard, type ProgressCard } from '../lib/share';

const uid = () => crypto.randomUUID();

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Comida', emoji: '🍽️', color: '#f59e0b' },
  { name: 'Transporte', emoji: '🚌', color: '#3b82f6' },
  { name: 'Salidas', emoji: '🎉', color: '#ec4899' },
  { name: 'Compras', emoji: '🛍️', color: '#8b5cf6' },
  { name: 'Salud', emoji: '💊', color: '#ef4444' },
  { name: 'Servicios', emoji: '🧾', color: '#14b8a6' },
  { name: 'Otros', emoji: '📦', color: '#64748b' },
];
export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Freelance', emoji: '💻', color: '#10b981' },
  { name: 'Venta', emoji: '🏷️', color: '#f59e0b' },
  { name: 'Regalo', emoji: '🎁', color: '#ec4899' },
  { name: 'Otros', emoji: '📦', color: '#64748b' },
];

export function defaultSettings(userId: string): Settings {
  return {
    userId,
    salary: 850,
    savingsGoal: 300,
    cycleStartDay: 1,
    manualDailyLimit: null,
    extraIncomeMode: 'invest',
    negativeCarryMode: 'deduct',
    suggestionIncludes: { positiveCarry: true, extraIncome: true, savingsGoal: true },
    weeklySummaryDay: 0,
    defaultRates: [8, 10, 15],
    privacy: {
      streak: true, savingsPct: true, totalInvested: true, goals: true,
      weekly: true, amounts: false, expenses: false,
    },
    theme: 'auto',
    accentColor: true,
    homeStats: ['baseLimit', 'carryYesterday', 'spentToday'],
    homeWidgets: { monthBudget: true, daysToClose: true, weekChart: true },
  };
}

/** Migración aditiva: rellena campos nuevos en Settings guardados por
 *  versiones anteriores de la app, sin tocar lo que el usuario ya configuró. */
export function normalizeSettings(stored: Settings | null, userId: string): Settings {
  const d = defaultSettings(userId);
  if (!stored) return d;
  return {
    ...d,
    ...stored,
    suggestionIncludes: { ...d.suggestionIncludes, ...stored.suggestionIncludes },
    privacy: { ...d.privacy, ...stored.privacy },
    homeWidgets: { ...d.homeWidgets, ...(stored as Partial<Settings>).homeWidgets },
    homeStats: (stored as Partial<Settings>).homeStats?.length ? stored.homeStats : d.homeStats,
  };
}

export type Celebration = { kind: 'streak' | 'goal'; title: string; subtitle: string };

type AppState = {
  loading: boolean;
  profile: Profile | null;
  settings: Settings;
  categories: Category[];
  expenses: Expense[];
  extraIncomes: ExtraIncome[];
  investments: Investment[];
  goals: Goal[];
  weeklySummaries: WeeklySummary[];
  monthCloses: MonthClose[];
  partnerSnapshot: PartnerSnapshot | null;
  daySnapshots: DaySnapshot[];
  today: string;
  // Derivados
  cycles: CycleSummary[];
  currentCycle: CycleSummary | null;
  todayComp: DayComputation | null;
  streak: StreakResult;
  totalInvested: number;
  monthlyInvestAvg: number;
  savingsPct: number | null;
  pendingClose: CycleSummary | null;
  pendingWeekly: WeeklySummary | null;
  goalCtx: GoalContext;
  celebration: Celebration | null;
  /** true si el límite de hoy fue ajustado a mano ("solo hoy"). */
  todayOverridden: boolean;
};

type AppActions = {
  refresh(): Promise<void>;
  dismissCelebration(): void;
  completeOnboarding(profile: Profile, settings: Settings, firstGoal: Goal | null): Promise<void>;
  saveProfile(p: Profile): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
  addExpense(e: Omit<Expense, 'id' | 'userId' | 'createdAt'>): Promise<void>;
  updateExpense(e: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  addExtraIncome(e: Omit<ExtraIncome, 'id' | 'userId' | 'createdAt'>): Promise<void>;
  deleteExtraIncome(id: string): Promise<void>;
  saveCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  confirmMonthClose(cycle: CycleSummary, confirmedAmount: number): Promise<void>;
  addInvestment(amount: number, date: string, note?: string): Promise<void>;
  updateInvestment(i: Investment): Promise<void>;
  deleteInvestment(id: string): Promise<void>;
  saveGoal(g: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;
  markWeeklySeen(id: string): Promise<void>;
  /** Ajuste del límite de SOLO hoy (snapshot del día). */
  setTodayLimit(limit: number): Promise<void>;
  clearTodayLimit(): Promise<void>;
  buildMyProgressCard(): ProgressCard | null;
  importPartnerCard(json: string): Promise<{ ok: boolean; error?: string }>;
  removePartner(): Promise<void>;
  exportBackup(): Promise<BackupData>;
  importBackup(json: string): Promise<{ ok: boolean; error?: string }>;
  clearAll(): Promise<void>;
  goalProgressFor(g: Goal): { value: number; pct: number };
};

const Ctx = createContext<(AppState & AppActions) | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fuera de AppProvider');
  return v;
}

type Raw = Pick<AppState,
  'profile' | 'settings' | 'categories' | 'expenses' | 'extraIncomes' | 'investments' |
  'goals' | 'weeklySummaries' | 'monthCloses' | 'partnerSnapshot' | 'daySnapshots'>;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const repo = getRepository();
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [today, setToday] = useState(todayISO());
  const [raw, setRaw] = useState<Raw>({
    profile: null,
    settings: defaultSettings('local'),
    categories: [],
    expenses: [],
    extraIncomes: [],
    investments: [],
    goals: [],
    weeklySummaries: [],
    monthCloses: [],
    partnerSnapshot: null,
    daySnapshots: [],
  });

  const load = useCallback(async (): Promise<Raw> => {
    const [profile, settings, categories, expenses, extraIncomes, investments, goals,
      weeklySummaries, monthCloses, partnerSnapshot] = await Promise.all([
      repo.getProfile(), repo.getSettings(), repo.listCategories(), repo.listExpenses(),
      repo.listExtraIncomes(), repo.listInvestments(), repo.listGoals(),
      repo.listWeeklySummaries(), repo.listMonthCloses(), repo.getPartnerSnapshot(),
    ]);
    const s = normalizeSettings(settings, profile?.id ?? 'local');
    const daySnapshots = profile
      ? await repo.listDaySnapshots(profile.pactStartDate, todayISO())
      : [];
    return {
      profile, settings: s, categories, expenses, extraIncomes, investments,
      goals, weeklySummaries, monthCloses, partnerSnapshot, daySnapshots,
    };
  }, []);

  const refresh = useCallback(async () => {
    const data = await load();
    setToday(todayISO());
    setRaw(data);
    setLoading(false);
  }, [load]);

  useEffect(() => {
    refresh();
    // Al volver a la app (PWA en segundo plano), refresca fecha y pendientes.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  // ── Derivados ──────────────────────────────────────────────────────────
  const derived = useMemo(() => {
    const { profile, settings } = raw;
    if (!profile) {
      return {
        cycles: [] as CycleSummary[], currentCycle: null, todayComp: null,
        streak: { current: 0, best: 0, atRisk: false }, totalInvested: 0,
        monthlyInvestAvg: 0, savingsPct: null, pendingClose: null, pendingWeekly: null,
        goalCtx: { totalInvested: 0, currentCarry: 0, savingsGoal: settings.savingsGoal, currentStreak: 0, cycleFraction: 0 } as GoalContext,
      };
    }
    const cycles = computeHistory({
      pactStartDate: profile.pactStartDate,
      today,
      settings,
      expenses: raw.expenses,
      extraIncomes: raw.extraIncomes,
      daySnapshots: raw.daySnapshots,
      monthCloses: raw.monthCloses,
    });
    const currentCycle = cycles.find((c) => c.isCurrent) ?? null;
    const todayComp = currentCycle?.days.find((d) => d.date === today) ?? null;
    const fin = finishedDays(cycles, profile.pactStartDate, today);
    const streak = computeStreak(fin, todayComp ? todayComp.carry : null);
    const totalInvested = round2(raw.investments.reduce((s, i) => s + i.amount, 0));
    const monthsSincePact = Math.max(1, Math.round(diffDays(profile.pactStartDate, today) / 30));
    const monthlyInvestAvg = round2(totalInvested / monthsSincePact);
    // % del mes ahorrado vs meta: la meta se aparta al inicio; el arrastre
    // negativo la va comiendo. (meta + min(arrastre, 0) + max(arrastre,0)*0) / meta
    const carry = todayComp?.carry ?? 0;
    const savingsPct = settings.savingsGoal > 0
      ? Math.round(Math.max(0, Math.min(((settings.savingsGoal + Math.min(carry, 0)) / settings.savingsGoal) * 100, 100)))
      : null;
    // Cierre pendiente: el ciclo terminado más antiguo sin MonthClose.
    const pendingClose = cycles.find((c) => !c.isCurrent && !c.close && c.end < today) ?? null;
    const pendingWeekly = [...raw.weeklySummaries].reverse().find((w) => !w.seenAt) ?? null;
    const goalCtx: GoalContext = {
      totalInvested,
      currentCarry: carry,
      savingsGoal: settings.savingsGoal,
      currentStreak: streak.current,
      cycleFraction: currentCycle
        ? (diffDays(currentCycle.start, today) + 1) / (diffDays(currentCycle.start, currentCycle.end) + 1)
        : 0,
      partnerTotalInvested: raw.partnerSnapshot?.data.totalInvested,
    };
    return { cycles, currentCycle, todayComp, streak, totalInvested, monthlyInvestAvg, savingsPct, pendingClose, pendingWeekly, goalCtx };
  }, [raw, today]);

  // ── Automatizaciones tras cargar ───────────────────────────────────────
  // Resumen semanal: se genera al abrir la app el día configurado o después.
  useEffect(() => {
    (async () => {
      const { profile, settings } = raw;
      if (loading || !profile || !derived.currentCycle) return;
      const { start, end } = prevWeekRange(today, settings.weeklySummaryDay);
      if (end < profile.pactStartDate || end >= today) return;
      if (raw.weeklySummaries.some((w) => w.weekStart === start)) return;
      const allDays = derived.cycles.flatMap((c) => c.days);
      const weekDays = allDays.filter((d) => d.date >= start && d.date <= end);
      if (weekDays.length === 0) return;
      const prevStart = addDays(start, -7);
      const prevEnd = addDays(end, -7);
      const prevDays = allDays.filter((d) => d.date >= prevStart && d.date <= prevEnd);
      const cc = derived.currentCycle;
      const daysElapsed = Math.max(1, diffDays(cc.start, today) + 1);
      const daysRemaining = Math.max(0, diffDays(today, cc.end));
      const summary: WeeklySummary = {
        id: uid(),
        userId: profile.id,
        weekStart: start,
        weekEnd: end,
        data: buildWeeklySummary({
          weekDays,
          weekExpenses: raw.expenses.filter((e) => e.date >= start && e.date <= end),
          categories: raw.categories,
          prevWeekSpent: prevDays.length ? prevDays.reduce((s, d) => s + d.spent, 0) : null,
          cycle: {
            currentCarry: derived.todayComp?.carry ?? cc.finalCarry,
            baseLimit: derived.todayComp?.baseLimit ?? 0,
            daysRemaining,
            avgDailySpend: cc.totalSpent / daysElapsed,
            totalExtraIncome: cc.totalExtraIncome,
          },
          settings,
        }),
      };
      await repo.saveWeeklySummary(summary);
      await refresh();
    })();
  }, [loading, raw.weeklySummaries.length, derived.currentCycle?.start, today]);

  // Snapshots de límites: congela el límite base de los días ya transcurridos
  // del ciclo actual, para que cambiar parámetros no reescriba el pasado.
  useEffect(() => {
    (async () => {
      const { profile } = raw;
      if (loading || !profile || !derived.currentCycle) return;
      const have = new Set(raw.daySnapshots.map((s) => s.date));
      const missing = derived.currentCycle.days
        .filter((d) => d.date < today && !have.has(d.date))
        .map((d): DaySnapshot => ({ userId: profile.id, date: d.date, baseLimit: d.baseLimit }));
      if (missing.length > 0) {
        await repo.saveDaySnapshots(missing);
        setRaw((r) => ({ ...r, daySnapshots: [...r.daySnapshots, ...missing] }));
      }
    })();
  }, [loading, derived.currentCycle?.start, today]);

  // Metas logradas: marca status='achieved' y celebra.
  useEffect(() => {
    (async () => {
      if (loading || !raw.profile) return;
      for (const g of raw.goals) {
        if (g.status !== 'active') continue;
        const { pct } = goalProgress(g, derived.goalCtx);
        if (pct >= 100) {
          await repo.saveGoal({ ...g, status: 'achieved', achievedAt: new Date().toISOString() });
          setCelebration({ kind: 'goal', title: '🎯 ¡Meta lograda!', subtitle: g.name });
          await refresh();
          return;
        }
      }
    })();
  }, [loading, derived.goalCtx.totalInvested, derived.goalCtx.currentStreak, raw.goals.length]);

  // Hitos de racha (celebrados una sola vez, recordados en localStorage).
  useEffect(() => {
    if (loading || !raw.profile) return;
    const m = milestoneReached(derived.streak.current);
    if (!m) return;
    try {
      const key = 'mfi-last-milestone';
      const last = Number(localStorage.getItem(key) ?? 0);
      if (m > last) {
        localStorage.setItem(key, String(m));
        setCelebration({ kind: 'streak', title: `🔥 ¡Racha de ${m} días!`, subtitle: 'Sigue así, tu yo del futuro te lo agradece.' });
      }
    } catch {
      // localStorage no disponible: la celebración simplemente no se repite-controla
    }
  }, [loading, derived.streak.current]);

  // ── Acciones ───────────────────────────────────────────────────────────
  const userId = raw.profile?.id ?? 'local';

  const actions: AppActions = {
    refresh,
    dismissCelebration: () => setCelebration(null),

    async completeOnboarding(profile, settings, firstGoal) {
      await repo.saveProfile(profile);
      await repo.saveSettings(settings);
      const cats = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({ id: uid(), userId: profile.id, kind: 'expense' as const, archived: false, order: i, ...c })),
        ...DEFAULT_INCOME_CATEGORIES.map((c, i) => ({ id: uid(), userId: profile.id, kind: 'income' as const, archived: false, order: i, ...c })),
      ];
      for (const c of cats) await repo.saveCategory(c);
      if (firstGoal) await repo.saveGoal(firstGoal);
      await refresh();
    },

    async saveProfile(p) {
      await repo.saveProfile(p);
      await refresh();
    },

    // Cambiar parámetros a mitad de ciclo: los días pasados ya quedaron
    // congelados por el efecto de snapshots; solo se recalcula hoy en adelante.
    async saveSettings(s) {
      await repo.saveSettings(s);
      await refresh();
    },

    async addExpense(e) {
      await repo.saveExpense({ ...e, id: uid(), userId, createdAt: new Date().toISOString() });
      await refresh();
    },
    async updateExpense(e) {
      await repo.saveExpense(e);
      await refresh();
    },
    async deleteExpense(id) {
      await repo.deleteExpense(id);
      await refresh();
    },
    async addExtraIncome(e) {
      await repo.saveExtraIncome({ ...e, id: uid(), userId, createdAt: new Date().toISOString() });
      await refresh();
    },
    async deleteExtraIncome(id) {
      await repo.deleteExtraIncome(id);
      await refresh();
    },
    async saveCategory(c) {
      await repo.saveCategory(c);
      await refresh();
    },
    async deleteCategory(id) {
      await repo.deleteCategory(id);
      await refresh();
    },

    async confirmMonthClose(cycle, confirmedAmount) {
      const suggestion = closeSuggestion(cycle.finalCarry, cycle.totalExtraIncome, raw.settings);
      const close: MonthClose = {
        id: uid(),
        userId,
        cycleStart: cycle.start,
        cycleEnd: cycle.end,
        totalSpent: round2(cycle.totalSpent),
        totalExtraIncome: round2(cycle.totalExtraIncome),
        finalCarry: round2(cycle.finalCarry),
        suggestedInvestment: suggestion,
        confirmedInvestment: confirmedAmount,
        carryToNextCycle: round2(carryToNextCycle(cycle.finalCarry, raw.settings.negativeCarryMode)),
        closedAt: new Date().toISOString(),
      };
      await repo.saveMonthClose(close);
      if (confirmedAmount > 0) {
        await repo.saveInvestment({
          id: uid(), userId, date: today, amount: confirmedAmount,
          source: 'monthly_close', monthCloseId: close.id,
          note: `Cierre ${cycle.start} → ${cycle.end}`,
        });
      }
      await refresh();
    },

    async addInvestment(amount, date, note) {
      await repo.saveInvestment({ id: uid(), userId, date, amount, source: 'manual', note });
      await refresh();
    },
    async updateInvestment(i) {
      await repo.saveInvestment(i);
      await refresh();
    },
    async deleteInvestment(id) {
      await repo.deleteInvestment(id);
      await refresh();
    },

    async saveGoal(g) {
      await repo.saveGoal(g);
      await refresh();
    },
    async deleteGoal(id) {
      await repo.deleteGoal(id);
      await refresh();
    },

    async markWeeklySeen(id) {
      const w = raw.weeklySummaries.find((x) => x.id === id);
      if (w) await repo.saveWeeklySummary({ ...w, seenAt: new Date().toISOString() });
      await refresh();
    },

    async setTodayLimit(limit) {
      await repo.saveDaySnapshots([{ userId, date: today, baseLimit: limit }]);
      await refresh();
    },
    async clearTodayLimit() {
      await repo.deleteDaySnapshot(userId, today);
      await refresh();
    },

    buildMyProgressCard() {
      const { profile, settings } = raw;
      if (!profile) return null;
      const lastWeekly = raw.weeklySummaries[raw.weeklySummaries.length - 1] ?? null;
      return buildProgressCard({
        profile,
        privacy: settings.privacy,
        streak: { current: derived.streak.current, best: derived.streak.best },
        savingsPct: derived.savingsPct,
        totalInvested: derived.totalInvested,
        monthlyInvestAvg: derived.monthlyInvestAvg,
        goals: raw.goals,
        goalProgressPct: (g) => goalProgress(g, derived.goalCtx).pct,
        weekly: lastWeekly?.data ?? null,
      });
    },

    async importPartnerCard(json) {
      const parsed = parseProgressCard(json);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      if (raw.profile && parsed.card.profile.id === raw.profile.id) {
        return { ok: false, error: 'Esta tarjeta es tuya, no de tu compañero.' };
      }
      const snap: PartnerSnapshot = {
        partnerProfile: parsed.card.profile,
        exportedAt: parsed.card.exportedAt,
        importedAt: new Date().toISOString(),
        data: parsed.card.data,
      };
      await repo.savePartnerSnapshot(snap);
      await refresh();
      return { ok: true };
    },

    async removePartner() {
      await repo.deletePartnerSnapshot();
      await refresh();
    },

    exportBackup: () => repo.exportAll(),

    async importBackup(json) {
      let data: BackupData;
      try {
        data = JSON.parse(json);
      } catch {
        return { ok: false, error: 'El archivo no es un JSON válido.' };
      }
      if (data?.type !== 'mfi-backup' || data?.v !== 1) {
        return { ok: false, error: 'No es un respaldo de My First Investment.' };
      }
      await repo.importAll(data);
      await refresh();
      return { ok: true };
    },

    async clearAll() {
      await repo.clearAll();
      try {
        localStorage.removeItem('mfi-last-milestone');
      } catch { /* sin localStorage no hay nada que limpiar */ }
      await refresh();
    },

    goalProgressFor: (g) => goalProgress(g, derived.goalCtx),
  };

  const value: AppState & AppActions = {
    loading,
    ...raw,
    today,
    ...derived,
    celebration,
    todayOverridden: raw.daySnapshots.some((s) => s.date === today),
    ...actions,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
