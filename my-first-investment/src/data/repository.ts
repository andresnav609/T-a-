// Capa de repositorio — requisito clave de Fase 1 (sección 2 de la spec).
// Toda lectura/escritura de datos pasa por esta interfaz. En Fase 1 la
// implementa LocalRepository (Dexie/IndexedDB); en Fase 2 se agrega
// SupabaseRepository con la MISMA interfaz, sin tocar la UI ni la lógica.

import type {
  Profile, Settings, Category, Expense, ExtraIncome, DaySnapshot,
  MonthClose, Investment, Goal, WeeklySummary, PartnerSnapshot,
} from '../lib/types';

export type BackupData = {
  v: 1;
  type: 'mfi-backup';
  exportedAt: string;
  profile: Profile | null;
  settings: Settings | null;
  categories: Category[];
  expenses: Expense[];
  extraIncomes: ExtraIncome[];
  daySnapshots: DaySnapshot[];
  monthCloses: MonthClose[];
  investments: Investment[];
  goals: Goal[];
  weeklySummaries: WeeklySummary[];
  partnerSnapshot: PartnerSnapshot | null;
};

export interface Repository {
  // Perfil y ajustes
  getProfile(): Promise<Profile | null>;
  saveProfile(p: Profile): Promise<void>;
  getSettings(): Promise<Settings | null>;
  saveSettings(s: Settings): Promise<void>;

  // Categorías
  listCategories(): Promise<Category[]>;
  saveCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  // Movimientos
  listExpenses(fromDate?: string, toDate?: string): Promise<Expense[]>;
  saveExpense(e: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  listExtraIncomes(fromDate?: string, toDate?: string): Promise<ExtraIncome[]>;
  saveExtraIncome(e: ExtraIncome): Promise<void>;
  deleteExtraIncome(id: string): Promise<void>;

  // Snapshots de límites diarios (cambios de parámetros a mitad de ciclo,
  // y ajustes manuales de "solo hoy")
  listDaySnapshots(fromDate: string, toDate: string): Promise<DaySnapshot[]>;
  saveDaySnapshots(snaps: DaySnapshot[]): Promise<void>;
  deleteDaySnapshot(userId: string, date: string): Promise<void>;

  // Cierres de mes e inversiones
  listMonthCloses(): Promise<MonthClose[]>;
  saveMonthClose(m: MonthClose): Promise<void>;
  listInvestments(): Promise<Investment[]>;
  saveInvestment(i: Investment): Promise<void>;
  deleteInvestment(id: string): Promise<void>;

  // Metas
  listGoals(): Promise<Goal[]>;
  saveGoal(g: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  // Resúmenes semanales
  listWeeklySummaries(): Promise<WeeklySummary[]>;
  saveWeeklySummary(w: WeeklySummary): Promise<void>;

  // Pacto (Fase 1: snapshot importado del compañero)
  getPartnerSnapshot(): Promise<PartnerSnapshot | null>;
  savePartnerSnapshot(s: PartnerSnapshot): Promise<void>;
  deletePartnerSnapshot(): Promise<void>;

  // Respaldo
  exportAll(): Promise<BackupData>;
  importAll(data: BackupData): Promise<void>;
  clearAll(): Promise<void>;
}
