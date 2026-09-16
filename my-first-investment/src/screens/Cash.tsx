// Mi plata: pantalla completa (pestaña propia) + widget compacto para Hoy.
// El saldo se deriva del último cuadre + gastos/ingresos/inversiones.

import { useState } from 'react';
import { useApp } from '../state/app';
import { Card, Button, Sheet, Field, NumberInput, EmptyState, inputCls } from '../components/ui';
import { fmtMoney, timeAgo } from '../lib/format';

/** Pantalla completa de la pestaña Plata. */
export default function CashScreen() {
  const app = useApp();
  const [sheet, setSheet] = useState<null | 'reconcile' | 'deposit'>(null);
  const enabled = app.settings.cash.enabled;
  const hasAnchor = app.cashBalance !== null;

  // `wasInitial` congela el modo del cuadre al abrirlo: si se abre para poner
  // el saldo inicial, sigue siendo "inicial" aunque el saldo aparezca a mitad
  // del flujo (el sheet vive fuera de los condicionales para no desmontarse).
  const [wasInitial, setWasInitial] = useState(false);
  const openReconcile = (initial: boolean) => {
    setWasInitial(initial);
    setSheet('reconcile');
  };

  const activate = async () => {
    if (!enabled) await app.saveSettings({ ...app.settings, cash: { ...app.settings.cash, enabled: true } });
    openReconcile(true);
  };

  const patrimonio = (app.cashBalance ?? 0) + app.totalInvested;
  const lastSet = app.cashLedger.find((r) => r.delta === null);

  const content = (!enabled || !hasAnchor) ? (
    <Card>
      <p className="mb-1 text-lg font-bold">💰 Mi plata</p>
      <p className="mb-3 text-sm text-slate-500">
        Lleva la contabilidad de tu cuenta (banco + efectivo) sin anotar nada dos veces:
        tus gastos la bajan, tus ingresos la suben y tus inversiones pasan al total invertido.
        Cada semana la app te pregunta cuánto tienes de verdad y detecta lo que se te olvidó anotar.
      </p>
      <Button className="w-full" onClick={activate}>Activar y poner mi saldo</Button>
    </Card>
  ) : (
    <>
      <Card className="text-center">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Mi plata</p>
        <p className={`my-1 text-5xl font-extrabold tabular-nums ${app.cashBalance! < 0 ? 'text-red-500' : ''}`}
          style={app.cashBalance! >= 0 ? { color: 'var(--accent)' } : undefined}>
          {fmtMoney(app.cashBalance!)}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
            <p className="text-xs text-slate-400">📈 Invertido</p>
            <p className="font-bold tabular-nums">{fmtMoney(app.totalInvested)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800">
            <p className="text-xs text-slate-400">🏦 Patrimonio total</p>
            <p className="font-bold tabular-nums">{fmtMoney(patrimonio)}</p>
          </div>
        </div>
        {lastSet && <p className="mt-2 text-xs text-slate-400">Último cuadre {timeAgo(lastSet.at)}</p>}
        {app.cashReconcileDue && (
          <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
            📋 Toca hacer el cuadre semanal
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <Button variant={app.cashReconcileDue ? 'primary' : 'secondary'} className="flex-1" onClick={() => openReconcile(false)}>
            Cuadrar
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setSheet('deposit')}>+ Depósito / retiro</Button>
        </div>
      </Card>

      <Card>
        <p className="mb-1 font-semibold">Movimientos</p>
        <p className="mb-2 text-xs text-slate-400">
          Desde el último cuadre. Gastos e ingresos vienen de lo que registras; edítalos en Hoy o Historial.
        </p>
        <CashLedgerList />
      </Card>
    </>
  );

  // Los sheets se renderizan SIEMPRE en la misma posición del árbol, para que
  // no se desmonten cuando el saldo inicial aparece a mitad del flujo.
  return (
    <div className="flex flex-col gap-3">
      {content}
      {sheet === 'reconcile' && <CashReconcileSheet initial={wasInitial} onClose={() => setSheet(null)} />}
      {sheet === 'deposit' && <CashDepositSheet onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Widget compacto para la pantalla Hoy. */
export function CashWidget() {
  const app = useApp();
  const [sheet, setSheet] = useState<null | 'reconcile' | 'ledger' | 'deposit'>(null);
  const hasAnchor = app.cashBalance !== null;
  const patrimonio = (app.cashBalance ?? 0) + app.totalInvested;

  return (
    <>
      <Card className={app.cashReconcileDue ? 'border-l-4 border-amber-400' : ''}>
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">💰 Mi plata</p>
          {hasAnchor && (
            <p className={`text-2xl font-extrabold tabular-nums ${app.cashBalance! < 0 ? 'text-red-500' : ''}`}>
              {fmtMoney(app.cashBalance!)}
            </p>
          )}
        </div>
        {hasAnchor ? (
          <>
            <p className="mt-0.5 text-xs text-slate-400">
              + {fmtMoney(app.totalInvested)} invertido = <strong>{fmtMoney(patrimonio)}</strong> en total
            </p>
            {app.cashReconcileDue && (
              <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                📋 Toca hacer el cuadre semanal: ¿cuánto tienes de verdad?
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <Button variant={app.cashReconcileDue ? 'primary' : 'secondary'} className="flex-1" onClick={() => setSheet('reconcile')}>
                Cuadrar
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setSheet('deposit')}>+ Depósito</Button>
              <Button variant="secondary" className="flex-1" onClick={() => setSheet('ledger')}>Movimientos</Button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 mt-1 text-sm text-slate-500">
              Dime cuánto tienes hoy en tu cuenta y a partir de ahí llevo la contabilidad sola:
              gastos bajan, ingresos suben, inversiones pasan a Invertido.
            </p>
            <Button className="w-full" onClick={() => setSheet('reconcile')}>Poner mi saldo inicial</Button>
          </>
        )}
      </Card>
      {sheet === 'reconcile' && <CashReconcileSheet initial={!hasAnchor} onClose={() => setSheet(null)} />}
      {sheet === 'deposit' && <CashDepositSheet onClose={() => setSheet(null)} />}
      {sheet === 'ledger' && (
        <Sheet open onClose={() => setSheet(null)} title="Movimientos de Mi plata">
          <CashLedgerList />
        </Sheet>
      )}
    </>
  );
}

function CashLedgerList() {
  const app = useApp();
  if (app.cashLedger.length === 0) return <EmptyState emoji="🏦" text="Sin movimientos todavía." />;
  return (
    <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
      {app.cashLedger.map((r, i) => (
        <li key={i} className="flex items-center gap-2 py-2">
          <span aria-hidden>{r.emoji}</span>
          <div className="flex-1">
            <p>{r.label}</p>
            <p className="text-xs text-slate-400">
              {new Date(r.at).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
            {r.diff !== undefined && Math.abs(r.diff) >= 0.01 && (
              <p className={`text-xs ${r.diff < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                diferencia {fmtMoney(r.diff)} sin registrar
              </p>
            )}
          </div>
          <div className="text-right">
            {r.delta !== null && (
              <p className={`font-semibold tabular-nums ${r.delta < 0 ? '' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {r.delta >= 0 ? '+' : ''}{fmtMoney(r.delta)}
              </p>
            )}
            <p className="text-xs tabular-nums text-slate-400">= {fmtMoney(r.balanceAfter)}</p>
          </div>
          {r.eventId && (
            <button aria-label="Borrar movimiento" className="flex h-11 w-9 items-center justify-center text-slate-300 dark:text-slate-600"
              onClick={() => app.deleteCashEvent(r.eventId!)}>✕</button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Cuadre: pregunta el pago del trabajo (si aplica) y el saldo real, y
 *  muestra la discrepancia contra lo calculado. */
export function CashReconcileSheet({ initial, onClose }: { initial: boolean; onClose: () => void }) {
  const app = useApp();
  const cash = app.settings.cash;
  const [step, setStep] = useState<'salary' | 'balance' | 'done'>(
    !initial && cash.askSalary ? 'salary' : 'balance',
  );
  const [salary, setSalary] = useState(cash.weeklyPay ?? 0);
  const [real, setReal] = useState(app.cashBalance ?? 0);
  const [result, setResult] = useState<number | null>(null);

  const confirmBalance = async () => {
    const diff = await app.setCashBalance(real, initial ? 'Saldo inicial' : undefined);
    setResult(diff);
    setStep('done');
  };

  return (
    <Sheet open onClose={onClose} title={initial ? 'Mi saldo inicial' : 'Cuadre semanal'}>
      {step === 'salary' && (
        <>
          <p className="mb-3 text-sm text-slate-500">💼 ¿Te entró plata del trabajo desde el último cuadre?</p>
          <Field label="Monto (USD)">
            <NumberInput value={salary} onChange={setSalary} min={0} ariaLabel="Pago recibido" />
          </Field>
          <div className="flex flex-col gap-2">
            <Button disabled={salary <= 0} onClick={async () => { await app.addCashSalary(salary); setStep('balance'); }}>
              Sí, sumar {fmtMoney(salary)}
            </Button>
            <Button variant="secondary" onClick={() => setStep('balance')}>No / aún no</Button>
          </div>
        </>
      )}
      {step === 'balance' && (
        <>
          <p className="mb-1 text-sm text-slate-500">
            {initial
              ? '¿Cuánto tienes AHORA en tu cuenta (banco + efectivo)?'
              : '¿Cuánto tienes AHORA de verdad en tu cuenta?'}
          </p>
          {!initial && app.cashBalance !== null && (
            <p className="mb-2 text-xs text-slate-400">Según lo registrado deberías tener {fmtMoney(app.cashBalance)}.</p>
          )}
          <Field label="Saldo real (USD)">
            <NumberInput value={real} onChange={setReal} ariaLabel="Saldo real" />
          </Field>
          <Button className="w-full" onClick={confirmBalance}>Guardar</Button>
        </>
      )}
      {step === 'done' && result !== null && (
        <div className="text-center">
          {Math.abs(result) < 0.01 || initial ? (
            <>
              <p className="text-4xl" aria-hidden>✅</p>
              <p className="mt-2 font-semibold">{initial ? 'Listo, contabilidad activada.' : '¡Todo cuadra! Ni un centavo perdido.'}</p>
            </>
          ) : (
            <>
              <p className="text-4xl" aria-hidden>🤔</p>
              <p className="mt-2 font-semibold">
                Hay {fmtMoney(Math.abs(result))} {result < 0 ? 'menos' : 'más'} de lo registrado.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {result < 0
                  ? '¿Se te olvidó anotar algún gasto? Quedó registrado como diferencia en el cuadre; si lo recuerdas, anótalo como gasto para tu historial.'
                  : '¿Te entró plata que no anotaste? Quedó registrada como diferencia en el cuadre.'}
              </p>
            </>
          )}
          <Button className="mt-4 w-full" onClick={onClose}>Entendido</Button>
        </div>
      )}
    </Sheet>
  );
}

function CashDepositSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [withdraw, setWithdraw] = useState(false);
  return (
    <Sheet open onClose={onClose} title="Depósito o retiro">
      <div className="mb-3 flex gap-2">
        <ChipBtn selected={!withdraw} onClick={() => setWithdraw(false)}>⬆️ Me entró plata</ChipBtn>
        <ChipBtn selected={withdraw} onClick={() => setWithdraw(true)}>⬇️ Saqué plata</ChipBtn>
      </div>
      <Field label="Monto (USD)"><NumberInput value={amount} onChange={setAmount} min={0} ariaLabel="Monto del depósito" /></Field>
      <Field label="Nota (opcional)">
        <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button className="w-full" disabled={amount <= 0}
        onClick={async () => { await app.addCashDeposit(withdraw ? -amount : amount, note.trim() || undefined); onClose(); }}>
        Guardar
      </Button>
    </Sheet>
  );
}

function ChipBtn({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      style={selected ? { backgroundColor: 'var(--accent)' } : undefined}
      className={`min-h-[44px] flex-1 rounded-full border-2 px-3 text-sm font-medium ${selected ? 'border-transparent text-white' : 'border-slate-300 dark:border-slate-700'}`}>
      {children}
    </button>
  );
}
