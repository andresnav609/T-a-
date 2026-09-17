// Pacto — sección 8.5. Fase 1: el compañero se ve importando su tarjeta
// de progreso. Los datos ocultos por privacidad se muestran como "Privado".

import { useRef, useState } from 'react';
import { useApp } from '../state/app';
import { Card, Button, ProgressBar, EmptyState, Sheet, inputCls } from '../components/ui';
import { fmtMoney, timeAgo } from '../lib/format';
import { diffDays, todayISO } from '../lib/dates';

export default function Pact({ goCalc }: { goCalc: () => void }) {
  const app = useApp();
  const partner = app.partnerSnapshot;
  const [importOpen, setImportOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const pactDays = app.profile ? diffDays(app.profile.pactStartDate, todayISO()) + 1 : 0;

  const shareCard = async () => {
    const card = app.buildMyProgressCard();
    if (!card) return;
    const json = JSON.stringify(card, null, 2);
    const fileName = `progreso-${app.profile!.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    const file = new File([json], fileName, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mi progreso — My First Investment' });
        setShareMsg('Tarjeta compartida ✓');
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // canceló el menú nativo
    }
    // Fallback: descarga directa del archivo.
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setShareMsg('Tarjeta descargada: envíasela a tu compañero ✓');
  };

  const sharedGoals = app.goals.filter((g) => g.shared && g.status === 'active');
  const p = partner?.data;

  return (
    <div className="flex flex-col gap-3">
      {/* Encabezado: los dos avatares */}
      <Card className="text-center">
        <div className="mb-2 flex items-center justify-center gap-6">
          <Avatar emoji={app.profile!.emoji} color={app.profile!.color} name={app.profile!.name} />
          <span className="text-2xl" aria-hidden>🤝</span>
          {partner ? (
            <Avatar emoji={partner.partnerProfile.emoji} color={partner.partnerProfile.color} name={partner.partnerProfile.name} />
          ) : (
            <div className="flex flex-col items-center gap-1 opacity-40">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-slate-400 text-2xl">?</div>
              <p className="text-xs">Tu compañero</p>
            </div>
          )}
        </div>
        <p className="text-sm text-slate-500">
          {pactDays} {pactDays === 1 ? 'día' : 'días'} desde el inicio del pacto
        </p>
        {partner && (
          <p className="mt-1 text-xs text-slate-400">Perfil de {partner.partnerProfile.name} actualizado {timeAgo(partner.exportedAt)}</p>
        )}
      </Card>

      {/* Tarjetas lado a lado */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="mb-2 text-center text-sm font-bold" style={{ color: app.profile!.color }}>Tú</p>
          <PactStats
            streak={`${app.streak.current} 🔥 (mejor ${app.streak.best})`}
            savings={app.savingsPct !== null ? `${app.savingsPct}%` : '—'}
            invested={fmtMoney(app.totalInvested)}
            goals={String(app.goals.filter((g) => g.status === 'active').length)}
          />
        </Card>
        <Card>
          <p className="mb-2 text-center text-sm font-bold" style={{ color: partner?.partnerProfile.color }}>
            {partner ? partner.partnerProfile.name : 'Compañero'}
          </p>
          {partner ? (
            <PactStats
              streak={p?.streak ? `${p.streak.current} 🔥 (mejor ${p.streak.best})` : 'Privado'}
              savings={p?.savingsPct !== undefined && p.savingsPct !== null ? `${p.savingsPct}%` : p?.savingsPct === null ? '—' : 'Privado'}
              invested={p?.totalInvested !== undefined ? fmtMoney(p.totalInvested) : 'Privado'}
              goals={p?.goals ? String(p.goals.filter((g) => g.status === 'active').length) : 'Privado'}
            />
          ) : (
            <p className="py-4 text-center text-xs text-slate-400">Importa su tarjeta para ver su progreso</p>
          )}
        </Card>
      </div>

      {/* Metas compartidas */}
      {sharedGoals.length > 0 && (
        <Card>
          <p className="mb-2 font-semibold">Metas compartidas</p>
          <div className="flex flex-col gap-3">
            {sharedGoals.map((g) => {
              const { value, pct } = app.goalProgressFor(g);
              const partnerGoal = p?.goals?.find((pg) => pg.shared && pg.name === g.name);
              return (
                <div key={g.id}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <p className="font-medium">{g.name}</p>
                    <p className="text-sm tabular-nums text-slate-500">{pct}%</p>
                  </div>
                  <ProgressBar pct={pct} />
                  <p className="mt-1 text-xs text-slate-400">
                    {fmtMoney(value)} de {fmtMoney(g.target)}
                    {p?.totalInvested !== undefined && g.type === 'total_invested'
                      ? ` · tú ${fmtMoney(app.totalInvested)} + ${partner!.partnerProfile.name} ${fmtMoney(p.totalInvested)}`
                      : partnerGoal === undefined && partner ? ' (solo tu parte visible)' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Total del pacto */}
      <Card>
        <p className="mb-1 font-semibold">Total invertido del pacto</p>
        <p className="text-3xl font-extrabold tabular-nums text-emerald-500">
          {p?.totalInvested !== undefined ? fmtMoney(app.totalInvested + p.totalInvested) : fmtMoney(app.totalInvested)}
        </p>
        {p?.totalInvested === undefined && partner && (
          <p className="text-xs text-slate-400">(solo tu parte: el total de tu compañero es Privado)</p>
        )}
        <Button variant="secondary" className="mt-3 w-full" onClick={goCalc}>Proyección combinada 🧮</Button>
      </Card>

      {/* Resumen semanal del compañero */}
      {partner && (
        <Card>
          <p className="mb-2 font-semibold">Última semana de {partner.partnerProfile.name}</p>
          {p?.weekly ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MiniStat label="Días bajo el límite" value={`${p.weekly.daysUnderLimit} de 7`} />
              {p.weekly.topCategory && <MiniStat label="Top categoría" value={`${p.weekly.topCategory.emoji} ${p.weekly.topCategory.name}`} />}
              {p.weekly.spent > 0 ? (
                <>
                  <MiniStat label="Gastó" value={fmtMoney(p.weekly.spent)} />
                  <MiniStat label="Diferencia" value={fmtMoney(p.weekly.difference)} />
                </>
              ) : (
                <MiniStat label="Montos" value="Privado" />
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Privado</p>
          )}
        </Card>
      )}

      {/* Acciones Fase 1 */}
      <Card>
        <p className="mb-2 font-semibold">Compartir progreso</p>
        <p className="mb-3 text-sm text-slate-500">
          Genera tu tarjeta de progreso (respeta tu privacidad) y mándasela a tu compañero. Importa la suya para verla aquí.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={shareCard}>📤 Compartir mi progreso</Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            📥 {partner ? 'Actualizar perfil de mi compañero' : 'Importar perfil de mi compañero'}
          </Button>
          {shareMsg && <p className="text-center text-sm text-emerald-600 dark:text-emerald-400">{shareMsg}</p>}
        </div>
        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          🔜 <strong>Fase 2:</strong> con cuentas en la nube, ustedes se conectarán con un código de invitación y verán el progreso del otro en vivo, sin tarjetas.
        </p>
      </Card>

      {importOpen && <ImportSheet onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function Avatar({ emoji, color, name }: { emoji: string; color: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-14 w-14 items-center justify-center rounded-full text-2xl" style={{ backgroundColor: color + '33', border: `2px solid ${color}` }}>
        {emoji}
      </div>
      <p className="text-xs font-medium">{name}</p>
    </div>
  );
}

function PactStats({ streak, savings, invested, goals }: { streak: string; savings: string; invested: string; goals: string }) {
  const rows = [
    ['Racha', streak],
    ['% del mes', savings],
    ['Invertido', invested],
    ['Metas activas', goals],
  ];
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs text-slate-400">{label}</p>
          <p className={`font-semibold ${value === 'Privado' ? 'font-normal italic text-slate-400' : ''}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-semibold ${value === 'Privado' ? 'font-normal italic text-slate-400' : ''}`}>{value}</p>
    </div>
  );
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = async (json: string) => {
    const res = await app.importPartnerCard(json);
    if (res.ok) onClose();
    else setError(res.error ?? 'No se pudo importar.');
  };

  return (
    <Sheet open onClose={onClose} title="Perfil de mi compañero">
      <p className="mb-3 text-sm text-slate-500">
        Abre el archivo <code>.json</code> que te mandó tu compañero, o pega su contenido.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) doImport(await f.text());
        }}
      />
      <Button className="mb-3 w-full" onClick={() => fileRef.current?.click()}>Elegir archivo</Button>
      <textarea
        className={`${inputCls} mb-2 h-28 font-mono text-xs`}
        placeholder='{"v":1,"type":"mfi-progress",…}'
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        aria-label="Pegar tarjeta JSON"
      />
      <Button variant="secondary" className="w-full" disabled={!pasted.trim()} onClick={() => doImport(pasted)}>
        Importar lo pegado
      </Button>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {app.partnerSnapshot && (
        <Button variant="danger" className="mt-4 w-full" onClick={async () => { await app.removePartner(); onClose(); }}>
          Quitar perfil del compañero
        </Button>
      )}
    </Sheet>
  );
}
