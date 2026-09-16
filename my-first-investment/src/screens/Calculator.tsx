// Calculadora — secciones 8.4 y 9. Modos: Proyección, Comparar, Meta y Pacto.

import { useMemo, useState } from 'react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useApp } from '../state/app';
import { Card, Chip, Field, NumberInput, Button, inputCls } from '../components/ui';
import { fmtMoney, fmtMoneyShort } from '../lib/format';
import {
  project, requiredContribution, yearsToGoal,
  CONTRIBUTIONS_PER_YEAR,
  type ContributionFrequency, type Compounding, type ProjectionInput,
} from '../lib/investment';
import { GoalSheet } from './Investments';

type Mode = 'proyeccion' | 'comparar' | 'meta' | 'pacto';

const FREQS: { id: ContributionFrequency; label: string }[] = [
  { id: 'daily', label: 'Diaria' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'biweekly', label: 'Quincenal' },
  { id: 'monthly', label: 'Mensual' },
  { id: 'quarterly', label: 'Trimestral' },
  { id: 'yearly', label: 'Anual' },
];
const COMPS: { id: Compounding; label: string }[] = [
  { id: 'daily', label: 'Diaria' },
  { id: 'monthly', label: 'Mensual' },
  { id: 'quarterly', label: 'Trimestral' },
  { id: 'yearly', label: 'Anual' },
];

export default function Calculator() {
  const app = useApp();
  const [mode, setMode] = useState<Mode>('proyeccion');

  // Entradas comunes — todos los campos editables (defaults de la spec).
  const [principal, setPrincipal] = useState(1000);
  const [contribution, setContribution] = useState(300);
  const [freq, setFreq] = useState<ContributionFrequency>('monthly');
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(10);
  const [compounding, setCompounding] = useState<Compounding>('monthly');
  const [timing, setTiming] = useState<'end' | 'begin'>('end');
  const [useInflation, setUseInflation] = useState(false);
  const [inflation, setInflation] = useState(3);
  const [growth, setGrowth] = useState(0);
  // Modo comparar
  const [rates, setRates] = useState<number[]>(app.settings.defaultRates);
  const [newRate, setNewRate] = useState(12);
  // Modo meta
  const [goalAmount, setGoalAmount] = useState(100000);
  const [inverse, setInverse] = useState(false);
  const [goalSheet, setGoalSheet] = useState<{ target: number } | null>(null);
  // Modo pacto
  const [includePartner, setIncludePartner] = useState(false);

  const base: ProjectionInput = {
    principal, contribution, contributionFreq: freq, years, annualRatePct: rate,
    compounding, timing,
    inflationPct: useInflation ? inflation : undefined,
    contributionGrowthPct: growth,
  };

  const useMyData = () => {
    setPrincipal(app.totalInvested);
    setContribution(Math.max(app.monthlyInvestAvg, 0));
    setFreq('monthly');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {([['proyeccion', 'Proyección'], ['comparar', 'Comparar'], ['meta', 'Meta'], ['pacto', 'Pacto']] as const).map(([id, label]) => (
          <Chip key={id} selected={mode === id} onClick={() => setMode(id)}>{label}</Chip>
        ))}
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold">Datos</p>
          <Button variant="ghost" onClick={useMyData}>Usar mis datos</Button>
        </div>
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Monto inicial"><NumberInput value={principal} onChange={setPrincipal} min={0} ariaLabel="Monto inicial" /></Field>
          {mode !== 'meta' || inverse ? (
            <Field label="Aporte periódico"><NumberInput value={contribution} onChange={setContribution} min={0} ariaLabel="Aporte" /></Field>
          ) : (
            <Field label="Monto meta"><NumberInput value={goalAmount} onChange={setGoalAmount} min={1} ariaLabel="Meta" /></Field>
          )}
          <Field label="Frecuencia del aporte">
            <select className={inputCls} value={freq} onChange={(e) => setFreq(e.target.value as ContributionFrequency)} aria-label="Frecuencia">
              {FREQS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          {mode === 'meta' && inverse ? (
            <Field label="Monto meta"><NumberInput value={goalAmount} onChange={setGoalAmount} min={1} ariaLabel="Meta" /></Field>
          ) : (
            <Field label="Años"><NumberInput value={years} onChange={(n) => setYears(Math.max(1, Math.round(n)))} min={1} max={80} step="1" ariaLabel="Años" /></Field>
          )}
          {mode !== 'comparar' && (
            <Field label="Tasa anual (%)"><NumberInput value={rate} onChange={setRate} min={0} ariaLabel="Tasa anual" /></Field>
          )}
          <Field label="Capitalización">
            <select className={inputCls} value={compounding} onChange={(e) => setCompounding(e.target.value as Compounding)} aria-label="Capitalización">
              {COMPS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Momento del aporte">
            <select className={inputCls} value={timing} onChange={(e) => setTiming(e.target.value as 'end' | 'begin')} aria-label="Momento del aporte">
              <option value="end">Final del período</option>
              <option value="begin">Inicio del período</option>
            </select>
          </Field>
          <Field label="Crecimiento anual del aporte (%)"><NumberInput value={growth} onChange={setGrowth} min={0} ariaLabel="Crecimiento del aporte" /></Field>
        </div>
        <label className="flex min-h-[44px] items-center gap-2">
          <input type="checkbox" className="h-5 w-5 accent-emerald-500" checked={useInflation} onChange={(e) => setUseInflation(e.target.checked)} />
          <span className="text-sm">Ajustar por inflación anual de</span>
          <span className="w-20"><NumberInput value={inflation} onChange={setInflation} min={0} ariaLabel="Inflación" /></span>
          <span className="text-sm">%</span>
        </label>
      </Card>

      {mode === 'proyeccion' && <ProjectionMode input={base} />}
      {mode === 'comparar' && (
        <CompareMode input={base} rates={rates} setRates={setRates} newRate={newRate} setNewRate={setNewRate} />
      )}
      {mode === 'meta' && (
        <GoalMode
          input={base} goal={goalAmount} inverse={inverse} setInverse={setInverse}
          onCreateGoal={() => setGoalSheet({ target: goalAmount })}
        />
      )}
      {mode === 'pacto' && (
        <PactMode input={base} includePartner={includePartner} setIncludePartner={setIncludePartner} />
      )}

      {goalSheet && (
        <GoalSheet
          onClose={() => setGoalSheet(null)}
          prefill={{ name: `Llegar a ${fmtMoney(goalSheet.target)}`, type: 'total_invested', target: goalSheet.target }}
        />
      )}
    </div>
  );
}

function ProjectionMode({ input }: { input: ProjectionInput }) {
  const r = useMemo(() => project(input), [input]);
  const chart = r.yearly.map((y) => ({ año: y.year, Aportado: y.contributed, Intereses: Math.max(y.interest, 0) }));
  const [showTable, setShowTable] = useState(false);
  return (
    <>
      <Card>
        <div className="grid grid-cols-2 gap-2 text-center">
          <Big label="Valor final" value={fmtMoney(r.finalValue)} highlight />
          <Big label="Total aportado" value={fmtMoney(r.totalContributed)} />
          <Big label="Ganancia" value={fmtMoney(r.totalInterest)} />
          <Big label="Multiplicador" value={`×${r.multiplier}`} />
          {r.realValue !== null && <Big label="Valor real (hoy)" value={fmtMoney(r.realValue)} />}
        </div>
      </Card>
      <Card>
        <p className="mb-2 font-semibold">Aportado vs intereses</p>
        <div className="h-52">
          <ResponsiveContainer>
            <AreaChart data={chart} margin={{ left: 0, right: 8, top: 4 }}>
              <XAxis dataKey="año" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => fmtMoneyShort(v)} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Area type="monotone" dataKey="Aportado" stackId="1" stroke="#3b82f6" fill="#3b82f680" />
              <Area type="monotone" dataKey="Intereses" stackId="1" stroke="#10b981" fill="#10b98180" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <button className="min-h-[44px] w-full text-left font-semibold" onClick={() => setShowTable(!showTable)}>
          Tabla año por año {showTable ? '▲' : '▼'}
        </button>
        {showTable && (
          <table className="mt-2 w-full text-right text-sm tabular-nums">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1 text-left font-medium">Año</th>
                <th className="font-medium">Aportado</th>
                <th className="font-medium">Intereses</th>
                <th className="font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {r.yearly.map((y) => (
                <tr key={y.year} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1 text-left">{y.year}</td>
                  <td>{fmtMoneyShort(y.contributed)}</td>
                  <td>{fmtMoneyShort(y.interest)}</td>
                  <td className="font-semibold">{fmtMoneyShort(y.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

const LINE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];

function CompareMode({ input, rates, setRates, newRate, setNewRate }: {
  input: ProjectionInput;
  rates: number[];
  setRates: (r: number[]) => void;
  newRate: number;
  setNewRate: (n: number) => void;
}) {
  const results = useMemo(
    () => rates.map((r) => ({ rate: r, res: project({ ...input, annualRatePct: r }) })),
    [rates, input],
  );
  const chart = useMemo(() => {
    const yearsList = results[0]?.res.yearly.map((y) => y.year) ?? [];
    return yearsList.map((year) => {
      const row: Record<string, number> = { año: year };
      for (const { rate, res } of results) {
        row[`${rate}%`] = res.yearly.find((y) => y.year === year)?.value ?? 0;
      }
      return row;
    });
  }, [results]);
  const milestones = [5, 10, 15, 20].filter((m) => m <= input.years);

  return (
    <>
      <Card>
        <p className="mb-2 font-semibold">Tasas a comparar</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {rates.map((r) => (
            <Chip key={r} selected onClick={() => setRates(rates.filter((x) => x !== r))} color={LINE_COLORS[rates.indexOf(r) % LINE_COLORS.length]}>
              {r}% ✕
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24"><NumberInput value={newRate} onChange={setNewRate} min={0} ariaLabel="Nueva tasa" /></div>
          <Button variant="secondary" onClick={() => { if (!rates.includes(newRate)) setRates([...rates, newRate].sort((a, b) => a - b)); }}>
            + Agregar tasa
          </Button>
        </div>
      </Card>
      <Card>
        <table className="w-full text-right text-sm tabular-nums">
          <thead>
            <tr className="text-slate-400">
              <th className="py-1 text-left font-medium">Tasa</th>
              <th className="font-medium">Valor final</th>
              <th className="font-medium">Ganancia</th>
            </tr>
          </thead>
          <tbody>
            {results.map(({ rate, res }) => (
              <tr key={rate} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1.5 text-left font-semibold">{rate}%</td>
                <td>{fmtMoney(res.finalValue)}</td>
                <td className="text-emerald-600 dark:text-emerald-400">{fmtMoney(res.totalInterest)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {chart.length > 1 && (
        <Card>
          <div className="h-52">
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ left: 0, right: 8, top: 4 }}>
                <XAxis dataKey="año" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={48} tickFormatter={(v) => fmtMoneyShort(v)} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                {rates.map((r, i) => (
                  <Line key={r} type="monotone" dataKey={`${r}%`} stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      {milestones.length > 0 && (
        <Card>
          <p className="mb-2 font-semibold">Hitos</p>
          <table className="w-full text-right text-sm tabular-nums">
            <thead>
              <tr className="text-slate-400">
                <th className="py-1 text-left font-medium">Año</th>
                {results.map(({ rate }) => <th key={rate} className="font-medium">{rate}%</th>)}
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr key={m} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1 text-left">{m}</td>
                  {results.map(({ rate, res }) => (
                    <td key={rate}>{fmtMoneyShort(res.yearly.find((y) => y.year === m)?.value ?? 0)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function GoalMode({ input, goal, inverse, setInverse, onCreateGoal }: {
  input: ProjectionInput;
  goal: number;
  inverse: boolean;
  setInverse: (b: boolean) => void;
  onCreateGoal: () => void;
}) {
  const app = useApp();
  const result = useMemo(() => {
    if (inverse) return { years: yearsToGoal(goal, input) };
    const perPeriod = requiredContribution(goal, input);
    const perYear = perPeriod * CONTRIBUTIONS_PER_YEAR[input.contributionFreq];
    return { perPeriod, daily: perYear / 365, monthly: perYear / 12 };
  }, [inverse, goal, input]);

  return (
    <>
      <div className="flex gap-2">
        <Chip selected={!inverse} onClick={() => setInverse(false)}>¿Cuánto aportar?</Chip>
        <Chip selected={inverse} onClick={() => setInverse(true)}>¿Cuántos años?</Chip>
      </div>
      <Card className="text-center">
        {inverse ? (
          'years' in result && result.years === null ? (
            <p className="py-3 text-lg font-bold text-amber-600">Con ese aporte tomaría más de 100 años 😅. Sube el aporte o la tasa.</p>
          ) : (
            <>
              <p className="text-sm text-slate-500">Para llegar a {fmtMoney(goal)} necesitas</p>
              <p className="my-1 text-5xl font-extrabold text-emerald-500">{(result as { years: number }).years} años</p>
            </>
          )
        ) : (
          <>
            <p className="text-sm text-slate-500">Para llegar a {fmtMoney(goal)} en {input.years} años</p>
            <p className="my-1 text-4xl font-extrabold tabular-nums text-emerald-500">
              {fmtMoney((result as { perPeriod: number }).perPeriod)}
            </p>
            <p className="text-sm text-slate-500">por aporte ({FREQS_LABEL[input.contributionFreq]})</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Big label="Equivale al día" value={fmtMoney((result as { daily: number }).daily)} />
              <Big label="Equivale al mes" value={fmtMoney((result as { monthly: number }).monthly)} />
            </div>
          </>
        )}
        {app.profile && (
          <Button className="mt-4 w-full" onClick={onCreateGoal}>Crear meta con esto</Button>
        )}
      </Card>
    </>
  );
}

const FREQS_LABEL: Record<ContributionFrequency, string> = {
  daily: 'diario', weekly: 'semanal', biweekly: 'quincenal',
  monthly: 'mensual', quarterly: 'trimestral', yearly: 'anual',
};

function PactMode({ input, includePartner, setIncludePartner }: {
  input: ProjectionInput;
  includePartner: boolean;
  setIncludePartner: (b: boolean) => void;
}) {
  const app = useApp();
  const partner = app.partnerSnapshot;
  const mine = useMemo(() => project({
    ...input,
    principal: app.totalInvested,
    contribution: Math.max(app.monthlyInvestAvg, 0),
    contributionFreq: 'monthly',
  }), [input, app.totalInvested, app.monthlyInvestAvg]);
  const partnerHasData = partner?.data.totalInvested !== undefined;
  const theirs = useMemo(() => {
    if (!partner || !partnerHasData || !includePartner) return null;
    return project({
      ...input,
      principal: partner.data.totalInvested ?? 0,
      contribution: Math.max(partner.data.monthlyInvestAvg ?? 0, 0),
      contributionFreq: 'monthly',
    });
  }, [partner, includePartner, input, partnerHasData]);

  const combined = mine.finalValue + (theirs?.finalValue ?? 0);

  return (
    <Card>
      <p className="mb-1 font-semibold">Portafolio del pacto</p>
      <p className="mb-3 text-sm text-slate-500">
        Proyecta con tu total invertido ({fmtMoney(app.totalInvested)}) y tu aporte mensual promedio ({fmtMoney(app.monthlyInvestAvg)}).
      </p>
      {partner ? (
        partnerHasData ? (
          <label className="mb-3 flex min-h-[44px] items-center gap-2">
            <input type="checkbox" className="h-5 w-5 accent-emerald-500" checked={includePartner} onChange={(e) => setIncludePartner(e.target.checked)} />
            <span className="text-sm">Incluir a {partner.partnerProfile.name} {partner.partnerProfile.emoji}</span>
          </label>
        ) : (
          <p className="mb-3 text-sm text-slate-400">El snapshot de tu compañero no comparte su total invertido (Privado).</p>
        )
      ) : (
        <p className="mb-3 text-sm text-slate-400">Importa la tarjeta de tu compañero en la pestaña Pacto para incluirlo.</p>
      )}
      <div className="grid grid-cols-2 gap-2 text-center">
        <Big label={`Tu parte en ${input.years} años`} value={fmtMoney(mine.finalValue)} highlight={!theirs} />
        {theirs && <Big label={`${partner!.partnerProfile.name} en ${input.years} años`} value={fmtMoney(theirs.finalValue)} />}
      </div>
      {theirs && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-950">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Portafolio combinado del pacto</p>
          <p className="text-3xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(combined)}</p>
          <p className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-300/70">
            Tú: {Math.round((mine.finalValue / combined) * 100)}% · {partner!.partnerProfile.name}: {Math.round(((theirs.finalValue) / combined) * 100)}%
          </p>
        </div>
      )}
    </Card>
  );
}

function Big({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-2.5 ${highlight ? 'bg-emerald-50 dark:bg-emerald-950' : 'bg-slate-50 dark:bg-slate-800'}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${highlight ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{value}</p>
    </div>
  );
}
