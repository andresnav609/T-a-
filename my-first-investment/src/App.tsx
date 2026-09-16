import { useState } from 'react';
import { useApp } from './state/app';
import Onboarding from './screens/Onboarding';
import Today from './screens/Today';
import History from './screens/History';
import Investments from './screens/Investments';
import Calculator from './screens/Calculator';
import Pact from './screens/Pact';
import SettingsScreen from './screens/Settings';
import { MonthCloseModal } from './components/MonthCloseModal';
import { Modal, Button } from './components/ui';

export type Tab = 'hoy' | 'historial' | 'inversion' | 'calculadora' | 'pacto';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'hoy', label: 'Hoy', icon: '☀️' },
  { id: 'historial', label: 'Historial', icon: '📅' },
  { id: 'inversion', label: 'Inversión', icon: '📈' },
  { id: 'calculadora', label: 'Calculadora', icon: '🧮' },
  { id: 'pacto', label: 'Pacto', icon: '🤝' },
];

export default function App() {
  const app = useApp();
  const [tab, setTab] = useState<Tab>('hoy');
  const [showSettings, setShowSettings] = useState(false);
  const [showClose, setShowClose] = useState<boolean | null>(null); // null = aún no decidido

  if (app.loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
        <span className="text-5xl" aria-hidden>📈</span>
        <p className="font-semibold text-slate-500">My First Investment</p>
      </div>
    );
  }

  if (!app.profile) return <Onboarding />;

  // Cierre de mes automático al abrir la app tras el fin del ciclo.
  const closeOpen = app.pendingClose !== null && showClose !== false;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <div>
          <h1 className="text-sm font-bold tracking-wide text-slate-400 dark:text-slate-500">MY FIRST INVESTMENT</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Ajustes"
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl shadow-sm"
          style={{ backgroundColor: app.profile.color + '33' }}
        >
          {app.profile.emoji}
        </button>
      </header>

      <main className="flex-1 px-4 pb-28">
        {tab === 'hoy' && <Today goPact={() => setTab('pacto')} openClose={() => setShowClose(true)} />}
        {tab === 'historial' && <History />}
        {tab === 'inversion' && <Investments goCalc={() => setTab('calculadora')} />}
        {tab === 'calculadora' && <Calculator />}
        {tab === 'pacto' && <Pact goCalc={() => setTab('calculadora')} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95" aria-label="Navegación principal">
        <div className="mx-auto flex max-w-md justify-around pb-[env(safe-area-inset-bottom)]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                tab === t.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="text-xl" aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}

      {closeOpen && app.pendingClose && (
        <MonthCloseModal cycle={app.pendingClose} onDone={() => setShowClose(false)} onLater={() => setShowClose(false)} />
      )}

      {app.celebration && (
        <Modal open title="">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-2xl font-extrabold">{app.celebration.title}</p>
            <p className="text-slate-500 dark:text-slate-400">{app.celebration.subtitle}</p>
            <Button onClick={app.dismissCelebration} className="w-full">¡Seguimos!</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
