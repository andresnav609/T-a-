// Modelo de datos — sección 6 de la spec. Todas las entidades llevan userId
// para que en Fase 2 (Supabase) las mismas formas sirvan como filas con RLS.

export type Profile = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  pactStartDate: string; // YYYY-MM-DD
  createdAt: string;
};

export type PrivacySettings = {
  streak: boolean;
  savingsPct: boolean;
  totalInvested: boolean;
  goals: boolean;
  weekly: boolean;
  amounts: boolean;
  expenses: boolean;
};

/** Mini-estadísticas elegibles para la tarjeta principal de Hoy. */
export type HomeStatId =
  | 'baseLimit'
  | 'carryYesterday'
  | 'spentToday'
  | 'monthSpent'
  | 'totalInvested'
  | 'daysToClose';

export type Settings = {
  userId: string;
  salary: number;
  savingsGoal: number;
  cycleStartDay: number; // 1–28
  /** Límite diario fijo escrito a mano; null = usar la fórmula. */
  manualDailyLimit: number | null;
  extraIncomeMode: 'invest' | 'available';
  negativeCarryMode: 'deduct' | 'reset';
  suggestionIncludes: { positiveCarry: boolean; extraIncome: boolean; savingsGoal: boolean };
  weeklySummaryDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo
  defaultRates: number[];
  privacy: PrivacySettings;
  // Personalización de la interfaz
  theme: 'auto' | 'light' | 'dark';
  /** Pintar la app con el color del perfil (no solo el avatar). */
  accentColor: boolean;
  /** Las 3 mini-estadísticas bajo el "disponible hoy". */
  homeStats: HomeStatId[];
  homeWidgets: { monthBudget: boolean; daysToClose: boolean; weekChart: boolean };
};

export type Category = {
  id: string;
  userId: string;
  kind: 'expense' | 'income';
  name: string;
  emoji: string;
  color: string;
  archived: boolean;
  order: number;
};

export type Expense = {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD (fecha local)
  amount: number;
  categoryId: string;
  note?: string;
  createdAt: string;
};

export type ExtraIncome = {
  id: string;
  userId: string;
  date: string;
  amount: number;
  categoryId: string;
  note?: string;
  createdAt: string;
};

export type DaySnapshot = {
  userId: string;
  date: string;
  baseLimit: number;
};

export type MonthClose = {
  id: string;
  userId: string;
  cycleStart: string;
  cycleEnd: string;
  totalSpent: number;
  totalExtraIncome: number;
  finalCarry: number;
  suggestedInvestment: number;
  confirmedInvestment: number;
  carryToNextCycle: number;
  closedAt: string;
};

export type Investment = {
  id: string;
  userId: string;
  date: string;
  amount: number;
  source: 'monthly_close' | 'manual';
  note?: string;
  monthCloseId?: string;
};

export type Goal = {
  id: string;
  userId: string;
  type: 'total_invested' | 'monthly_savings' | 'streak' | 'custom';
  name: string;
  target: number;
  deadline?: string;
  manualProgress?: number; // solo para 'custom'
  shared: boolean; // meta del pacto (suma de ambos)
  status: 'active' | 'achieved' | 'archived';
  achievedAt?: string;
  createdAt: string;
};

export type WeeklySummaryData = {
  spent: number;
  weekLimit: number;
  difference: number;
  topCategory: { name: string; emoji: string; pct: number } | null;
  daysUnderLimit: number;
  vsPrevWeekPct: number | null;
  projectedCarry: number;
  projectedInvestment: number;
};

export type WeeklySummary = {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  data: WeeklySummaryData;
  seenAt?: string;
};

// Lo que viaja en la tarjeta de progreso (Fase 1), respetando privacidad.
export type SharedProgress = {
  streak?: { current: number; best: number };
  savingsPct?: number | null;
  totalInvested?: number;
  monthlyInvestAvg?: number;
  goals?: { name: string; type: Goal['type']; target: number; progressPct: number; shared: boolean; status: Goal['status'] }[];
  weekly?: WeeklySummaryData;
  pactStartDate?: string;
};

export type PartnerSnapshot = {
  partnerProfile: Profile;
  exportedAt: string;
  importedAt: string;
  data: SharedProgress;
};
