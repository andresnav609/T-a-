# My First Investment 📈

App PWA para un **pacto entre dos amigos** que quieren ahorrar e invertir
juntos: límite diario de gasto, arrastre, cierre de mes con sugerencia de
inversión, rachas, metas, resumen semanal, calculadora de inversiones completa
y perfil del compañero de pacto.

**Fase actual: 1 (Prototipo).** Datos 100% locales (IndexedDB), funciona
offline e instalada en el celular. El progreso se comparte con el compañero
mediante una **tarjeta de progreso** (archivo JSON firmado que respeta tus
controles de privacidad).

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # tests de la lógica (Vitest) — 23 tests de la spec
npm run build      # build de producción + service worker PWA en dist/
npm run preview    # sirve el build localmente
```

Stack: React + Vite + TypeScript, Tailwind CSS, Recharts, Dexie (IndexedDB),
vite-plugin-pwa, Vitest.

## Cómo mandarle la app a tu amigo

La carpeta `dist/` es un sitio estático: se puede publicar gratis en cualquier
hosting y tu amigo la **instala como app** desde el navegador.

1. **Netlify / Vercel / Cloudflare Pages** (recomendado): conecta este repo,
   apunta el proyecto a la carpeta `my-first-investment/` con build
   `npm run build` y directorio de salida `dist/`. Te da una URL https.
2. Tu amigo abre la URL en su celular → menú del navegador →
   **"Agregar a pantalla de inicio"** (o "Instalar app"). Queda instalada,
   con icono y funcionando offline.
3. Cada uno usa su propia instalación con su propio perfil. Para verse:
   **Pacto → Compartir mi progreso** genera la tarjeta; el otro la importa en
   **Pacto → Actualizar perfil de mi compañero**.

> El build usa rutas relativas (`base: './'`), así que también funciona en
> GitHub Pages o en cualquier subcarpeta.

## Sincronización futura (Fase 2)

Toda la lectura/escritura de datos pasa por la interfaz `Repository`
(`src/data/repository.ts`). La Fase 2 agrega:

- **Supabase**: Auth (magic link), Postgres con Row Level Security, Realtime.
- `SupabaseRepository` implementando la misma interfaz — la UI y la lógica de
  `src/lib/` no cambian.
- Pacto con código de invitación (máx. 2 miembros), vista `shared_progress`
  que expone al compañero solo lo permitido por privacidad, migración
  "Subir mis datos locales" y cola offline.

La estructura ya está preparada: entidades con `userId`, tipos compartidos en
`src/lib/types.ts` y el punto único `getRepository()` en `src/data/index.ts`.

## Estructura

```
src/
  lib/          lógica pura + tests (budget, streak, weekly, goals,
                investment, share, history, dates)
  data/         interfaz Repository + LocalRepository (Dexie)
  state/        contexto global (carga, derivados, automatizaciones)
  screens/      Hoy · Historial · Inversión · Calculadora · Pacto ·
                Ajustes · Onboarding
  components/   UI compartida (sheet, teclado numérico, modales…)
```

Ver `DECISIONES.md` para las decisiones tomadas donde la spec no definía
opción.
