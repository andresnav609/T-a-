// Racha — sección 7.5. Un día cuenta si YA TERMINÓ y su arrastre >= 0.
// Se calcula, no se guarda como fuente de verdad.

export type StreakDay = { date: string; carry: number };

export type StreakResult = {
  current: number;
  best: number;
  /** true si hoy va en negativo (la racha "en riesgo") */
  atRisk: boolean;
};

export const STREAK_MILESTONES = [7, 14, 30, 60, 100, 365];

/**
 * `finishedDays`: días terminados en orden cronológico con su arrastre.
 * `todayCarry`: arrastre parcial de hoy (para el aviso de riesgo), o null si no hay datos.
 */
export function computeStreak(finishedDays: StreakDay[], todayCarry: number | null = null): StreakResult {
  let best = 0;
  let run = 0;
  for (const d of finishedDays) {
    if (d.carry >= 0) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  // rachaActual = días consecutivos que cuentan, hacia atrás desde ayer
  let current = 0;
  for (let i = finishedDays.length - 1; i >= 0; i--) {
    if (finishedDays[i].carry >= 0) current += 1;
    else break;
  }
  return { current, best: Math.max(best, current), atRisk: todayCarry !== null && todayCarry < 0 };
}

/** Devuelve el hito alcanzado exactamente con `current`, o null. */
export function milestoneReached(current: number): number | null {
  return STREAK_MILESTONES.includes(current) ? current : null;
}
