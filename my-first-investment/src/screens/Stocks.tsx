// Mis acciones: posiciones locales (privadas) × precios de cierre publicados
// cada noche por el workflow en prices.json. Separado de Mi plata: muestra
// "de tu bolsillo" vs "valor hoy", sin tocar la cuenta de banco.

import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../state/app';
import { Card, Button, Sheet, Field, NumberInput, EmptyState, inputCls, useConfirm } from '../components/ui';
import { fmtMoney, fmtMoneyShort, fmtDateShort, timeAgo } from '../lib/format';
import { buildPortfolio, priceOn, parsePricesFile } from '../lib/stocks';
import { todayISO } from '../lib/dates';
import type { PricesFile, StockPosition } from '../lib/types';

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
