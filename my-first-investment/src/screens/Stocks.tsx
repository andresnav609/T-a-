// Mis acciones: posiciones locales (privadas) × precios de cierre publicados
// cada noche por el workflow en prices.json. Separado de Mi plata: muestra
// "de tu bolsillo" vs "valor hoy", sin tocar la cuenta de banco.

import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ComposedChart, Area, ReferenceLine, ReferenceDot, Legend,
} from 'recharts';
import { useApp } from '../state/app';
import { Card, Button, Sheet, Field, NumberInput, EmptyState, inputCls, useConfirm, Chip } from '../components/ui';
import { fmtMoney, fmtMoneyShort, fmtDateShort, timeAgo } from '../lib/format';
import {
  buildPortfolio, priceOn, parsePricesFile, brokerReconciliation,
  portfolioTimeline, positionPctSeries,
} from '../lib/stocks';
import { addDays, todayISO } from '../lib/dates';
import type { PricesFile, StockPosition } from '../lib/types';

const SERIES_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];

/** Precios: red primero (una vez por sesión), caché local como respaldo. */
function usePrices(): { prices: PricesFile | null; offline: boolean } {
  const [prices, setPrices] = useState<PricesFile | null>(() => {
    try {
      return parsePricesFile(localStorage.getItem('mfi-prices') ?? '');
    } catch {
      return null;
    }
  });
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('./prices.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        const parsed = parsePricesFile(text);
        if (parsed) {
          setPrices(parsed);
          try { localStorage.setItem('mfi-prices', text); } catch { /* caché opcional */ }
        }
      } catch {
        setOffline(true); // sin red o aún no corre el robot: usa la caché
      }
    })();
  }, []);
  return { prices, offline };
}

export function StocksSection() {
  const app = useApp();
  const { prices, offline } = usePrices();
  const [buySheet, setBuySheet] = useState(false);
  const [posSheet, setPosSheet] = useState<StockPosition | null>(null);
  const [showSold, setShowSold] = useState(false);

  const pf = useMemo(() => buildPortfolio(app.stockPositions, prices), [app.stockPositions, prices]);
  const active = pf.positions.filter((v) => !v.position.soldDate);
  const sold = pf.positions.filter((v) => v.position.soldDate);
  // Cuadre: aportes anotados (Total invertido) vs compras de acciones.
  const recon = useMemo(
    () => brokerReconciliation(app.totalInvested, app.stockPositions),
    [app.totalInvested, app.stockPositions],
  );
  const chart = pf.history.map((h) => ({ fecha: fmtDateShort(h.date), valor: h.value }));

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-semibold">📊 Mis acciones</p>
        <Button variant="ghost" onClick={() => setBuySheet(true)}>+ Compra</Button>
      </div>
      <p className="mb-2 text-xs text-slate-400">
        {pf.pricesDate
          ? `Precios de cierre del ${fmtDateShort(pf.pricesDate)} · se actualizan cada noche automáticamente${offline ? ' · sin conexión: mostrando lo último guardado' : ''}`
          : 'Los precios llegan con la corrida nocturna del robot. Puedes registrar tus compras desde ya con el precio de tu broker.'}
      </p>

      {app.stockPositions.length === 0 ? (
        <EmptyState emoji="📈" text='Registra tu primera compra: "invertí $50 en VOO" y la app le hace seguimiento sola cada noche.' />
      ) : (
        <>
          {/* Bolsillo vs valor de hoy — separado de Mi plata */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
              <p className="text-xs text-slate-400">De tu bolsillo</p>
              <p className="text-lg font-bold tabular-nums">{fmtMoney(pf.invested)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800">
              <p className="text-xs text-slate-400">Valor hoy</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{fmtMoney(pf.currentValue)}</p>
            </div>
          </div>
          <p className={`mt-1 text-center text-sm font-semibold tabular-nums ${pf.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {pf.gain >= 0 ? '▲' : '▼'} {fmtMoney(Math.abs(pf.gain))}{pf.gainPct !== null ? ` (${pf.gain >= 0 ? '+' : '−'}${Math.abs(pf.gainPct)}%)` : ''}
          </p>

          {chart.length > 1 && (
            <div className="mt-2 h-32">
              <ResponsiveContainer>
                <LineChart data={chart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => fmtMoneyShort(v)} domain={['auto', 'auto']} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number) => fmtMoney(v)} />
                  <Line dataKey="valor" stroke="var(--accent)" strokeWidth={2} dot={false} name="valor" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {active.map((v) => (
              <li key={v.position.id}>
                <button className="flex min-h-[44px] w-full items-center gap-2 py-1.5 text-left" onClick={() => setPosSheet(v.position)}>
                  <span className="font-bold">{v.position.symbol}</span>
                  <span className="flex-1 text-xs text-slate-400">
                    {v.position.shares.toFixed(4)} acc. · desde {fmtDateShort(v.position.buyDate)}
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums">{v.currentValue !== null ? fmtMoney(v.currentValue) : fmtMoney(v.position.amountInvested)}</span>
                    {v.gainPct !== null && (
                      <span className={`block text-xs tabular-nums ${v.gain! >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {v.gain! >= 0 ? '+' : ''}{v.gainPct}%
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {/* Cuadre de inversión: que aportes y compras no se desamarren */}
          <div className={`mt-3 rounded-xl p-3 text-sm ${recon.brokerCash < -0.005 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-slate-50 dark:bg-slate-800'}`}>
            <p className="mb-1 font-semibold">🔗 Cuadre con tus aportes</p>
            <div className="flex justify-between py-0.5"><span className="text-slate-500">Aportes anotados</span><span className="tabular-nums">{fmtMoney(app.totalInvested)}</span></div>
            <div className="flex justify-between py-0.5"><span className="text-slate-500">− Compras de acciones</span><span className="tabular-nums">{fmtMoney(recon.buys)}</span></div>
            {recon.proceeds > 0 && (
              <div className="flex justify-between py-0.5"><span className="text-slate-500">+ Ventas</span><span className="tabular-nums">{fmtMoney(recon.proceeds)}</span></div>
            )}
            <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-700">
              <span>{recon.brokerCash >= -0.005 ? 'Sin invertir (efectivo en el broker)' : 'Discrepancia'}</span>
              <span className={`tabular-nums ${recon.brokerCash < -0.005 ? 'text-amber-700 dark:text-amber-300' : ''}`}>{fmtMoney(recon.brokerCash)}</span>
            </div>
            {recon.brokerCash < -0.005 && (
              <>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Compraste {fmtMoney(-recon.brokerCash)} más de lo que has anotado como aporte.
                  ¿Se te olvidó anotar un aporte, o registraste una compra de más?
                </p>
                <Button
                  variant="secondary"
                  className="mt-2 w-full"
                  onClick={() => app.addInvestment(-recon.brokerCash, todayISO(), 'Ajuste: cuadre con acciones')}
                >
                  Anotar aporte de {fmtMoney(-recon.brokerCash)}
                </Button>
              </>
            )}
          </div>

          {sold.length > 0 && (
            <>
              <button className="mt-1 text-xs text-slate-400" onClick={() => setShowSold(!showSold)}>
                {showSold ? 'Ocultar vendidas' : `Ver ${sold.length} vendida(s)`}
              </button>
              {showSold && (
                <ul className="divide-y divide-slate-100 text-sm opacity-60 dark:divide-slate-800">
                  {sold.map((v) => (
                    <li key={v.position.id}>
                      <button className="flex min-h-[44px] w-full items-center gap-2 py-1.5 text-left" onClick={() => setPosSheet(v.position)}>
                        <span className="font-bold">{v.position.symbol}</span>
                        <span className="flex-1 text-xs">vendida {fmtDateShort(v.position.soldDate!)}</span>
                        <span className={`tabular-nums ${v.gain! >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {v.gain! >= 0 ? '+' : ''}{fmtMoney(v.gain!)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}

      {buySheet && <BuySheet prices={prices} onClose={() => setBuySheet(false)} />}
      {posSheet && <PositionSheet position={posSheet} prices={prices} onClose={() => setPosSheet(null)} />}
    </Card>
  );
}

function BuySheet({ prices, onClose }: { prices: PricesFile | null; onClose: () => void }) {
  const app = useApp();
  const available = prices ? Object.keys(prices.tickers).sort() : [];
  const [symbol, setSymbol] = useState(available[0] ?? '');
  const [amount, setAmount] = useState(50);
  const [date, setDate] = useState(todayISO());
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  const autoPrice = useMemo(() => {
    if (!prices || !symbol) return null;
    return priceOn(prices.tickers[symbol]?.series ?? [], date);
  }, [prices, symbol, date]);
  const price = manualPrice ?? autoPrice;
  const shares = price && price > 0 ? amount / price : null;

  const save = async () => {
    if (!symbol.trim() || amount <= 0 || !price || price <= 0) return;
    await app.saveStockPosition({
      id: crypto.randomUUID(),
      userId: app.profile!.id,
      symbol: symbol.trim().toUpperCase(),
      amountInvested: amount,
      buyDate: date,
      buyPrice: price,
      shares: amount / price,
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title="Registrar compra">
      <Field label="Acción / ETF">
        {available.length > 0 ? (
          <select className={inputCls} value={symbol} onChange={(e) => { setSymbol(e.target.value); setManualPrice(null); }} aria-label="Ticker">
            {available.map((t) => <option key={t} value={t}>{t}{prices?.tickers[t].name ? ` — ${prices.tickers[t].name}` : ''}</option>)}
          </select>
        ) : (
          <input className={inputCls} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="VOO" aria-label="Ticker" />
        )}
      </Field>
      <Field label="¿Cuánto invertiste? (USD)">
        <NumberInput value={amount} onChange={setAmount} min={0} ariaLabel="Monto invertido" />
      </Field>
      <Field label="Fecha de compra">
        <input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => { setDate(e.target.value); setManualPrice(null); }} />
      </Field>
      <Field
        label="Precio por acción"
        hint={autoPrice !== null && manualPrice === null ? `Cierre del mercado en esa fecha. Puedes corregirlo con el precio exacto de tu broker.` : 'Escribe el precio de tu broker (los precios automáticos llegan esta noche).'}
      >
        <NumberInput value={price ?? 0} onChange={(n) => setManualPrice(n)} min={0} ariaLabel="Precio por acción" />
      </Field>
      {shares !== null && shares > 0 && (
        <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Con {fmtMoney(amount)} tienes <strong>{shares.toFixed(4)} acciones</strong> de {symbol || '—'}.
        </p>
      )}
      <Button className="w-full" disabled={!symbol.trim() || amount <= 0 || !price || price <= 0} onClick={save}>
        Guardar compra
      </Button>
    </Sheet>
  );
}

function PositionSheet({ position, prices, onClose }: { position: StockPosition; prices: PricesFile | null; onClose: () => void }) {
  const app = useApp();
  const [pendingDelete, confirmDelete] = useConfirm();
  const [selling, setSelling] = useState(false);
  const last = prices ? priceOn(prices.tickers[position.symbol]?.series ?? [], todayISO()) : null;
  const [sellPrice, setSellPrice] = useState(position.soldPrice ?? last ?? position.buyPrice);

  return (
    <Sheet open onClose={onClose} title={`${position.symbol} · ${position.shares.toFixed(4)} acciones`}>
      <PositionChart position={position} prices={prices} />
      <div className="mb-3 grid grid-cols-2 gap-2 text-center text-sm">
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-xs text-slate-400">Compraste</p>
          <p className="font-semibold tabular-nums">{fmtMoney(position.amountInvested)}</p>
          <p className="text-xs text-slate-400">{fmtDateShort(position.buyDate)} a {fmtMoney(position.buyPrice)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
          <p className="text-xs text-slate-400">{position.soldDate ? 'Vendiste en' : 'Vale hoy'}</p>
          <p className="font-semibold tabular-nums">
            {position.soldDate && position.soldPrice != null
              ? fmtMoney(position.shares * position.soldPrice)
              : last !== null ? fmtMoney(position.shares * last) : '—'}
          </p>
        </div>
      </div>

      {!position.soldDate && (
        selling ? (
          <>
            <Field label="Precio de venta por acción">
              <NumberInput value={sellPrice} onChange={setSellPrice} min={0} ariaLabel="Precio de venta" />
            </Field>
            <Button className="mb-2 w-full" disabled={sellPrice <= 0}
              onClick={async () => {
                await app.saveStockPosition({ ...position, soldDate: todayISO(), soldPrice: sellPrice });
                onClose();
              }}>
              Confirmar venta ({fmtMoney(position.shares * sellPrice)})
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setSelling(false)}>Cancelar</Button>
          </>
        ) : (
          <Button variant="secondary" className="mb-2 w-full" onClick={() => setSelling(true)}>Marcar como vendida</Button>
        )
      )}
      {position.soldDate && (
        <Button variant="secondary" className="mb-2 w-full"
          onClick={async () => {
            await app.saveStockPosition({ ...position, soldDate: undefined, soldPrice: undefined });
            onClose();
          }}>
          Deshacer venta
        </Button>
      )}
      <Button variant="danger" className="w-full"
        onClick={() => confirmDelete(position.id, async () => { await app.deleteStockPosition(position.id); onClose(); })}>
        {pendingDelete === position.id ? '¿Seguro? Toca otra vez' : 'Borrar posición'}
      </Button>
    </Sheet>
  );
}

// ── Pestaña "Portafolio" de Inversión: las gráficas ──────────────────────

const PERIODS: { label: string; days: number | null }[] = [
  { label: '1S', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 91 },
  { label: '1A', days: 365 },
  { label: 'Todo', days: null },
];

export function PortfolioCharts() {
  const app = useApp();
  const { prices, offline } = usePrices();
  const [period, setPeriod] = useState<number | null>(91);
  const [posSheet, setPosSheet] = useState<StockPosition | null>(null);

  const timeline = useMemo(
    () => portfolioTimeline(app.stockPositions, prices),
    [app.stockPositions, prices],
  );
  const windowed = useMemo(() => {
    if (period === null) return timeline;
    const cutoff = addDays(todayISO(), -period);
    return timeline.filter((t) => t.date >= cutoff);
  }, [timeline, period]);

  const pf = useMemo(() => buildPortfolio(app.stockPositions, prices), [app.stockPositions, prices]);

  // Comparativa: hasta 6 posiciones (las de mayor aporte), en % desde su compra.
  const compare = useMemo(() => {
    if (!prices) return { data: [] as Record<string, number | string>[], keys: [] as string[] };
    const top = [...app.stockPositions]
      .sort((a, b) => b.amountInvested - a.amountInvested)
      .slice(0, 6);
    const cutoff = period === null ? '0000' : addDays(todayISO(), -period);
    const byDate = new Map<string, Record<string, number | string>>();
    const keys: string[] = [];
    for (const p of top) {
      const key = `${p.symbol} ${fmtDateShort(p.buyDate)}`;
      keys.push(key);
      for (const { date, pct } of positionPctSeries(p, prices)) {
        if (date < cutoff) continue;
        const row = byDate.get(date) ?? { date };
        row[key] = pct;
        byDate.set(date, row);
      }
    }
    const data = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { data, keys };
  }, [app.stockPositions, prices, period]);

  if (app.stockPositions.length === 0) {
    return (
      <Card>
        <EmptyState emoji="📈" text="Registra tu primera compra en Resumen → Mis acciones y aquí verás cómo sube y baja tu portafolio día a día." />
      </Card>
    );
  }
  if (timeline.length === 0) {
    return (
      <Card>
        <EmptyState emoji="🌙" text={offline ? 'Sin conexión y sin precios guardados todavía.' : 'Los precios llegan con la corrida nocturna del robot; vuelve mañana y verás tus gráficas.'} />
      </Card>
    );
  }

  const last = timeline[timeline.length - 1];
  const gainPct = last.invested > 0 ? Math.round((last.gain / last.invested) * 1000) / 10 : null;
  const valueData = windowed.map((t) => ({ fecha: fmtDateShort(t.date), valor: t.value }));
  const gainData = windowed.map((t) => ({
    fecha: fmtDateShort(t.date),
    ganancia: t.gain,
    pos: Math.max(t.gain, 0),
    neg: Math.min(t.gain, 0),
  }));

  return (
    <div className="flex flex-col gap-3">
      <Card>
        {/* Encabezado: valor y ganancia en $ y % */}
        <div className="text-center">
          <p className="text-sm text-slate-500">Tu portafolio hoy</p>
          <p className="text-4xl font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>
            {fmtMoney(pf.currentValue)}
          </p>
          <p className={`text-sm font-semibold tabular-nums ${last.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {last.gain >= 0 ? '▲' : '▼'} {fmtMoney(Math.abs(last.gain))}{gainPct !== null ? ` (${last.gain >= 0 ? '+' : '−'}${Math.abs(gainPct)}%)` : ''} en total
          </p>
          {pf.pricesDate && (
            <p className="mt-0.5 text-xs text-slate-400">precios del {fmtDateShort(pf.pricesDate)}{offline ? ' · sin conexión' : ''}</p>
          )}
        </div>

        <div className="-mx-1 mt-2 flex justify-center gap-2 overflow-x-auto px-1 pb-1">
          {PERIODS.map((p) => (
            <Chip key={p.label} selected={period === p.days} onClick={() => setPeriod(p.days)}>{p.label}</Chip>
          ))}
        </div>

        {/* Valor del portafolio día a día */}
        <div className="mt-1 h-44">
          <ResponsiveContainer>
            <LineChart data={valueData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => fmtMoneyShort(v)} domain={['auto', 'auto']} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Line dataKey="valor" stroke="var(--accent)" strokeWidth={2} dot={false} name="valor" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Ganancia / pérdida en el tiempo */}
      <Card>
        <p className="mb-1 font-semibold">¿Cuánto voy ganando?</p>
        <p className="mb-1 text-xs text-slate-400">Valor + ventas − lo aportado. Verde arriba de cero, rojo abajo.</p>
        <div className="h-36">
          <ResponsiveContainer>
            <ComposedChart data={gainData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => fmtMoneyShort(v)} domain={['auto', 'auto']} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number, name: string) => (name === 'ganancia' ? [fmtMoney(v), 'ganancia'] : [null as unknown as string, ''])} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Area dataKey="pos" stroke="none" fill="#10b981" fillOpacity={0.25} name="pos" legendType="none" />
              <Area dataKey="neg" stroke="none" fill="#ef4444" fillOpacity={0.25} name="neg" legendType="none" />
              <Line dataKey="ganancia" stroke="var(--accent)" strokeWidth={2} dot={false} name="ganancia" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Comparativa entre acciones */}
      {compare.keys.length >= 2 && (
        <Card>
          <p className="mb-1 font-semibold">¿Cuál rinde mejor?</p>
          <p className="mb-1 text-xs text-slate-400">Cada posición en % desde su compra.</p>
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={compare.data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} tickFormatter={(d) => fmtDateShort(String(d))} />
                <YAxis tick={{ fontSize: 10 }} width={40} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(d) => fmtDateShort(String(d))} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {compare.keys.map((k, i) => (
                  <Line key={k} dataKey={k} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Posiciones: tocar una abre su gráfica individual */}
      <Card>
        <p className="mb-1 font-semibold">Tus posiciones</p>
        <p className="mb-1 text-xs text-slate-400">Toca una para ver su gráfica desde tu compra.</p>
        <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {[...app.stockPositions]
            .sort((a, b) => (a.soldDate ? 1 : 0) - (b.soldDate ? 1 : 0) || b.amountInvested - a.amountInvested)
            .map((p) => {
              const view = pf.positions.find((v) => v.position.id === p.id)!;
              return (
                <li key={p.id}>
                  <button className={`flex min-h-[44px] w-full items-center gap-2 py-1.5 text-left ${p.soldDate ? 'opacity-60' : ''}`} onClick={() => setPosSheet(p)}>
                    <span className="font-bold">{p.symbol}</span>
                    <span className="flex-1 text-xs text-slate-400">
                      {p.soldDate ? `vendida ${fmtDateShort(p.soldDate)}` : `desde ${fmtDateShort(p.buyDate)}`}
                    </span>
                    {view.gainPct !== null && (
                      <span className={`tabular-nums ${view.gain! >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {view.gain! >= 0 ? '+' : ''}{view.gainPct}%
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
        </ul>
      </Card>

      {posSheet && <PositionSheet position={posSheet} prices={prices} onClose={() => setPosSheet(null)} />}
    </div>
  );
}

/** Gráfica individual: precio desde la compra, con marca y línea de tu precio. */
export function PositionChart({ position, prices }: { position: StockPosition; prices: PricesFile | null }) {
  const series = prices?.tickers[position.symbol]?.series ?? [];
  const from = addDays(position.buyDate, -14);
  const to = position.soldDate ?? todayISO();
  const data = series
    .filter(([d]) => d >= from && d <= to)
    .map(([d, c]) => ({ date: d, precio: c }));
  if (data.length < 2) return null;
  const lastClose = data[data.length - 1].precio;
  const gain = position.shares * ((position.soldPrice ?? lastClose) - position.buyPrice);
  const gainPct = Math.round(((position.soldPrice ?? lastClose) / position.buyPrice - 1) * 1000) / 10;
  return (
    <div className="mb-3">
      <p className={`mb-1 text-center text-sm font-semibold tabular-nums ${gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
        {gain >= 0 ? '▲' : '▼'} {fmtMoney(Math.abs(gain))} ({gain >= 0 ? '+' : '−'}{Math.abs(gainPct)}%) desde tu compra
      </p>
      <div className="h-36">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} tickFormatter={(d) => fmtDateShort(String(d))} />
            <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => fmtMoneyShort(v)} domain={['auto', 'auto']} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => fmtMoney(v)} labelFormatter={(d) => fmtDateShort(String(d))} />
            <ReferenceLine y={position.buyPrice} stroke="#94a3b8" strokeDasharray="4 4" />
            <Line dataKey="precio" stroke="var(--accent)" strokeWidth={2} dot={false} name="precio" />
            <ReferenceDot x={position.buyDate} y={position.buyPrice} r={5} fill="var(--accent)" stroke="#fff" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-xs text-slate-400">
        ● tu compra ({fmtMoney(position.buyPrice)}/acción) · línea punteada = tu precio de entrada
      </p>
    </div>
  );
}
