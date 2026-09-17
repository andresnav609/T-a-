// Portafolio de acciones: cruza tus posiciones (locales y privadas) con los
// precios de cierre que el robot nocturno publica en prices.json.
// Separado de "Mi plata": es informativo, no toca la cuenta de banco.

import type { StockPosition, PricesFile } from './types';

/** Cierre en la fecha dada o el último anterior (mercado cerrado los findes). */
export function priceOn(series: [string, number][], date: string): number | null {
  let best: number | null = null;
  for (const [d, close] of series) {
    if (d <= date) best = close;
    else break; // la serie viene ordenada por fecha
  }
  return best;
}

export function lastPrice(series: [string, number][]): { date: string; close: number } | null {
  if (series.length === 0) return null;
  const [date, close] = series[series.length - 1];
  return { date, close };
}

export type PositionView = {
  position: StockPosition;
  currentPrice: number | null;
  currentValue: number | null; // null si no hay precio (o valor de venta si vendida)
  gain: number | null;
  gainPct: number | null;
};

export type PortfolioView = {
  positions: PositionView[];
  /** Solo posiciones activas (no vendidas). */
  invested: number; // de tu bolsillo
  currentValue: number; // valor de mercado hoy
  gain: number;
  gainPct: number | null;
  pricesDate: string | null; // fecha del último cierre disponible
  /** Valor del portafolio activo por día (para la gráfica), últimos `days`. */
  history: { date: string; value: number }[];
};

export function buildPortfolio(
  positions: StockPosition[],
  prices: PricesFile | null,
  historyDays = 90,
): PortfolioView {
  const views: PositionView[] = positions.map((p) => {
    if (p.soldDate && p.soldPrice != null) {
      const value = p.shares * p.soldPrice;
      return {
        position: p,
        currentPrice: p.soldPrice,
        currentValue: round2(value),
        gain: round2(value - p.amountInvested),
        gainPct: p.amountInvested > 0 ? round1(((value - p.amountInvested) / p.amountInvested) * 100) : null,
      };
    }
    const series = prices?.tickers[p.symbol]?.series ?? [];
    const last = lastPrice(series);
    if (!last) return { position: p, currentPrice: null, currentValue: null, gain: null, gainPct: null };
    const value = p.shares * last.close;
    return {
      position: p,
      currentPrice: last.close,
      currentValue: round2(value),
      gain: round2(value - p.amountInvested),
      gainPct: p.amountInvested > 0 ? round1(((value - p.amountInvested) / p.amountInvested) * 100) : null,
    };
  });

  const active = views.filter((v) => !v.position.soldDate);
  const invested = round2(active.reduce((s, v) => s + v.position.amountInvested, 0));
  const currentValue = round2(active.reduce((s, v) => s + (v.currentValue ?? v.position.amountInvested), 0));

  // Historia del portafolio: para cada fecha del ticker más largo, suma
  // shares × cierre de cada posición activa comprada en o antes de esa fecha.
  const history: { date: string; value: number }[] = [];
  if (prices && active.length > 0) {
    const allDates = new Set<string>();
    for (const v of active) {
      for (const [d] of prices.tickers[v.position.symbol]?.series ?? []) allDates.add(d);
    }
    const dates = [...allDates].sort().slice(-historyDays);
    for (const date of dates) {
      let value = 0;
      let any = false;
      for (const v of active) {
        if (v.position.buyDate > date) continue;
        const close = priceOn(prices.tickers[v.position.symbol]?.series ?? [], date);
        if (close !== null) {
          value += v.position.shares * close;
          any = true;
        }
      }
      if (any) history.push({ date, value: round2(value) });
    }
  }

  let pricesDate: string | null = null;
  if (prices) {
    for (const t of Object.values(prices.tickers)) {
      const last = lastPrice(t.series);
      if (last && (!pricesDate || last.date > pricesDate)) pricesDate = last.date;
    }
  }

  return {
    positions: views,
    invested,
    currentValue,
    gain: round2(currentValue - invested),
    gainPct: invested > 0 ? round1(((currentValue - invested) / invested) * 100) : null,
    pricesDate,
    history,
  };
}

/** Línea de tiempo del portafolio, incluyendo posiciones vendidas HASTA su
 *  venta (tu historia real). Por fecha:
 *  value = lo que valían tus posiciones vigentes ese día;
 *  gain  = value + ventas acumuladas − compras acumuladas (ganancia total,
 *          realizada + no realizada). */
export type TimelinePoint = { date: string; value: number; gain: number; invested: number };

export function portfolioTimeline(
  positions: StockPosition[],
  prices: PricesFile | null,
): TimelinePoint[] {
  if (!prices || positions.length === 0) return [];
  const dates = new Set<string>();
  for (const p of positions) {
    for (const [d] of prices.tickers[p.symbol]?.series ?? []) dates.add(d);
  }
  const firstBuy = positions.reduce((m, p) => (p.buyDate < m ? p.buyDate : m), '9999-12-31');
  const window = [...dates].sort().filter((d) => d >= firstBuy);
  const out: TimelinePoint[] = [];
  for (const date of window) {
    let value = 0;
    let buys = 0;
    let proceeds = 0;
    for (const p of positions) {
      if (p.buyDate <= date) buys += p.amountInvested;
      if (p.soldDate && p.soldPrice != null && p.soldDate <= date) proceeds += p.shares * p.soldPrice;
      const held = p.buyDate <= date && (!p.soldDate || date < p.soldDate);
      if (held) {
        const c = priceOn(prices.tickers[p.symbol]?.series ?? [], date);
        if (c !== null) value += p.shares * c;
      }
    }
    if (buys > 0) {
      out.push({
        date,
        value: round2(value),
        gain: round2(value + proceeds - buys),
        invested: round2(buys - proceeds),
      });
    }
  }
  return out;
}

/** % de cambio de una posición desde su compra (hasta su venta si aplica). */
export function positionPctSeries(
  p: StockPosition,
  prices: PricesFile | null,
): { date: string; pct: number }[] {
  const series = prices?.tickers[p.symbol]?.series ?? [];
  if (p.buyPrice <= 0) return [];
  const out: { date: string; pct: number }[] = [];
  for (const [date, close] of series) {
    if (date < p.buyDate) continue;
    if (p.soldDate && date > p.soldDate) break;
    out.push({ date, pct: round1((close / p.buyPrice - 1) * 100) });
  }
  return out;
}

/** Cuadre de inversión: aportes anotados vs compras de acciones.
 *  brokerCash = aportes − compras + ventas. Negativo = compraste más de lo
 *  que anotaste como aporte (falta anotar un aporte, o sobró una compra). */
export function brokerReconciliation(
  totalContributed: number,
  positions: StockPosition[],
): { buys: number; proceeds: number; brokerCash: number } {
  const buys = positions.reduce((s, p) => s + p.amountInvested, 0);
  const proceeds = positions.reduce(
    (s, p) => s + (p.soldDate && p.soldPrice != null ? p.shares * p.soldPrice : 0),
    0,
  );
  const brokerCash = Math.round((totalContributed - buys + proceeds + Number.EPSILON) * 100) / 100;
  return {
    buys: Math.round((buys + Number.EPSILON) * 100) / 100,
    proceeds: Math.round((proceeds + Number.EPSILON) * 100) / 100,
    brokerCash,
  };
}

export function parsePricesFile(json: string): PricesFile | null {
  try {
    const obj = JSON.parse(json);
    if (obj?.v !== 1 || typeof obj.tickers !== 'object') return null;
    return obj as PricesFile;
  } catch {
    return null;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}
