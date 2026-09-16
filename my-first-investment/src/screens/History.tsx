// Historial — sección 8.2: días del ciclo, selector de ciclos, dona por
// categoría, línea de arrastre, resúmenes semanales, filtros y calendario de racha.

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { useApp } from '../state/app';
import { Card, Chip, EmptyState, inputCls } from '../components/ui';
import { fmtMoney, fmtDateShort } from '../lib/format';
import { finishedDays } from '../lib/history';

export default function History() {
  const app = useApp();
  const [subtab, setSubtab] = useState<'ciclo' | 'resumenes' | 'calendario'>('ciclo');
  const [cycleIdx, setCycleIdx] = useState<number | null>(null); // null = actual
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const cycles = app.cycles;
  const cycle = cycleIdx === null ? cycles[cycles.length - 1] : cycles[cycleIdx];

  const cycleExpenses = useMemo(() => {
    if (!cycle) return [];
    return app.expenses
      .filter((e) => e.date >= cycle.start && e.date <= cycle.end)
      .filter((e) => !filterCat || e.categoryId === filterCat)
      .filter((e) => !search || (e.note ?? '').toLowerCase().includes(search.toLowerCase()));
  }, [app.expenses, cycle, filterCat, search]);

  const donutData = useMemo(() => {
    if (!cycle) return [];
    const byCat = new Map<string, number>();
    for (const e of app.expenses.filter((e) => e.date >= cycle.start && e.date <= cycle.end)) {
      byCat.set(e.categoryId, (byCat.get(e.categoryId) ?? 0) + e.amount);
    }
    return [...byCat.entries()]
      .map(([id, value]) => {
        const c = app.categories.find((x) => x.id === id);
        return { name: c ? `${c.emoji} ${c.name}` : 'Otros', value, color: c?.color ?? '#64748b' };
      })
      .sort((a, b) => b.value - a.value);
  }, [app.expenses, app.categories, cycle]);

  const carryLine = useMemo(
    () => (cycle?.days ?? []).map((d) => ({ date: fmtDateShort(d.date), arrastre: Math.round(d.carry * 100) / 100 })),
    [cycle],
  );

  const filteredTotal = cycleExpenses.reduce((s, e) => s + e.amount, 0);

  if (!cycle) return <EmptyState emoji="📅" text="Aún no hay historial: registra tu primer gasto en Hoy." />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {([['ciclo', 'Ciclo'], ['resumenes', 'Resúmenes'], ['calendario', 'Racha']] as const).map(([id, label]) => (
          <Chip key={id} selected={subtab === id} onClick={() => setSubtab(id)}>{label}</Chip>
        ))}
      </div>

      {subtab === 'ciclo' && (
        <>
          {/* Selector de ciclos */}
          <select
            className={inputCls}
            aria-label="Ciclo"
            value={cycleIdx === null ? 'current' : String(cycleIdx)}
            onChange={(e) => setCycleIdx(e.target.value === 'current' ? null : Number(e.target.value))}
          >
            {cycles.map((c, i) => (
              <option key={c.start} value={c.isCurrent ? 'current' : i}>
                {fmtDateShort(c.start)} – {fmtDateShort(c.end)}{c.isCurrent ? ' (actual)' : ''}
              </option>
            )).reverse()}
          </select>

          {/* Resumen del ciclo */}
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><p className="text-slate-400">Gastado</p><p className="font-bold tabular-nums">{fmtMoney(cycle.totalSpent)}</p></div>
              <div><p className="text-slate-400">Ingresos extra</p><p className="font-bold tabular-nums">{fmtMoney(cycle.totalExtraIncome)}</p></div>
              <div>
                <p className="text-slate-400">Arrastre</p>
                <p className={`font-bold tabular-nums ${cycle.finalCarry < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{fmtMoney(cycle.finalCarry)}</p>
              </div>
            </div>
          </Card>

          {donutData.length > 0 && (
            <Card>
              <p className="mb-2 font-semibold">Por categoría</p>
              <div className="h-48">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} strokeWidth={0}>
                      {donutData.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-1 grid grid-cols-2 gap-1 text-xs">
                {donutData.map((d) => (
                  <li key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="flex-1 truncate">{d.name}</span>
                    <span className="tabular-nums text-slate-500">{fmtMoney(d.value)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {carryLine.length > 1 && (
            <Card>
              <p className="mb-2 font-semibold">Arrastre día a día</p>
              <div className="h-40">
                <ResponsiveContainer>
                  <LineChart data={carryLine} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={44} />
                    <Tooltip formatter={(v: number) => fmtMoney(v)} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="arrastre" stroke="#10b981" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Días del ciclo con semáforo */}
          <Card>
            <p className="mb-2 font-semibold">Días del ciclo</p>
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {[...cycle.days].reverse().map((d) => (
                <li key={d.date} className="flex items-center gap-2 py-2">
                  <span aria-label={d.carry >= 0 ? 'Bajo el límite' : 'Sobre el límite'}>
                    {d.date === app.today ? '🔵' : d.carry >= 0 ? '🟢' : '🔴'}
                  </span>
                  <span className="w-16">{fmtDateShort(d.date)}</span>
                  <span className="flex-1 text-right tabular-nums text-slate-400">lím {fmtMoney(d.baseLimit)}</span>
                  <span className="w-20 text-right tabular-nums">-{fmtMoney(d.spent)}</span>
                  <span className={`w-20 text-right font-semibold tabular-nums ${d.carry < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {fmtMoney(d.carry)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Filtro y búsqueda */}
          <Card>
            <p className="mb-2 font-semibold">Gastos del ciclo</p>
            <input
              className={`${inputCls} mb-2`}
              placeholder="Buscar por nota…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar por nota"
            />
            <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
              <Chip selected={filterCat === null} onClick={() => setFilterCat(null)}>Todas</Chip>
              {app.categories.filter((c) => c.kind === 'expense' && !c.archived).map((c) => (
                <Chip key={c.id} selected={filterCat === c.id} onClick={() => setFilterCat(filterCat === c.id ? null : c.id)} color={c.color}>
                  {c.emoji} {c.name}
                </Chip>
              ))}
            </div>
            {cycleExpenses.length === 0 ? (
              <EmptyState emoji="🔍" text="Sin resultados con este filtro." />
            ) : (
              <>
                <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                  {[...cycleExpenses].reverse().map((e) => {
                    const c = app.categories.find((x) => x.id === e.categoryId);
                    return (
                      <li key={e.id} className="flex items-center gap-2 py-2">
                        <span aria-hidden>{c?.emoji ?? '📦'}</span>
                        <div className="flex-1">
                          <p>{c?.name ?? 'Gasto'}{e.note ? ` · ${e.note}` : ''}</p>
                          <p className="text-xs text-slate-400">{fmtDateShort(e.date)}</p>
                        </div>
                        <span className="font-semibold tabular-nums">-{fmtMoney(e.amount)}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-right text-sm font-semibold tabular-nums text-slate-500">Total: {fmtMoney(filteredTotal)}</p>
              </>
            )}
          </Card>
        </>
      )}

      {subtab === 'resumenes' && <WeeklyList />}
      {subtab === 'calendario' && <StreakCalendar />}
    </div>
  );
}

function WeeklyList() {
  const app = useApp();
  const items = [...app.weeklySummaries].reverse();
  if (items.length === 0) return <EmptyState emoji="📊" text="Los resúmenes semanales aparecerán aquí cada semana." />;
  return (
    <div className="flex flex-col gap-3">
      {items.map((w) => (
        <Card key={w.id}>
          <p className="mb-1 font-semibold">{fmtDateShort(w.weekStart)} – {fmtDateShort(w.weekEnd)}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <p className="text-slate-400">Gastado</p><p className="text-right tabular-nums">{fmtMoney(w.data.spent)}</p>
            <p className="text-slate-400">Límite</p><p className="text-right tabular-nums">{fmtMoney(w.data.weekLimit)}</p>
            <p className="text-slate-400">Diferencia</p>
            <p className={`text-right font-semibold tabular-nums ${w.data.difference >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmtMoney(w.data.difference)}</p>
            <p className="text-slate-400">Días bajo límite</p><p className="text-right">{w.data.daysUnderLimit} de 7</p>
            {w.data.topCategory && (<><p className="text-slate-400">Top categoría</p><p className="text-right">{w.data.topCategory.emoji} {w.data.topCategory.name} ({w.data.topCategory.pct}%)</p></>)}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Calendario de racha estilo mapa de contribuciones. */
function StreakCalendar() {
  const app = useApp();
  const days = useMemo(() => {
    if (!app.profile) return [];
    return finishedDays(app.cycles, app.profile.pactStartDate, app.today);
  }, [app.cycles, app.profile, app.today]);
  if (days.length === 0) return <EmptyState emoji="🗓️" text="Tu calendario de racha se irá pintando día a día." />;

  const byDate = new Map(days.map((d) => [d.date, d.carry >= 0]));
  const first = days[0].date;
  // Rejilla semanal: columnas = semanas, filas = día de la semana.
  const start = new Date(first + 'T00:00');
  start.setDate(start.getDate() - start.getDay());
  const cells: { date: string; ok: boolean | null }[] = [];
  const cursor = new Date(start);
  const todayD = new Date(app.today + 'T00:00');
  while (cursor <= todayD) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    cells.push({ date: iso, ok: byDate.has(iso) ? byDate.get(iso)! : null });
    cursor.setDate(cursor.getDate() + 1);
  }
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <Card>
      <p className="mb-1 font-semibold">Calendario de racha</p>
      <p className="mb-3 text-xs text-slate-400">🟩 bajo el límite · 🟥 sobre el límite</p>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, i) => (
          <div key={i} className="flex flex-col gap-1">
            {week.map((c) => (
              <div
                key={c.date}
                title={c.date}
                className={`h-4 w-4 rounded-sm ${
                  c.ok === null ? 'bg-slate-100 dark:bg-slate-800' : c.ok ? 'bg-emerald-500' : 'bg-red-400'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        Racha actual: <strong>{app.streak.current}</strong> · Mejor: <strong>{app.streak.best}</strong>
      </p>
    </Card>
  );
}
