// Ajustes — secciones 5 y 8.6. Todos los números son editables.

import { useRef, useState } from 'react';
import { useApp } from '../state/app';
import { Button, Field, NumberInput, Chip, inputCls, Sheet, Modal } from '../components/ui';
import { weekdayName } from '../lib/format';
import type { Category, PrivacySettings, Settings } from '../lib/types';

const EMOJIS = ['🚀', '🌱', '🦁', '🐢', '⚡', '🌊', '🔥', '🏔️', '🎯', '🪙'];
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6'];

const PRIVACY_LABELS: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'streak', label: 'Racha actual y mejor racha' },
  { key: 'savingsPct', label: '% del mes ahorrado vs meta' },
  { key: 'totalInvested', label: 'Total invertido' },
  { key: 'goals', label: 'Metas y progreso' },
  { key: 'weekly', label: 'Resumen semanal' },
  { key: 'amounts', label: 'Salario y montos de gasto' },
  { key: 'expenses', label: 'Gastos individuales y notas' },
];

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [s, setS] = useState<Settings>(app.settings);
  const [profile, setProfile] = useState(app.profile!);
  const [dirty, setDirty] = useState(false);
  const [catSheet, setCatSheet] = useState<null | { kind: 'expense' | 'income'; editing?: Category }>(null);
  const [wipeStep, setWipeStep] = useState(0); // doble confirmación
  const [newRate, setNewRate] = useState(12);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const upd = (patch: Partial<Settings>) => { setS({ ...s, ...patch }); setDirty(true); };
  const updProfile = (patch: Partial<typeof profile>) => { setProfile({ ...profile, ...patch }); setDirty(true); };

  const save = async () => {
    await app.saveProfile(profile);
    await app.saveSettings(s);
    setDirty(false);
    setMsg('Guardado ✓');
    setTimeout(() => setMsg(null), 2000);
  };

  const exportBackup = async () => {
    const data = await app.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `respaldo-mfi-${app.today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const expenseCats = app.categories.filter((c) => c.kind === 'expense');
  const incomeCats = app.categories.filter((c) => c.kind === 'income');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-100 dark:bg-slate-950">
      <div className="mx-auto max-w-md px-4 pb-24 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Ajustes</h1>
          <button onClick={onClose} aria-label="Cerrar ajustes" className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-sm dark:bg-slate-900">✕</button>
        </div>

        <Section title="Perfil">
          <Field label="Nombre">
            <input className={inputCls} value={profile.name} onChange={(e) => updProfile({ name: e.target.value })} />
          </Field>
          <Field label="Avatar">
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <Chip key={e} selected={profile.emoji === e} onClick={() => updProfile({ emoji: e })} color={profile.color}>
                  <span className="text-xl">{e}</span>
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Color">
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} aria-label={`Color ${c}`} onClick={() => updProfile({ color: c })}
                  className={`h-11 w-11 rounded-full border-4 ${profile.color === c ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </Field>
          <Field label="Fecha de inicio del pacto">
            <input type="date" className={inputCls} value={profile.pactStartDate} onChange={(e) => updProfile({ pactStartDate: e.target.value })} />
          </Field>
        </Section>

        <Section title="Presupuesto">
          <Field label="Salario mensual fijo (USD)"><NumberInput value={s.salary} onChange={(n) => upd({ salary: n })} min={0} ariaLabel="Salario" /></Field>
          <Field label="Meta de ahorro mensual (USD)" hint="Se descuenta antes del límite diario.">
            <NumberInput value={s.savingsGoal} onChange={(n) => upd({ savingsGoal: n })} min={0} ariaLabel="Meta de ahorro" />
          </Field>
          <Field label="Día de inicio del ciclo (1–28)">
            <NumberInput value={s.cycleStartDay} onChange={(n) => upd({ cycleStartDay: Math.min(28, Math.max(1, Math.round(n))) })} min={1} max={28} step="1" ariaLabel="Día de inicio" />
          </Field>
          <Field label="Destino de ingresos extra">
            <select className={inputCls} value={s.extraIncomeMode} onChange={(e) => upd({ extraIncomeMode: e.target.value as Settings['extraIncomeMode'] })}>
              <option value="invest">A inversión</option>
              <option value="available">Al disponible (se reparte en los días restantes)</option>
            </select>
          </Field>
          <Field label="Arrastre negativo al cerrar mes">
            <select className={inputCls} value={s.negativeCarryMode} onChange={(e) => upd({ negativeCarryMode: e.target.value as Settings['negativeCarryMode'] })}>
              <option value="deduct">Descontar del mes siguiente</option>
              <option value="reset">Reiniciar en cero</option>
            </select>
          </Field>
          <Field label="Día del resumen semanal">
            <select className={inputCls} value={s.weeklySummaryDay} onChange={(e) => upd({ weeklySummaryDay: Number(e.target.value) as Settings['weeklySummaryDay'] })}>
              {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{weekdayName(d)}</option>)}
            </select>
          </Field>
          <p className="text-xs text-slate-400">Cambiar un parámetro a mitad de ciclo recalcula desde hoy; los días pasados conservan su límite.</p>
        </Section>

        <Section title="Sugerencia de inversión al cierre">
          {([['positiveCarry', 'Arrastre positivo'], ['extraIncome', 'Ingresos extra'], ['savingsGoal', 'Meta de ahorro']] as const).map(([key, label]) => (
            <label key={key} className="flex min-h-[44px] items-center gap-2">
              <input type="checkbox" className="h-5 w-5 accent-emerald-500"
                checked={s.suggestionIncludes[key]}
                onChange={(e) => upd({ suggestionIncludes: { ...s.suggestionIncludes, [key]: e.target.checked } })} />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </Section>

        <Section title="Categorías de gasto">
          <CategoryList cats={expenseCats} onEdit={(c) => setCatSheet({ kind: 'expense', editing: c })} />
          <Button variant="ghost" onClick={() => setCatSheet({ kind: 'expense' })}>+ Nueva categoría</Button>
        </Section>
        <Section title="Categorías de ingreso extra">
          <CategoryList cats={incomeCats} onEdit={(c) => setCatSheet({ kind: 'income', editing: c })} />
          <Button variant="ghost" onClick={() => setCatSheet({ kind: 'income' })}>+ Nueva categoría</Button>
        </Section>

        <Section title="Tasas por defecto de la calculadora">
          <div className="mb-2 flex flex-wrap gap-2">
            {s.defaultRates.map((r) => (
              <Chip key={r} selected onClick={() => upd({ defaultRates: s.defaultRates.filter((x) => x !== r) })}>{r}% ✕</Chip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-24"><NumberInput value={newRate} onChange={setNewRate} min={0} ariaLabel="Nueva tasa" /></div>
            <Button variant="secondary" onClick={() => { if (!s.defaultRates.includes(newRate)) upd({ defaultRates: [...s.defaultRates, newRate].sort((a, b) => a - b) }); }}>
              + Agregar
            </Button>
          </div>
        </Section>

        <Section title="Privacidad frente al compañero">
          <p className="mb-2 text-xs text-slate-400">Qué viaja en tu tarjeta de progreso (y qué verá en vivo en Fase 2).</p>
          {PRIVACY_LABELS.map(({ key, label }) => (
            <label key={key} className="flex min-h-[44px] items-center justify-between gap-2">
              <span className="text-sm">{label}</span>
              <input type="checkbox" className="h-5 w-5 accent-emerald-500"
                checked={s.privacy[key]}
                onChange={(e) => upd({ privacy: { ...s.privacy, [key]: e.target.checked } })} />
            </label>
          ))}
        </Section>

        <Section title="Datos">
          <div className="flex flex-col gap-2">
            <Button variant="secondary" onClick={exportBackup}>Exportar respaldo (JSON)</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const res = await app.importBackup(await f.text());
                setMsg(res.ok ? 'Respaldo importado ✓' : res.error ?? 'Error al importar');
              }} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>Importar respaldo</Button>
            <Button variant="danger" onClick={() => setWipeStep(1)}>Borrar todos mis datos</Button>
          </div>
        </Section>

        <div className="sticky bottom-4 mt-4">
          <Button className="w-full shadow-lg" disabled={!dirty || s.savingsGoal > s.salary} onClick={save}>
            {msg ?? (dirty ? 'Guardar cambios' : 'Todo guardado')}
          </Button>
          {s.savingsGoal > s.salary && <p className="mt-1 text-center text-sm text-red-500">La meta de ahorro no puede superar el salario.</p>}
        </div>
      </div>

      {catSheet && (
        <CategorySheet kind={catSheet.kind} editing={catSheet.editing}
          nextOrder={(catSheet.kind === 'expense' ? expenseCats : incomeCats).length}
          onClose={() => setCatSheet(null)} />
      )}

      {/* Borrar datos: doble confirmación */}
      <Modal open={wipeStep > 0} title={wipeStep === 1 ? '¿Borrar todos tus datos?' : '¿Seguro seguro?'}>
        <p className="mb-4 text-sm text-slate-500">
          {wipeStep === 1
            ? 'Se borrarán perfil, gastos, inversiones, metas y el snapshot de tu compañero de este dispositivo. Exporta un respaldo antes si tienes dudas.'
            : 'Esta acción no se puede deshacer. Es tu última oportunidad de cancelar.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setWipeStep(0)}>Cancelar</Button>
          <Button variant="danger" className="flex-1"
            onClick={async () => {
              if (wipeStep === 1) setWipeStep(2);
              else { await app.clearAll(); setWipeStep(0); onClose(); }
            }}>
            {wipeStep === 1 ? 'Sí, borrar' : 'Borrar definitivamente'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <h2 className="mb-3 font-bold">{title}</h2>
      {children}
    </section>
  );
}

function CategoryList({ cats, onEdit }: { cats: Category[]; onEdit: (c: Category) => void }) {
  const app = useApp();
  const move = async (c: Category, dir: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    await app.saveCategory({ ...sorted[i], order: sorted[j].order });
    await app.saveCategory({ ...sorted[j], order: sorted[i].order });
  };
  return (
    <ul className="mb-2 divide-y divide-slate-100 dark:divide-slate-800">
      {cats.map((c) => (
        <li key={c.id} className={`flex items-center gap-2 py-1.5 ${c.archived ? 'opacity-40' : ''}`}>
          <button className="flex min-h-[44px] flex-1 items-center gap-2 text-left" onClick={() => onEdit(c)}>
            <span aria-hidden>{c.emoji}</span>
            <span className="text-sm">{c.name}{c.archived ? ' (archivada)' : ''}</span>
          </button>
          <button aria-label="Subir" className="h-11 w-9 text-slate-400" onClick={() => move(c, -1)}>↑</button>
          <button aria-label="Bajar" className="h-11 w-9 text-slate-400" onClick={() => move(c, 1)}>↓</button>
        </li>
      ))}
    </ul>
  );
}

function CategorySheet({ kind, editing, nextOrder, onClose }: {
  kind: 'expense' | 'income';
  editing?: Category;
  nextOrder: number;
  onClose: () => void;
}) {
  const app = useApp();
  const [name, setName] = useState(editing?.name ?? '');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '📦');
  const [color, setColor] = useState(editing?.color ?? COLORS[0]);

  const save = async () => {
    const c: Category = editing
      ? { ...editing, name: name.trim(), emoji, color }
      : {
          id: crypto.randomUUID(), userId: app.profile!.id, kind,
          name: name.trim(), emoji, color, archived: false, order: nextOrder,
        };
    await app.saveCategory(c);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={editing ? 'Editar categoría' : 'Nueva categoría'}>
      <Field label="Nombre"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Emoji">
        <input className={inputCls} value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />
      </Field>
      <Field label="Color">
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} aria-label={`Color ${c}`} onClick={() => setColor(c)}
              className={`h-11 w-11 rounded-full border-4 ${color === c ? 'border-slate-900 dark:border-white' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </Field>
      <div className="flex gap-2">
        {editing && (
          <Button variant="secondary" className="flex-1"
            onClick={async () => { await app.saveCategory({ ...editing, archived: !editing.archived }); onClose(); }}>
            {editing.archived ? 'Desarchivar' : 'Archivar'}
          </Button>
        )}
        <Button className="flex-1" disabled={!name.trim()} onClick={save}>Guardar</Button>
      </div>
    </Sheet>
  );
}
