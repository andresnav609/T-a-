// "Tu futuro": predicciones locales para la pestaña Plata.
// Gráfico de abanico (p10–p90), número con rango, cierre del ciclo,
// cruce con metas e insights de tendencias.

import { useMemo, useState } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../state/app';
import { Card, Chip, NumberInput } from '../components/ui';
import { fmtMoney, fmtMoneyShort, fmtDateShort, fmtDate } from '../lib/format';
import { forecast, daysToTarget, buildSpendModel, buildInsights, type ForecastInput } from '../lib/forecast';
import { finishedDays } from '../lib/history';
import { closeSuggestion } from '../lib/budget';
import { addDays, diffDays, parseISO } from '../lib/dates';

const HORIZONS: { label: string; days: number }[] = [
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 91 },
  { label: '6 meses', days: 182 },
  { label: '1 año', days: 365 },
];

export function ForecastSection() {
  const app = useApp();
  const [horizon, setHorizon] = useState(91);
  const [customMonths, setCustomMonths] = useState(24);
  const [useCustom, setUseCustom] = useState(false);
  const [returnPct, setReturnPct] = useState(10);

  const days = useMemo(
    () => (app.profile ? finishedDays(app.cycles, app.profile.pactStartDate, app.today) : []),
    [app.cycles, app.profile, app.today],
  );

  const input: Omit<ForecastInput, 'horizonDays'> | null = useMemo(() => {
    if (app.cashBalance === null) return null;
    const s = app.settings;
    // Pago recurrente: lo observado en los eventos 'salary' manda; si no hay,
    // el monto configurado; si tampoco, el salario mensual repartido semanal.
    const salaryEvents = app.cashEvents.filter((e) => e.kind === 'salary').slice(-4);
    let weeklyPay: { amount: number; weekday: number } | null = null;
    if (salaryEvents.length > 0) {
      const amount = salaryEvents.reduce((x, e) => x + e.amount, 0) / salaryEvents.length;
      const wds = salaryEvents.map((e) => new Date(e.at).getDay());
      const weekday = wds.sort((a, b) => wds.filter((x) => x === a).length - wds.filter((x) => x === b).length).pop()!;
      weeklyPay = { amount, weekday };
    } else if (s.cash.weeklyPay) {
      weeklyPay = { amount: s.cash.weeklyPay, weekday: s.cash.reconcileDay };
    } else if (s.salary > 0) {
      weeklyPay = { amount: (s.salary * 12) / 52, weekday: s.cash.reconcileDay };
    }
    const cutoff = addDays(app.today, -56);
    const extraIncomeWeeklyMean =
      app.extraIncomes.filter((e) => e.date >= cutoff).reduce((x, e) => x + e.amount, 0) / 8;
    const closes = app.monthCloses.slice(-3);
    const monthlyInvestment = closes.length > 0
      ? closes.reduce((x, c) => x + c.confirmedInvestment, 0) / closes.length
      : s.suggestionIncludes.savingsGoal ? s.savingsGoal : 0;
    return {
      history: days.map((d) => ({ date: d.date, spent: d.spent })),
      startCash: app.cashBalance,
      startInvested: app.totalInvested,
      weeklyPay,
      extraIncomeWeeklyMean,
      monthlyInvestment,
      investDayOfMonth: s.cycleStartDay,
      annualReturnPct: returnPct,
      fallbackDailySpend: app.todayComp?.baseLimit ?? Math.max((s.salary - s.savingsGoal) / 30, 0),
      today: app.today,
    };
  }, [app.cashBalance, app.totalInvested, app.cashEvents, app.extraIncomes, app.monthCloses, app.settings, days, app.today, app.todayComp, returnPct]);

  const horizonDays = useCustom ? Math.max(30, Math.round(customMonths * 30.4)) : horizon;
  const result = useMemo(
    () => (input ? forecast({ ...input, horizonDays, seed: 12345 }) : null),
    [input, horizonDays],
  );

  // Cierre del ciclo: arrastre esperado con el modelo de gasto (± incertidumbre).
  const cycleForecast = useMemo(() => {
    const cc = app.currentCycle;
    const t = app.todayComp;
    if (!cc || !t || !input) return null;
    const model = buildSpendModel(input.history, input.fallbackDailySpend);
    const remaining = diffDays(app.today, cc.end);
    if (remaining <= 0) return null;
    let carry = t.carry; // lo que queda hoy
    let variance = 0;
    const cur = parseISO(app.today);
    for (let d = 1; d <= remaining; d++) {
      cur.setDate(cur.getDate() + 1);
      const wd = cur.getDay();
      carry += t.baseLimit - Math.max(model.weekdayMean[wd] + model.trendPerDay * d, 0);
      variance += model.weekdaySd[wd] ** 2;
    }
    const sd = Math.sqrt(variance);
    const investable = closeSuggestion(carry, cc.totalExtraIncome, app.settings);
    return { carry, low: carry - 1.28 * sd, high: carry + 1.28 * sd, investable, remaining };
  }, [app.currentCycle, app.todayComp, input, app.today, app.settings]);

  // Metas de inversión: fecha estimada de cruce (patrimonio esperado).
  const goalEtas = useMemo(() => {
    if (!input) return [];
    return app.goals
      .filter((g) => g.status === 'active' && g.type === 'total_invested')
      .map((g) => {
        const d = daysToTarget(input, g.target);
        const dSaving = daysToTarget(input, g.target, 2);
        return { goal: g, days: d, daysSaving2: dSaving };
      });
  }, [app.goals, input]);

  const insights = useMemo(() => {
    if (!app.profile) return [];
    const cycles = app.cycles;
    const cur = cycles[cycles.length - 1];
    const prev = cycles[cycles.length - 2];
    const byCat = (start: string, end: string) => {
      const m = new Map<string, number>();
      for (const e of app.expenses.filter((e) => e.date >= start && e.date <= end)) {
        m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + e.amount);
      }
      return m;
    };
    const categorySpend = !cur || !prev ? [] : app.categories
      .filter((c) => c.kind === 'expense')
      .map((c) => ({
        name: c.name,
        emoji: c.emoji,
        current: byCat(cur.start, cur.end).get(c.id) ?? 0,
        previous: byCat(prev.start, prev.end).get(c.id) ?? 0,
      }));
    return buildInsights({
      history: days.map((d) => ({ date: d.date, spent: d.spent, carry: d.carry })),
      categorySpend,
    });
  }, [app.profile, app.cycles, app.expenses, app.categories, days]);

  if (!result || !input) return null;

  const chart = result.points.map((p) => ({
    fecha: fmtDateShort(p.date),
    banda: [p.cash.p10, p.cash.p90] as [number, number],
    probable: p.cash.p50,
  }));
  const f = result.final;
  const horizonLabel = useCustom
    ? `${customMonths} meses`
    : HORIZONS.find((h) => h.days === horizon)?.label ?? `${horizonDays} días`;
  const confidenceLabel = {
    config: '🌱 Predicción inicial basada en tu configuración — mejora cuando registres más días.',
    learning: `📚 Aprendiendo de ti: ${result.daysOfData} días de datos. Cada semana afina el cálculo.`,
    solid: `✅ Basada en ${result.daysOfData} días de tus datos reales.`,
  }[result.confidence];

  return (
    <Card>
      <p className="mb-1 font-semibold">🔮 Tu futuro</p>
      <p className="mb-2 text-xs text-slate-400">{confidenceLabel}</p>

      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {HORIZONS.map((h) => (
          <Chip key={h.days} selected={!useCustom && horizon === h.days} onClick={() => { setUseCustom(false); setHorizon(h.days); }}>
            {h.label}
          </Chip>
        ))}
        <Chip selected={useCustom} onClick={() => setUseCustom(true)}>Otro…</Chip>
      </div>
      {useCustom && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <span className="w-24"><NumberInput value={customMonths} onChange={(n) => setCustomMonths(Math.max(1, Math.round(n)))} min={1} max={120} step="1" ariaLabel="Meses personalizados" /></span>
          <span>meses</span>
        </label>
      )}

      {/* El número: plata probable con rango honesto */}
      <div className="mb-1 text-center">
        <p className="text-sm text-slate-500">En {horizonLabel} tendrías</p>
        <p className={`text-4xl font-extrabold tabular-nums ${f.cash.p50 < 0 ? 'text-red-500' : ''}`}
          style={f.cash.p50 >= 0 ? { color: 'var(--accent)' } : undefined}>
          ~{fmtMoney(f.cash.p50)}
        </p>
        <p className="text-xs text-slate-400">entre {fmtMoney(f.cash.p10)} y {fmtMoney(f.cash.p90)}</p>
        <p className="mt-1 text-sm">
          Patrimonio total (con inversiones): <strong className="tabular-nums">~{fmtMoney(f.patrimonio.p50)}</strong>
          <span className="text-xs text-slate-400"> ({fmtMoney(f.patrimonio.p10)}–{fmtMoney(f.patrimonio.p90)})</span>
        </p>
      </div>
      {f.cash.p10 < 0 && f.cash.p50 >= 0 && (
        <p className="mb-1 text-center text-xs text-amber-600 dark:text-amber-400">
          ⚠️ En el escenario pesimista tu plata llega a negativo: un colchón te daría margen.
        </p>
      )}

      {/* Abanico: línea probable + banda p10–p90 */}
      <div className="h-44">
        <ResponsiveContainer>
          <ComposedChart data={chart} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => fmtMoneyShort(v)} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(v: number | [number, number], name: string) =>
                Array.isArray(v) ? [`${fmtMoney(v[0])} – ${fmtMoney(v[1])}`, 'rango'] : [fmtMoney(v), name]}
            />
            <Area dataKey="banda" stroke="none" fill="var(--accent)" fillOpacity={0.18} name="rango" />
            <Line dataKey="probable" stroke="var(--accent)" strokeWidth={2} dot={false} name="probable" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <label className="mt-1 flex items-center justify-end gap-1 text-xs text-slate-400">
        retorno anual de inversiones:
        <span className="w-16"><NumberInput value={returnPct} onChange={setReturnPct} min={0} max={30} ariaLabel="Retorno anual" /></span>%
      </label>

      {/* Cierre del ciclo actual */}
      {cycleForecast && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p className="font-semibold">📆 Este ciclo ({cycleForecast.remaining} días restantes)</p>
          <p className="mt-1">
            A tu ritmo terminarías con{' '}
            <strong className={`tabular-nums ${cycleForecast.carry < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              ~{fmtMoney(cycleForecast.carry)}
            </strong>{' '}
            de arrastre <span className="text-xs text-slate-400">({fmtMoney(cycleForecast.low)} a {fmtMoney(cycleForecast.high)})</span>
            {' '}y podrías invertir <strong className="tabular-nums">~{fmtMoney(cycleForecast.investable)}</strong>.
          </p>
        </div>
      )}

      {/* Metas */}
      {goalEtas.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p className="mb-1 font-semibold">🎯 Tus metas, a este ritmo</p>
          {goalEtas.map(({ goal, days: d, daysSaving2 }) => (
            <p key={goal.id} className="py-0.5">
              <strong>{goal.name}</strong>:{' '}
              {d === null ? (
                'más de 10 años — sube tu ahorro o tu inversión mensual.'
              ) : (
                <>
                  llegarías el <strong>{fmtDate(addDays(app.today, d))}</strong>
                  {daysSaving2 !== null && daysSaving2 < d && (
                    <span className="text-xs text-slate-500"> · gastando $2 menos al día: {fmtDate(addDays(app.today, daysSaving2))}</span>
                  )}
                </>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p className="mb-1 font-semibold">🧠 Tus tendencias</p>
          {insights.map((x, i) => (
            <p key={i} className="py-0.5">{x.emoji} {x.text}</p>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-snug text-slate-400">
        Calculado en tu celular con tus datos (nada sale de tu dispositivo), simulando 400 futuros
        posibles con tu patrón real de gastos e ingresos. Es una estimación, no una promesa.
      </p>
    </Card>
  );
}
