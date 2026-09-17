// Motor de predicción — 100% local y privado.
// Aprende de tu historial (patrón por día de semana, tendencia, variabilidad)
// y simula cientos de futuros posibles (Monte Carlo) para dar rangos honestos:
// pesimista (p10), probable (p50) y optimista (p90).
// Con pocos días de datos usa tu configuración como punto de partida (prior)
// y va confiando más en tus datos reales a medida que se acumulan.

import { addDays, parseISO } from './dates';

// RNG sembrado (mulberry32): reproducible en tests, "aleatorio" en la app.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal(0,1) por Box-Muller. */
function gauss(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type SpendModel = {
  /** Media de gasto por día de semana (0=domingo…6). */
  weekdayMean: number[];
  /** Desviación estándar por día de semana. */
  weekdaySd: number[];
  overallMean: number;
  /** Cambio diario de la media (tendencia amortiguada, $/día por día). */
  trendPerDay: number;
  daysOfData: number;
};

/**
 * Modelo de gasto: medias por día de semana con "encogimiento" hacia la media
 * global (y hacia el prior de configuración cuando hay pocos datos).
 */
export function buildSpendModel(
  history: { date: string; spent: number }[],
  fallbackDailySpend: number,
): SpendModel {
  const n = history.length;
  // Usa como máximo las últimas 8 semanas: el pasado lejano pesa menos.
  const recent = history.slice(-56);
  const priorWeight = 7; // días "imaginarios" de configuración
  const totalReal = recent.reduce((s, d) => s + d.spent, 0);
  const overallMean = (totalReal + fallbackDailySpend * priorWeight) / (recent.length + priorWeight);

  const byWd: number[][] = [[], [], [], [], [], [], []];
  for (const d of recent) byWd[parseISO(d.date).getDay()].push(d.spent);

  const weekdayMean: number[] = [];
  const weekdaySd: number[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const xs = byWd[wd];
    const k = xs.length;
    const mean = k > 0 ? xs.reduce((s, x) => s + x, 0) / k : overallMean;
    // Encogimiento: con pocas muestras del día, tira hacia la media global.
    const w = k / (k + 3);
    const shrunk = w * mean + (1 - w) * overallMean;
    weekdayMean.push(shrunk);
    const varReal = k > 1 ? xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (k - 1) : 0;
    // Piso de variabilidad: nunca pretendas certeza total.
    const sd = Math.max(Math.sqrt(varReal), overallMean * 0.35, 1);
    weekdaySd.push(w * sd + (1 - w) * Math.max(overallMean * 0.6, 1));
  }

  // Tendencia: regresión lineal sobre el gasto diario reciente, amortiguada
  // al 50% y acotada (una racha de días caros no debe explotar la proyección).
  let trendPerDay = 0;
  if (recent.length >= 14) {
    const m = recent.length;
    const xs = recent.map((_, i) => i);
    const ys = recent.map((d) => d.spent);
    const mx = (m - 1) / 2;
    const my = ys.reduce((s, y) => s + y, 0) / m;
    let num = 0;
    let den = 0;
    for (let i = 0; i < m; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    const slope = den > 0 ? num / den : 0;
    const cap = overallMean * 0.02; // máx ±2% de la media por día
    trendPerDay = Math.max(-cap, Math.min(slope * 0.5, cap));
  }

  return { weekdayMean, weekdaySd, overallMean, trendPerDay, daysOfData: n };
}

export type ForecastInput = {
  history: { date: string; spent: number }[]; // días TERMINADOS
  startCash: number;
  startInvested: number;
  /** Pago recurrente: monto y día de semana en que suele llegar. null = no hay. */
  weeklyPay: { amount: number; weekday: number } | null;
  /** Ingresos extra: promedio semanal observado. */
  extraIncomeWeeklyMean: number;
  /** Inversión mensual esperada (sale de la plata, entra a invertido). */
  monthlyInvestment: number;
  /** Día del mes en que se invierte (día de inicio del ciclo). */
  investDayOfMonth: number;
  /** Retorno anual esperado de lo invertido (%). */
  annualReturnPct: number;
  fallbackDailySpend: number;
  today: string;
  horizonDays: number;
  sims?: number;
  seed?: number;
};

export type ForecastPoint = {
  day: number;
  date: string;
  cash: { p10: number; p50: number; p90: number };
  patrimonio: { p10: number; p50: number; p90: number };
};

export type ForecastResult = {
  points: ForecastPoint[]; // checkpoint cada ~semana (incluye día 0 y el final)
  final: ForecastPoint;
  confidence: 'config' | 'learning' | 'solid';
  daysOfData: number;
  model: SpendModel;
};

export function forecast(input: ForecastInput): ForecastResult {
  const model = buildSpendModel(input.history, input.fallbackDailySpend);
  const sims = input.sims ?? 400;
  const H = input.horizonDays;
  const rng = makeRng(input.seed ?? 12345);
  const dailyReturn = Math.pow(1 + input.annualReturnPct / 100, 1 / 365) - 1;

  // Checkpoints: día 0, cada 7 días y el último.
  const checkDays = new Set<number>([0, H]);
  for (let d = 7; d < H; d += 7) checkDays.add(d);
  const checkList = [...checkDays].sort((a, b) => a - b);
  const cashSamples = new Map<number, number[]>(checkList.map((d) => [d, []]));
  const patSamples = new Map<number, number[]>(checkList.map((d) => [d, []]));

  const startDate = parseISO(input.today);
  for (let s = 0; s < sims; s++) {
    let cash = input.startCash;
    let invested = input.startInvested;
    cashSamples.get(0)!.push(cash);
    patSamples.get(0)!.push(cash + invested);
    const cur = new Date(startDate);
    for (let d = 1; d <= H; d++) {
      cur.setDate(cur.getDate() + 1);
      const wd = cur.getDay();
      // Gasto del día: normal truncada en 0, con tendencia amortiguada.
      const mean = Math.max(model.weekdayMean[wd] + model.trendPerDay * d, 0);
      const spend = Math.max(mean + gauss(rng) * model.weekdaySd[wd], 0);
      cash -= spend;
      // Pago recurrente en su día de semana (±15% de variación).
      if (input.weeklyPay && wd === input.weeklyPay.weekday) {
        cash += input.weeklyPay.amount * (1 + gauss(rng) * 0.15);
      }
      // Ingresos extra: llegan "a veces"; en promedio, la media semanal.
      if (input.extraIncomeWeeklyMean > 0 && rng() < 1 / 7) {
        cash += input.extraIncomeWeeklyMean * (0.5 + rng());
      }
      // Inversión mensual: sale de la plata, entra a invertido (si alcanza).
      if (input.monthlyInvestment > 0 && cur.getDate() === input.investDayOfMonth) {
        const inv = Math.min(input.monthlyInvestment, Math.max(cash, 0));
        cash -= inv;
        invested += inv;
      }
      invested *= 1 + dailyReturn;
      if (checkDays.has(d)) {
        cashSamples.get(d)!.push(cash);
        patSamples.get(d)!.push(cash + invested);
      }
    }
  }

  const pct = (xs: number[], p: number) => {
    const sorted = [...xs].sort((a, b) => a - b);
    const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
    return Math.round(sorted[i] * 100) / 100;
  };
  const points: ForecastPoint[] = checkList.map((d) => ({
    day: d,
    date: addDays(input.today, d),
    cash: { p10: pct(cashSamples.get(d)!, 0.1), p50: pct(cashSamples.get(d)!, 0.5), p90: pct(cashSamples.get(d)!, 0.9) },
    patrimonio: { p10: pct(patSamples.get(d)!, 0.1), p50: pct(patSamples.get(d)!, 0.5), p90: pct(patSamples.get(d)!, 0.9) },
  }));

  const confidence = model.daysOfData < 7 ? 'config' : model.daysOfData < 28 ? 'learning' : 'solid';
  return { points, final: points[points.length - 1], confidence, daysOfData: model.daysOfData, model };
}

/** Camino determinista (valores esperados) — para fechas de cruce de metas. */
export function expectedPath(input: Omit<ForecastInput, 'sims' | 'seed' | 'horizonDays'>, maxDays: number):
  { day: number; cash: number; patrimonio: number }[] {
  const model = buildSpendModel(input.history, input.fallbackDailySpend);
  const dailyReturn = Math.pow(1 + input.annualReturnPct / 100, 1 / 365) - 1;
  const weeklyIncome = (input.weeklyPay?.amount ?? 0) + input.extraIncomeWeeklyMean;
  let cash = input.startCash;
  let invested = input.startInvested;
  const out = [{ day: 0, cash, patrimonio: cash + invested }];
  const cur = parseISO(input.today);
  for (let d = 1; d <= maxDays; d++) {
    cur.setDate(cur.getDate() + 1);
    const wd = cur.getDay();
    cash -= Math.max(model.weekdayMean[wd] + model.trendPerDay * Math.min(d, 90), 0);
    cash += weeklyIncome / 7;
    if (input.monthlyInvestment > 0 && cur.getDate() === input.investDayOfMonth) {
      const inv = Math.min(input.monthlyInvestment, Math.max(cash, 0));
      cash -= inv;
      invested += inv;
    }
    invested *= 1 + dailyReturn;
    out.push({ day: d, cash, patrimonio: cash + invested });
  }
  return out;
}

/** Días estimados hasta que el patrimonio esperado cruce `target`.
 *  `spendDelta` simula gastar X menos por día. null = no en 10 años. */
export function daysToTarget(
  input: Omit<ForecastInput, 'sims' | 'seed' | 'horizonDays'>,
  target: number,
  spendDelta = 0,
): number | null {
  const adjusted = spendDelta === 0 ? input : {
    ...input,
    history: input.history.map((h) => ({ ...h, spent: Math.max(h.spent - spendDelta, 0) })),
    fallbackDailySpend: Math.max(input.fallbackDailySpend - spendDelta, 0),
  };
  const path = expectedPath(adjusted, 3650);
  const hit = path.find((p) => p.patrimonio >= target);
  return hit ? hit.day : null;
}

// ── Insights: tendencias y patrones en lenguaje humano ──────────────────
export type Insight = { emoji: string; text: string };

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function buildInsights(args: {
  history: { date: string; spent: number; carry: number }[];
  categorySpend: { name: string; emoji: string; current: number; previous: number }[];
}): Insight[] {
  const { history } = args;
  const out: Insight[] = [];
  if (history.length < 14) {
    out.push({ emoji: '🌱', text: `Llevo ${history.length} día(s) aprendiendo tus patrones. Cada semana que registres, las predicciones se afinan.` });
    return out;
  }

  // Día que más gastas vs promedio.
  const byWd: number[][] = [[], [], [], [], [], [], []];
  for (const d of history.slice(-56)) byWd[parseISO(d.date).getDay()].push(d.spent);
  const means = byWd.map((xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0));
  const overall = means.reduce((s, m) => s + m, 0) / means.filter((m) => m > 0).length || 1;
  const maxWd = means.indexOf(Math.max(...means));
  if (overall > 0 && means[maxWd] > overall * 1.25) {
    out.push({ emoji: '📅', text: `Tu día de más gasto es el ${WEEKDAYS[maxWd]}: ${Math.round((means[maxWd] / overall - 1) * 100)}% sobre tu promedio.` });
  }

  // Mejora/empeora: últimos 14 días vs los 14 anteriores.
  if (history.length >= 28) {
    const last14 = history.slice(-14).reduce((s, d) => s + d.spent, 0);
    const prev14 = history.slice(-28, -14).reduce((s, d) => s + d.spent, 0);
    if (prev14 > 0) {
      const chg = Math.round(((last14 - prev14) / prev14) * 100);
      if (chg <= -5) out.push({ emoji: '📉', text: `Vas mejorando: gastaste ${-chg}% menos estas 2 semanas que las anteriores.` });
      else if (chg >= 5) out.push({ emoji: '📈', text: `Ojo: gastaste ${chg}% más estas 2 semanas que las anteriores.` });
      else out.push({ emoji: '⚖️', text: 'Tu gasto viene estable estas últimas semanas.' });
    }
  }

  // Día más peligroso para la racha.
  const negByWd = [0, 0, 0, 0, 0, 0, 0];
  for (const d of history.slice(-56)) if (d.carry < 0) negByWd[parseISO(d.date).getDay()] += 1;
  const worstWd = negByWd.indexOf(Math.max(...negByWd));
  if (negByWd[worstWd] >= 2) {
    out.push({ emoji: '🔥', text: `Tu racha corre más peligro los ${WEEKDAYS[worstWd]}s (${negByWd[worstWd]} veces te pasaste ese día).` });
  }

  // Categoría que se está inflando.
  const inflating = args.categorySpend
    .filter((c) => c.previous >= 10 && c.current > c.previous * 1.3)
    .sort((a, b) => b.current / Math.max(b.previous, 1) - a.current / Math.max(a.previous, 1))[0];
  if (inflating) {
    out.push({ emoji: inflating.emoji ? '🎈' : '🎈', text: `${inflating.emoji} ${inflating.name} se está inflando: +${Math.round((inflating.current / inflating.previous - 1) * 100)}% vs el ciclo pasado.` });
  }

  return out;
}
