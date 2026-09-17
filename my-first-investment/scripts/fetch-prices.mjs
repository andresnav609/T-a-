// Robot nocturno de precios: descarga los cierres diarios de los tickers de
// stocks/tickers.json desde Stooq (gratis, sin API key) y genera prices.json
// para que la app lo consuma. Lo corre GitHub Actions cada noche.
//
// Uso: node scripts/fetch-prices.mjs [salida.json] [anterior.json]
// Si un ticker falla, se conserva su serie del archivo anterior (si existe).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = process.argv[2] ?? join(here, '..', 'prices.json');
const prevPath = process.argv[3] ?? outPath;
const MAX_DAYS = 400; // ~1.5 años de días de mercado

const config = JSON.parse(readFileSync(join(here, '..', 'stocks', 'tickers.json'), 'utf8'));
const prev = existsSync(prevPath)
  ? (() => { try { return JSON.parse(readFileSync(prevPath, 'utf8')); } catch { return null; } })()
  : null;

async function fetchTicker(symbol) {
  // Stooq usa sufijo .us para acciones/ETFs de EE. UU.
  const url = `https://stooq.com/q/d/l/?s=${symbol.toLowerCase()}.us&i=d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'my-first-investment-price-bot' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const csv = await res.text();
  const lines = csv.trim().split('\n');
  if (lines.length < 2 || !lines[0].startsWith('Date,')) throw new Error(`CSV inválido: ${lines[0]?.slice(0, 40)}`);
  const series = [];
  for (const line of lines.slice(1)) {
    const [date, , , , close] = line.split(',');
    const c = parseFloat(close);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(c) && c > 0) {
      series.push([date, Math.round(c * 10000) / 10000]);
    }
  }
  if (series.length === 0) throw new Error('serie vacía');
  series.sort((a, b) => a[0].localeCompare(b[0]));
  return series.slice(-MAX_DAYS);
}

const out = { v: 1, updatedAt: new Date().toISOString(), tickers: {} };
let failures = 0;
for (const { symbol, name } of config.tickers) {
  try {
    const series = await fetchTicker(symbol);
    out.tickers[symbol] = { name, series };
    console.log(`✓ ${symbol}: ${series.length} días, último ${series[series.length - 1][0]} = ${series[series.length - 1][1]}`);
  } catch (err) {
    failures += 1;
    const kept = prev?.tickers?.[symbol];
    if (kept) {
      out.tickers[symbol] = kept;
      console.log(`⚠ ${symbol}: falló (${err.message}); conservo la serie anterior`);
    } else {
      console.log(`✗ ${symbol}: falló (${err.message}) y no hay serie anterior`);
    }
  }
  await new Promise((r) => setTimeout(r, 1200)); // no martillar la fuente
}

if (Object.keys(out.tickers).length === 0) {
  console.error('Ningún ticker disponible: no se escribe el archivo.');
  process.exit(1);
}
writeFileSync(outPath, JSON.stringify(out));
console.log(`Escrito ${outPath} con ${Object.keys(out.tickers).length} tickers (${failures} fallos).`);
