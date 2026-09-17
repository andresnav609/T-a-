// Implementación Fase 1: IndexedDB vía Dexie.

import Dexie, { type Table } from 'dexie';
import type {
  Profile, Settings, Category, Expense, ExtraIncome, DaySnapshot,
  MonthClose, Investment, Goal, WeeklySummary, PartnerSnapshot, CashEvent, StockPosition,
} from '../lib/types';
import type { Repository, BackupData } from './repository';

class MfiDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  settings!: Table<Settings, string>;
  categories!: Table<Category, string>;
  expenses!: Table<Expense, string>;
  extraIncomes!: Table<ExtraIncome, string>;
  daySnapshots!: Table<DaySnapshot, [string, string]>;
  monthCloses!: Table<MonthClose, string>;
  investments!: Table<Investment, string>;
  goals!: Table<Goal, string>;
  weeklySummaries!: Table<WeeklySummary, string>;
  partnerSnapshots!: Table<PartnerSnapshot & { id: string }, string>;
  cashEvents!: Table<CashEvent, string>;
  stockPositions!: Table<StockPosition, string>;

  constructor() {
    super('my-first-investment');
    this.version(1).stores({
      profiles: 'id',
      settings: 'userId',
      categories: 'id, kind, order',
      expenses: 'id, date, categoryId',
      extraIncomes: 'id, date, categoryId',
      daySnapshots: '[userId+date], date',
      monthCloses: 'id, cycleStart',
      investments: 'id, date',
      goals: 'id, status',
      weeklySummaries: 'id, weekStart',
      partnerSnapshots: 'id',
    });
    // v2: libro de "Mi plata". Migración aditiva: solo agrega la tabla,
    // los datos existentes quedan intactos.
    this.version(2).stores({
      cashEvents: 'id, at',
    });
    // v3: posiciones de acciones. Migración aditiva.
    this.version(3).stores({
      stockPositions: 'id, symbol',
    });
  }
}

export class LocalRepository implements Repository {
  private db = new MfiDatabase();

  async getProfile() {
    return (await this.db.profiles.toArray())[0] ?? null;
  }
  async saveProfile(p: Profile) {
    await this.db.profiles.put(p);
  }
  async getSettings() {
    return (await this.db.settings.toArray())[0] ?? null;
  }
  async saveSettings(s: Settings) {
    await this.db.settings.put(s);
  }

  async listCategories() {
    const cats = await this.db.categories.toArray();
    return cats.sort((a, b) => a.order - b.order);
  }
  async saveCategory(c: Category) {
    await this.db.categories.put(c);
  }
  async deleteCategory(id: string) {
    await this.db.categories.delete(id);
  }

  async listExpenses(fromDate?: string, toDate?: string) {
    let q = this.db.expenses.orderBy('date');
    const all = await q.toArray();
    return all.filter((e) => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate));
  }
  async saveExpense(e: Expense) {
    await this.db.expenses.put(e);
  }
  async deleteExpense(id: string) {
    await this.db.expenses.delete(id);
  }

  async listExtraIncomes(fromDate?: string, toDate?: string) {
    const all = await this.db.extraIncomes.orderBy('date').toArray();
    return all.filter((e) => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate));
  }
  async saveExtraIncome(e: ExtraIncome) {
    await this.db.extraIncomes.put(e);
  }
  async deleteExtraIncome(id: string) {
    await this.db.extraIncomes.delete(id);
  }

  async listDaySnapshots(fromDate: string, toDate: string) {
    return this.db.daySnapshots.where('date').between(fromDate, toDate, true, true).toArray();
  }
  async saveDaySnapshots(snaps: DaySnapshot[]) {
    await this.db.daySnapshots.bulkPut(snaps);
  }
  async deleteDaySnapshot(userId: string, date: string) {
    await this.db.daySnapshots.delete([userId, date]);
  }

  async listMonthCloses() {
    return this.db.monthCloses.orderBy('cycleStart').toArray();
  }
  async saveMonthClose(m: MonthClose) {
    await this.db.monthCloses.put(m);
  }

  async listInvestments() {
    return this.db.investments.orderBy('date').toArray();
  }
  async saveInvestment(i: Investment) {
    await this.db.investments.put(i);
  }
  async deleteInvestment(id: string) {
    await this.db.investments.delete(id);
  }

  async listGoals() {
    return this.db.goals.toArray();
  }
  async saveGoal(g: Goal) {
    await this.db.goals.put(g);
  }
  async deleteGoal(id: string) {
    await this.db.goals.delete(id);
  }

  async listWeeklySummaries() {
    return this.db.weeklySummaries.orderBy('weekStart').toArray();
  }
  async saveWeeklySummary(w: WeeklySummary) {
    await this.db.weeklySummaries.put(w);
  }

  async listCashEvents() {
    return this.db.cashEvents.orderBy('at').toArray();
  }
  async saveCashEvent(e: CashEvent) {
    await this.db.cashEvents.put(e);
  }
  async deleteCashEvent(id: string) {
    await this.db.cashEvents.delete(id);
  }

  async listStockPositions() {
    return this.db.stockPositions.toArray();
  }
  async saveStockPosition(p: StockPosition) {
    await this.db.stockPositions.put(p);
  }
  async deleteStockPosition(id: string) {
    await this.db.stockPositions.delete(id);
  }

  async getPartnerSnapshot() {
    const s = await this.db.partnerSnapshots.get('partner');
    if (!s) return null;
    const { id, ...rest } = s;
    return rest;
  }
  async savePartnerSnapshot(s: PartnerSnapshot) {
    await this.db.partnerSnapshots.put({ ...s, id: 'partner' });
  }
  async deletePartnerSnapshot() {
    await this.db.partnerSnapshots.delete('partner');
  }

  async exportAll(): Promise<BackupData> {
    return {
      v: 1,
      type: 'mfi-backup',
      exportedAt: new Date().toISOString(),
      profile: await this.getProfile(),
      settings: await this.getSettings(),
      categories: await this.db.categories.toArray(),
      expenses: await this.db.expenses.toArray(),
      extraIncomes: await this.db.extraIncomes.toArray(),
      daySnapshots: await this.db.daySnapshots.toArray(),
      monthCloses: await this.db.monthCloses.toArray(),
      investments: await this.db.investments.toArray(),
      goals: await this.db.goals.toArray(),
      weeklySummaries: await this.db.weeklySummaries.toArray(),
      partnerSnapshot: await this.getPartnerSnapshot(),
      cashEvents: await this.db.cashEvents.toArray(),
      stockPositions: await this.db.stockPositions.toArray(),
    };
  }

  async importAll(data: BackupData) {
    await this.clearAll();
    await this.db.transaction('rw', this.db.tables, async () => {
      if (data.profile) await this.db.profiles.put(data.profile);
      if (data.settings) await this.db.settings.put(data.settings);
      await this.db.categories.bulkPut(data.categories ?? []);
      await this.db.expenses.bulkPut(data.expenses ?? []);
      await this.db.extraIncomes.bulkPut(data.extraIncomes ?? []);
      await this.db.daySnapshots.bulkPut(data.daySnapshots ?? []);
      await this.db.monthCloses.bulkPut(data.monthCloses ?? []);
      await this.db.investments.bulkPut(data.investments ?? []);
      await this.db.goals.bulkPut(data.goals ?? []);
      await this.db.weeklySummaries.bulkPut(data.weeklySummaries ?? []);
      await this.db.cashEvents.bulkPut(data.cashEvents ?? []);
      await this.db.stockPositions.bulkPut(data.stockPositions ?? []);
      if (data.partnerSnapshot) await this.db.partnerSnapshots.put({ ...data.partnerSnapshot, id: 'partner' });
    });
  }

  async clearAll() {
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const t of this.db.tables) await t.clear();
    });
  }
}
