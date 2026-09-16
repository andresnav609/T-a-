// Historial — sección 8.2: días del ciclo, selector de ciclos, dona por
// categoría, línea de arrastre, resúmenes semanales, filtros y calendario de racha.

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { useApp } from '../state/app';
import { Card, Chip, EmptyState, inputCls } from '../components/ui';
import { ExpenseSheet } from '../components/ExpenseSheet';
import { fmtMoney, fmtDate, fmtDateShort, weekdayName } from '../lib/format';
import { toISODate } from '../lib/dates';
import type { Expense, ExtraIncome } from '../lib/types';

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
        {([['ciclo', 'Ciclo'], ['resumenes', 'Resúmenes'], ['calendario', 'Calendario']] as const).map(([id, label]) => (
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
      {subtab === 'calendario' && <MonthCalendar />}
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

/** Calendario mensual interactivo: toca un día para ver todo lo de ese día.
 *  Los colores siguen la racha (verde = bajo el límite, rojo = sobre). */
function MonthCalendar() {
  const app = useApp();
  const todayD = new Date(app.today + 'T00:00');
  const [month, setMonth] = useState(() => new Date(todayD.getFullYear(), todayD.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(app.today);
  const [editSheet, setEditSheet] = useState<null | { kind: 'expense' | 'income'; editing: Expense | ExtraIncome }>(null);

  const dayByDate = useMemo(() => {
    const m = new Map<string, { carry: number; baseLimit: number; spent: number; available: number }>();
    for (const c of app.cycles) for (const d of c.days) m.set(d.date, d);
    return m;
  }, [app.cycles]);

  // Rejilla del mes: celdas vacías hasta el primer día + días del mes.
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (string | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      out.push(toISODate(new Date(month.getFullYear(), month.getMonth(), d)));
    }
    return out;
  }, [month]);

  const isCurrentMonth = month.getFullYear() === todayD.getFullYear() && month.getMonth() === todayD.getMonth();
  const monthLabel = month.toLocaleDateString('es', { month: 'long', year: 'numeric' });

  const sel = selected ? dayByDate.get(selected) : undefined;
  const selExpenses = selected ? app.expenses.filter((e) => e.date === selected) : [];
  const selIncomes = selected ? app.extraIncomes.filter((e) => e.date === selected) : [];
  const selInvestments = selected ? app.investments.filter((i) => i.date === selected) : [];
  const selCash = selected ? app.cashEvents.filter((e) => e.at.slice(0, 10) === selected && e.kind !== 'set') : [];
  const catById = (id: string) => app.categories.find((c) => c.id === id);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <button aria-label="Mes anterior" className="h-11 w-11 rounded-full text-lg text-slate-500"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <p className="font-semibold capitalize">{monthLabel}</p>
          <button aria-label="Mes siguiente" disabled={isCurrentMonth}
            className="h-11 w-11 rounded-full text-lg text-slate-500 disabled:opacity-20"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-xs text-slate-400">
          {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <span key={`x${i}`} />;
            const info = dayByDate.get(date);
            const isToday = date === app.today;
            const finished = !!info && date < app.today;
            const bg = !info
              ? 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'
              : isToday
                ? 'text-white'
                : finished
                  ? info.carry >= 0 ? 'bg-emerald-500/90 text-white' : 'bg-red-400/90 text-white'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800';
            return (
              <button
                key={date}
                onClick={() => setSelected(date)}
                aria-label={`Ver día ${date}`}
                style={isToday ? { backgroundColor: 'var(--accent)' } : undefined}
                className={`flex h-10 items-center justify-center rounded-lg text-sm font-medium ${bg} ${
                  selected === date ? 'ring-2 ring-slate-900 ring-offset-1 dark:ring-white dark:ring-offset-slate-950' : ''
                }`}
              >
                {Number(date.slice(8))}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          🟩 bajo el límite · 🟥 sobre el límite · Racha actual: <strong>{app.streak.current}</strong> · Mejor: <strong>{app.streak.best}</strong>
        </p>
      </Card>

      {selected && (
        <Card>
          <p className="mb-0.5 font-semibold capitalize">
            {weekdayName(new Date(selected + 'T00:00').getDay())} {fmtDate(selected)}
            {selected === app.today ? ' · hoy' : ''}
          </p>
          {sel ? (
            <>
              <p className="mb-2 text-xs text-slate-400">
                {selected < app.today ? (sel.carry >= 0 ? '🟢 Terminó bajo el límite' : '🔴 Terminó sobre el límite') : '🔵 En curso'}
              </p>
              <div className="mb-2 grid grid-cols-4 gap-1 text-center text-xs">
                <div className="rounded-lg bg-slate-50 p-1.5 dark:bg-slate-800"><p className="text-slate-400">Límite</p><p className="font-semibold tabular-nums">{fmtMoney(sel.baseLimit)}</p></div>
                <div className="rounded-lg bg-slate-50 p-1.5 dark:bg-slate-800"><p className="text-slate-400">Disponible</p><p className="font-semibold tabular-nums">{fmtMoney(sel.available)}</p></div>
                <div className="rounded-lg bg-slate-50 p-1.5 dark:bg-slate-800"><p className="text-slate-400">Gastado</p><p className="font-semibold tabular-nums">{fmtMoney(sel.spent)}</p></div>
                <div className="rounded-lg bg-slate-50 p-1.5 dark:bg-slate-800"><p className="text-slate-400">Arrastre</p><p className={`font-semibold tabular-nums ${sel.carry < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{fmtMoney(sel.carry)}</p></div>
              </div>
            </>
          ) : (
            <p className="mb-2 text-sm text-slate-400">Sin datos: {selected > app.today ? 'todavía no llega ese día.' : 'es anterior al inicio del pacto.'}</p>
          )}

          {selExpenses.length + selIncomes.length + selInvestments.length + selCash.length === 0 ? (
            sel && <p className="text-sm text-slate-400">Sin movimientos ese día.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {selIncomes.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2">
                  <span aria-hidden>{catById(e.categoryId)?.emoji ?? '💵'}</span>
                  <button className="min-h-[44px] flex-1 text-left" onClick={() => setEditSheet({ kind: 'income', editing: e })}>
                    {catById(e.categoryId)?.name ?? 'Ingreso'}{e.note ? ` · ${e.note}` : ''}
                  </button>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{fmtMoney(e.amount)}</span>
                </li>
              ))}
              {selExpenses.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2">
                  <span aria-hidden>{catById(e.categoryId)?.emoji ?? '📦'}</span>
                  <button className="min-h-[44px] flex-1 text-left" onClick={() => setEditSheet({ kind: 'expense', editing: e })}>
                    {catById(e.categoryId)?.name ?? 'Gasto'}{e.note ? ` · ${e.note}` : ''}
                  </button>
                  <span className="font-semibold tabular-nums">-{fmtMoney(e.amount)}</span>
                </li>
              ))}
              {selInvestments.map((i) => (
                <li key={i.id} className="flex items-center gap-2 py-2">
                  <span aria-hidden>📈</span>
                  <span className="flex-1">{i.source === 'monthly_close' ? 'Inversión (cierre de mes)' : 'Inversión'}{i.note ? ` · ${i.note}` : ''}</span>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(i.amount)}</span>
                </li>
              ))}
              {selCash.map((e) => (
                <li key={e.id} className="flex items-center gap-2 py-2">
                  <span aria-hidden>{e.kind === 'salary' ? '💼' : e.amount >= 0 ? '⬆️' : '⬇️'}</span>
                  <span className="flex-1">{e.kind === 'salary' ? 'Pago del trabajo' : e.note ?? (e.amount >= 0 ? 'Depósito' : 'Retiro')}</span>
                  <span className="font-semibold tabular-nums">{e.amount >= 0 ? '+' : ''}{fmtMoney(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {editSheet && (
        <ExpenseSheet key={editSheet.editing.id} open kind={editSheet.kind} editing={editSheet.editing} onClose={() => setEditSheet(null)} />
      )}
    </div>
  );
}
