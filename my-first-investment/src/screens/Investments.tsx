// Inversión — sección 8.3: total invertido, barras por mes, lista con
// editar/borrar, inversión manual y sección de Metas.

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../state/app';
import { Card, Button, Sheet, Field, NumberInput, ProgressBar, EmptyState, useConfirm, inputCls, Chip } from '../components/ui';
import { fmtMoney, fmtMoneyShort, fmtDateShort } from '../lib/format';
import { monthsToInvestmentGoal } from '../lib/goals';
import { todayISO, addDays } from '../lib/dates';
import { StocksSection, PortfolioCharts } from './Stocks';
import type { Goal, Investment } from '../lib/types';

export default function Investments({ goCalc }: { goCalc: () => void }) {
  const app = useApp();
  const [invSheet, setInvSheet] = useState<null | { editing?: Investment }>(null);
  const [goalSheet, setGoalSheet] = useState<null | { editing?: Goal }>(null);
  const [pendingDelete, confirmDelete] = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const [subtab, setSubtab] = useState<'resumen' | 'portafolio'>('resumen');

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of app.investments) {
      const key = i.date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + i.amount);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));
  }, [app.investments]);

  const activeGoals = app.goals.filter((g) => g.status === 'active');
  const achievedGoals = app.goals.filter((g) => g.status === 'achieved');
  const archivedGoals = app.goals.filter((g) => g.status === 'archived');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Chip selected={subtab === 'resumen'} onClick={() => setSubtab('resumen')}>Resumen</Chip>
        <Chip selected={subtab === 'portafolio'} onClick={() => setSubtab('portafolio')}>Portafolio 📈</Chip>
      </div>

      {subtab === 'portafolio' ? <PortfolioCharts /> : (<>
      <Card className="text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total invertido</p>
        <p className="my-1 text-5xl font-extrabold tabular-nums text-emerald-500">{fmtMoney(app.totalInvested)}</p>
        <p className="text-xs text-slate-400">Promedio {fmtMoney(app.monthlyInvestAvg)}/mes</p>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setInvSheet({})}>+ Inversión manual</Button>
          <Button variant="secondary" className="flex-1" onClick={goCalc}>Proyectar 🧮</Button>
        </div>
      </Card>

      {byMonth.length > 0 && (
        <Card>
          <p className="mb-2 font-semibold">Inversión por mes</p>
          <div className="h-40">
            <ResponsiveContainer>
              <BarChart data={byMonth} margin={{ left: 0, right: 8, top: 4 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => fmtMoneyShort(v)} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <p className="mb-2 font-semibold">Historial de inversiones</p>
        {app.investments.length === 0 ? (
          <EmptyState emoji="🌱" text="Tu primera inversión llegará con el cierre de mes, o agrégala manual." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {[...app.investments].reverse().map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2">
                <span aria-hidden>{i.source === 'monthly_close' ? '💰' : '✋'}</span>
                <button className="min-h-[44px] flex-1 text-left" onClick={() => setInvSheet({ editing: i })}>
                  <p>{i.source === 'monthly_close' ? 'Cierre de mes' : 'Manual'}{i.note ? ` · ${i.note}` : ''}</p>
                  <p className="text-xs text-slate-400">{fmtDateShort(i.date)}</p>
                </button>
                <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(i.amount)}</span>
                <button
                  onClick={() => confirmDelete(i.id, () => app.deleteInvestment(i.id))}
                  aria-label="Borrar inversión"
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-sm ${pendingDelete === i.id ? 'bg-red-500 text-white' : 'text-slate-300 dark:text-slate-600'}`}
                >
                  {pendingDelete === i.id ? '✓?' : '✕'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <StocksSection />

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold">Metas</p>
          <Button variant="ghost" onClick={() => setGoalSheet({})}>+ Nueva</Button>
        </div>
        {activeGoals.length === 0 && achievedGoals.length === 0 ? (
          <EmptyState emoji="🎯" text="Crea una meta para darle dirección al pacto." />
        ) : (
          <div className="flex flex-col gap-3">
            {activeGoals.map((g) => <GoalRow key={g.id} goal={g} onEdit={() => setGoalSheet({ editing: g })} />)}
            {achievedGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm dark:bg-emerald-950">
                <span aria-hidden>🏆</span>
                <p className="flex-1 font-medium">{g.name}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-300">Lograda</p>
                <Button variant="ghost" onClick={() => app.saveGoal({ ...g, status: 'active', achievedAt: undefined })}>
                  Reactivar
                </Button>
              </div>
            ))}
            {archivedGoals.length > 0 && (
              <button className="text-left text-xs text-slate-400" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Ocultar archivadas' : `Ver ${archivedGoals.length} archivada(s)`}
              </button>
            )}
            {showArchived && archivedGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm opacity-60 dark:bg-slate-800">
                <p className="flex-1">{g.name}</p>
                <Button variant="ghost" onClick={() => app.saveGoal({ ...g, status: 'active' })}>Reactivar</Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      </>)}

      {invSheet && <InvestmentSheet editing={invSheet.editing} onClose={() => setInvSheet(null)} />}
      {goalSheet && <GoalSheet editing={goalSheet.editing} onClose={() => setGoalSheet(null)} />}
    </div>
  );
}

function GoalRow({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const app = useApp();
  const { value, pct } = app.goalProgressFor(goal);
  // Fecha estimada de logro para metas de inversión con fecha límite.
  const eta = useMemo(() => {
    if (goal.type !== 'total_invested' || !goal.deadline) return null;
    const months = monthsToInvestmentGoal(value, goal.target, Math.max(app.monthlyInvestAvg, 1), 10);
    if (months === null) return 'más de 100 años';
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [goal, value, app.monthlyInvestAvg]);

  return (
    <button className="block w-full text-left" onClick={onEdit}>
      <div className="mb-1 flex items-baseline justify-between">
        <p className="font-medium">{goal.shared ? '🤝 ' : ''}{goal.name}</p>
        <p className="text-sm tabular-nums text-slate-500">{pct}%</p>
      </div>
      <ProgressBar pct={pct} />
      <p className="mt-1 text-xs text-slate-400">
        {goal.type === 'streak' ? `${value} de ${goal.target} días` : `${fmtMoney(value)} de ${fmtMoney(goal.target)}`}
        {eta ? ` · estimado: ${eta} (al 10%)` : ''}
      </p>
    </button>
  );
}

function InvestmentSheet({ editing, onClose }: { editing?: Investment; onClose: () => void }) {
  const app = useApp();
  const [amount, setAmount] = useState(editing?.amount ?? 100);
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? '');
  const save = async () => {
    if (editing) await app.updateInvestment({ ...editing, amount, date, note: note.trim() || undefined });
    else await app.addInvestment(amount, date, note.trim() || undefined);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={editing ? 'Editar inversión' : 'Inversión manual'}>
      <Field label="Monto (USD)"><NumberInput value={amount} onChange={setAmount} min={0} ariaLabel="Monto" /></Field>
      <Field label="Fecha">
        <input type="date" className={inputCls} value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="Nota (opcional)">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button className="w-full" disabled={amount <= 0} onClick={save}>Guardar</Button>
    </Sheet>
  );
}

export function GoalSheet({ editing, onClose, prefill }: {
  editing?: Goal;
  onClose: () => void;
  prefill?: Partial<Pick<Goal, 'name' | 'type' | 'target'>>;
}) {
  const app = useApp();
  const [name, setName] = useState(editing?.name ?? prefill?.name ?? '');
  const [type, setType] = useState<Goal['type']>(editing?.type ?? prefill?.type ?? 'total_invested');
  const [target, setTarget] = useState(editing?.target ?? prefill?.target ?? 1000);
  const [deadline, setDeadline] = useState(editing?.deadline ?? '');
  const [shared, setShared] = useState(editing?.shared ?? false);
  const [manualProgress, setManualProgress] = useState(editing?.manualProgress ?? 0);

  const TYPES: { id: Goal['type']; label: string }[] = [
    { id: 'total_invested', label: 'Total invertido' },
    { id: 'monthly_savings', label: 'Ahorro del mes' },
    { id: 'streak', label: 'Racha' },
    { id: 'custom', label: 'Personalizada' },
  ];

  const save = async () => {
    const g: Goal = editing
      ? { ...editing, name: name.trim(), type, target, deadline: deadline || undefined, shared, manualProgress: type === 'custom' ? manualProgress : undefined }
      : {
          id: crypto.randomUUID(), userId: app.profile!.id, name: name.trim(), type, target,
          deadline: deadline || undefined, shared, status: 'active',
          manualProgress: type === 'custom' ? manualProgress : undefined,
          createdAt: new Date().toISOString(),
        };
    await app.saveGoal(g);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={editing ? 'Editar meta' : 'Nueva meta'}>
      <Field label="Nombre">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Primeros $1,000" />
      </Field>
      <Field label="Tipo">
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => <Chip key={t.id} selected={type === t.id} onClick={() => setType(t.id)}>{t.label}</Chip>)}
        </div>
      </Field>
      <Field label={type === 'streak' ? 'Meta (días)' : 'Meta (USD)'}>
        <NumberInput value={target} onChange={setTarget} min={1} ariaLabel="Meta" />
      </Field>
      {type === 'custom' && (
        <Field label="Progreso actual (USD)">
          <NumberInput value={manualProgress} onChange={setManualProgress} min={0} ariaLabel="Progreso manual" />
        </Field>
      )}
      <Field label="Fecha límite (opcional)">
        <input type="date" className={inputCls} value={deadline} min={addDays(todayISO(), 1)} onChange={(e) => setDeadline(e.target.value)} />
      </Field>
      <label className="mb-4 flex min-h-[44px] items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={shared} onChange={(e) => setShared(e.target.checked)} />
        <span className="text-sm">Meta compartida del pacto (suma el progreso de ambos)</span>
      </label>
      <div className="flex gap-2">
        {editing && (
          <Button variant="secondary" className="flex-1" onClick={async () => { await app.saveGoal({ ...editing, status: 'archived' }); onClose(); }}>
            Archivar
          </Button>
        )}
        <Button className="flex-1" disabled={!name.trim() || target <= 0} onClick={save}>Guardar</Button>
      </div>
    </Sheet>
  );
}
