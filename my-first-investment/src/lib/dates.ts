// Utilidades de fechas. Todas trabajan con strings YYYY-MM-DD en fecha LOCAL
// del usuario (la spec pide días según fecha local, no UTC).

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function diffDays(fromISO: string, toISOStr: string): number {
  const ms = parseISO(toISOStr).getTime() - parseISO(fromISO).getTime();
  return Math.round(ms / 86400000);
}

/** Inicio del ciclo que contiene `dateISO`, dado el día de inicio (1–28). */
export function cycleStartFor(dateISO: string, cycleStartDay: number): string {
  const d = parseISO(dateISO);
  const day = d.getDate();
  if (day >= cycleStartDay) {
    return toISODate(new Date(d.getFullYear(), d.getMonth(), cycleStartDay));
  }
  return toISODate(new Date(d.getFullYear(), d.getMonth() - 1, cycleStartDay));
}

/** Fin del ciclo (último día incluido) que contiene `dateISO`. */
export function cycleEndFor(dateISO: string, cycleStartDay: number): string {
  const start = parseISO(cycleStartFor(dateISO, cycleStartDay));
  const nextStart = new Date(start.getFullYear(), start.getMonth() + 1, cycleStartDay);
  nextStart.setDate(nextStart.getDate() - 1);
  return toISODate(nextStart);
}

export function daysInCycle(dateISO: string, cycleStartDay: number): number {
  return diffDays(cycleStartFor(dateISO, cycleStartDay), cycleEndFor(dateISO, cycleStartDay)) + 1;
}

/** Inicio (día `weekStartDay`) de la semana ANTERIOR completa a `dateISO`.
 *  `summaryDay` es el día configurado del resumen; la semana resumida termina
 *  el día anterior a ese día. */
export function prevWeekRange(dateISO: string, summaryDay: number): { start: string; end: string } {
  const d = parseISO(dateISO);
  // Retrocede hasta el último `summaryDay` (incluyéndolo si hoy lo es).
  let back = (d.getDay() - summaryDay + 7) % 7;
  const lastSummaryDay = addDays(dateISO, -back);
  const end = addDays(lastSummaryDay, -1);
  const start = addDays(end, -6);
  return { start, end };
}

export function rangeDays(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  let cur = startISO;
  while (cur <= endISO) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
