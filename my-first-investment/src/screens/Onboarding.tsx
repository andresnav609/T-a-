// Onboarding de 4 pasos — sección 4.1.
// 1) nombre y avatar → 2) salario y meta de ahorro → 3) día de inicio del
// ciclo → 4) primera meta (opcional).

import { useState } from 'react';
import { useApp, defaultSettings } from '../state/app';
import { Button, Field, NumberInput, Chip, inputCls } from '../components/ui';
import { todayISO } from '../lib/dates';
import type { Goal, Profile } from '../lib/types';

const EMOJIS = ['🚀', '🌱', '🦁', '🐢', '⚡', '🌊', '🔥', '🏔️', '🎯', '🪙'];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

const SUGGESTED_GOALS: { name: string; type: Goal['type']; target: number }[] = [
  { name: 'Primeros $1,000 invertidos', type: 'total_invested', target: 1000 },
  { name: 'Racha de 30 días', type: 'streak', target: 30 },
  { name: 'Primeros $5,000 invertidos', type: 'total_invested', target: 5000 },
];

export default function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [salary, setSalary] = useState(850);
  const [savingsGoal, setSavingsGoal] = useState(300);
  const [cycleStartDay, setCycleStartDay] = useState(1);
  const [goalIdx, setGoalIdx] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    const id = crypto.randomUUID();
    const profile: Profile = {
      id, name: name.trim(), emoji, color,
      pactStartDate: todayISO(),
      createdAt: new Date().toISOString(),
    };
    const settings = { ...defaultSettings(id), salary, savingsGoal, cycleStartDay };
    const g = goalIdx !== null ? SUGGESTED_GOALS[goalIdx] : null;
    const firstGoal: Goal | null = g
      ? {
          id: crypto.randomUUID(), userId: id, type: g.type, name: g.name, target: g.target,
          shared: false, status: 'active', createdAt: new Date().toISOString(),
        }
      : null;
    await app.completeOnboarding(profile, settings, firstGoal);
  };

  const steps = [
    // Paso 0: bienvenida + nombre y avatar
    <div key="0">
      <p className="mb-1 text-3xl font-extrabold">My First Investment</p>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Un pacto entre dos amigos para gastar con cabeza e invertir lo que sobra. Empecemos por ti.
      </p>
      <Field label="Tu nombre">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llamas?" autoFocus />
      </Field>
      <Field label="Tu avatar">
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <Chip key={e} selected={emoji === e} onClick={() => setEmoji(e)} color={color}>
              <span className="text-xl">{e}</span>
            </Chip>
          ))}
        </div>
      </Field>
      <Field label="Tu color">
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={`h-11 w-11 rounded-full border-4 ${color === c ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>
      <Button className="mt-4 w-full" disabled={!name.trim()} onClick={() => setStep(1)}>Continuar</Button>
    </div>,

    // Paso 1: salario y meta
    <div key="1">
      <p className="mb-1 text-2xl font-extrabold">Tus números</p>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        La meta de ahorro se aparta primero; el resto se reparte en límites diarios. Todo se puede cambiar en Ajustes.
      </p>
      <Field label="Salario mensual fijo (USD)">
        <NumberInput value={salary} onChange={setSalary} min={0} ariaLabel="Salario mensual" />
      </Field>
      <Field label="Meta de ahorro mensual (USD)" hint="Lo que quieres apartar sí o sí cada mes.">
        <NumberInput value={savingsGoal} onChange={setSavingsGoal} min={0} ariaLabel="Meta de ahorro" />
      </Field>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => setStep(0)} className="flex-1">Atrás</Button>
        <Button onClick={() => setStep(2)} className="flex-1" disabled={savingsGoal > salary}>Continuar</Button>
      </div>
      {savingsGoal > salary && <p className="mt-2 text-sm text-red-500">La meta no puede superar el salario.</p>}
    </div>,

    // Paso 2: día de inicio del ciclo
    <div key="2">
      <p className="mb-1 text-2xl font-extrabold">Tu ciclo</p>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        ¿Qué día del mes empieza tu ciclo? Normalmente, el día que cobras.
      </p>
      <Field label="Día de inicio del ciclo (1–28)">
        <NumberInput value={cycleStartDay} onChange={(n) => setCycleStartDay(Math.min(28, Math.max(1, Math.round(n))))} min={1} max={28} step="1" ariaLabel="Día de inicio" />
      </Field>
      <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
        Con estos números, tu límite diario será de aproximadamente{' '}
        <strong>${((salary - savingsGoal) / 30).toFixed(2)}</strong>.
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setStep(1)} className="flex-1">Atrás</Button>
        <Button onClick={() => setStep(3)} className="flex-1">Continuar</Button>
      </div>
    </div>,

    // Paso 3: primera meta (opcional)
    <div key="3">
      <p className="mb-1 text-2xl font-extrabold">Tu primera meta</p>
      <p className="mb-6 text-slate-500 dark:text-slate-400">Opcional, pero ayuda a mantener el rumbo.</p>
      <div className="mb-4 flex flex-col gap-2">
        {SUGGESTED_GOALS.map((g, i) => (
          <Chip key={g.name} selected={goalIdx === i} onClick={() => setGoalIdx(goalIdx === i ? null : i)} color={color}>
            {g.name}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => setStep(2)} className="flex-1">Atrás</Button>
        <Button onClick={finish} className="flex-1" disabled={saving}>
          {saving ? 'Creando…' : goalIdx === null ? 'Empezar sin meta' : '¡Empezar!'}
        </Button>
      </div>
    </div>,
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-8">
      <div className="mb-6 flex gap-1.5" aria-label={`Paso ${step + 1} de 4`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
        ))}
      </div>
      {steps[step]}
    </div>
  );
}
