// Tarjeta de progreso (Fase 1) — sección 4.3.
// Genera un JSON firmado (checksum) que respeta los controles de privacidad.
// En Fase 2 esta misma forma de datos la servirá la vista shared_progress.

import type { Profile, PrivacySettings, SharedProgress, Goal, WeeklySummaryData } from './types';

export type ProgressCard = {
  v: 1;
  type: 'mfi-progress';
  exportedAt: string; // ISO datetime
  profile: Profile;
  data: SharedProgress;
  sig: string;
};

export type ProgressSource = {
  profile: Profile;
  privacy: PrivacySettings;
  streak: { current: number; best: number };
  savingsPct: number | null; // % del mes ahorrado vs meta
  totalInvested: number;
  monthlyInvestAvg: number;
  goals: Goal[];
  goalProgressPct: (g: Goal) => number;
  weekly: WeeklySummaryData | null;
};

/** Construye la tarjeta aplicando privacidad: lo no permitido NO viaja. */
export function buildProgressCard(src: ProgressSource, now: Date = new Date()): ProgressCard {
  const p = src.privacy;
  const data: SharedProgress = { pactStartDate: src.profile.pactStartDate };
  if (p.streak) data.streak = src.streak;
  if (p.savingsPct) data.savingsPct = src.savingsPct;
  if (p.totalInvested) {
    data.totalInvested = src.totalInvested;
    data.monthlyInvestAvg = src.monthlyInvestAvg;
  }
  if (p.goals) {
    data.goals = src.goals
      .filter((g) => g.status !== 'archived')
      .map((g) => ({
        name: g.name,
        type: g.type,
        target: p.amounts || g.type === 'streak' ? g.target : 0,
        progressPct: src.goalProgressPct(g),
        shared: g.shared,
        status: g.status,
      }));
  }
  if (p.weekly && src.weekly) {
    // El resumen semanal contiene montos: si amounts=false, solo va lo relativo.
    data.weekly = p.amounts
      ? src.weekly
      : {
          ...src.weekly,
          spent: 0,
          weekLimit: 0,
          difference: 0,
          projectedCarry: 0,
          projectedInvestment: 0,
        };
  }
  const body = { v: 1 as const, type: 'mfi-progress' as const, exportedAt: now.toISOString(), profile: src.profile, data };
  return { ...body, sig: signCard(body) };
}

/** Firma simple (hash FNV-1a del contenido). Detecta corrupción/edición manual;
 *  la autenticidad real llega en Fase 2 con cuentas. */
export function signCard(body: Omit<ProgressCard, 'sig'>): string {
  const str = JSON.stringify(body);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function parseProgressCard(json: string): { ok: true; card: ProgressCard } | { ok: false; error: string } {
  let obj: any;
  try {
    obj = JSON.parse(json);
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
  if (obj?.type !== 'mfi-progress' || obj?.v !== 1) {
    return { ok: false, error: 'No es una tarjeta de progreso de My First Investment.' };
  }
  if (!obj.profile?.name || !obj.exportedAt || !obj.data) {
    return { ok: false, error: 'La tarjeta está incompleta.' };
  }
  const { sig, ...body } = obj;
  if (signCard(body) !== sig) {
    return { ok: false, error: 'La firma no coincide: la tarjeta fue modificada o está dañada.' };
  }
  return { ok: true, card: obj as ProgressCard };
}
