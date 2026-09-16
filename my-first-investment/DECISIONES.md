# Decisiones de implementación

Registro de decisiones tomadas donde la spec no definía la opción, eligiendo
siempre la más simple (como pide el documento).

## Estructura

1. **La app vive en `my-first-investment/`** dentro del repo, porque la raíz ya
   contenía otro proyecto (una invitación de boda). El build usa `base: './'`
   para funcionar desde cualquier hosting estático o subcarpeta.
2. **Capa de repositorio** en `src/data/repository.ts` (interfaz) +
   `src/data/localRepository.ts` (Dexie). `getRepository()` en
   `src/data/index.ts` es el único punto donde en Fase 2 se elegirá
   `SupabaseRepository` sin tocar UI ni lógica.

## Lógica

3. **Días anteriores al inicio del pacto no generan arrastre.** Si el pacto
   empieza a mitad de ciclo, el cálculo arranca en `pactStartDate` con
   arrastre 0 (evita "dinero fantasma" acumulado por días donde la app no
   existía).
4. **El número grande de Hoy** es `disponible − gastado hoy` (lo que queda por
   gastar ahora mismo), porque el objetivo de la spec es "saber cada día
   cuánto puede gastar". El límite base, el arrastre de ayer y lo gastado se
   muestran debajo.
5. **% del mes ahorrado vs meta** = `(metaAhorro + min(arrastre, 0)) / metaAhorro`,
   acotado a 0–100. La meta se aparta al inicio; solo el arrastre negativo la
   erosiona. El arrastre positivo no infla el % (se refleja en la sugerencia
   de inversión).
6. **Promedio mensual invertido** = total invertido ÷ meses desde el inicio
   del pacto (mínimo 1).
7. **Snapshots de límites**: al abrir la app se congela el límite base de los
   días ya transcurridos del ciclo actual. Así, cambiar parámetros a mitad de
   ciclo recalcula solo desde hoy.
8. **Hitos de racha** se celebran una sola vez; el último hito celebrado se
   recuerda en `localStorage`.
9. **Fecha estimada de logro** de metas de inversión: usa el promedio mensual
   invertido al 10% anual (la calculadora permite explorar otras tasas).

## Tarjeta de progreso (Fase 1)

10. **"JSON firmado"** = hash FNV-1a del contenido. Detecta corrupción o
    edición manual; la autenticidad real llega en Fase 2 con cuentas.
11. **Con `amounts = false`**: el resumen semanal viaja con los montos en 0
    (solo datos relativos: días bajo el límite, top categoría, % de cambio) y
    las metas monetarias viajan con `target = 0` y solo el % de progreso.
12. **QR no incluido** en Fase 1: se comparte por el menú nativo
    (`navigator.share` con archivo) o descarga directa del `.json`. Es la
    opción más simple y el archivo también sirve por WhatsApp/correo.

## UX

13. **Borrar en listas**: botón ✕ con confirmación en dos toques (en vez de
    swipe), más simple y accesible. Borrar todos los datos pide doble
    confirmación en modal, como pide la spec.
14. **Reordenar categorías** con botones ↑/↓ (sin drag & drop).
15. **Iconos PWA en SVG** (aceptados por navegadores modernos); si se quiere
    máxima compatibilidad de instalación en Android antiguos, generar PNG
    192/512 después.
16. **Cierre de mes**: el modal aparece automáticamente al abrir la app tras
    el fin del ciclo; "Ahora no" deja la tarjeta pendiente en Hoy (el ciclo
    no se considera cerrado hasta confirmar).

## Personalización (ronda 2, pedida por el usuario)

17. **Límite diario manual**: reemplaza la fórmula, pero el arrastre negativo
    del mes anterior se sigue repartiendo entre los días (para que un mes en
    rojo no desaparezca al activar el modo manual).
18. **Ajuste "solo hoy"**: reutiliza el mecanismo de snapshots por día — el
    ajuste ES un snapshot del día, que naturalmente gana sobre fórmula y
    límite manual, queda congelado en el historial y no toca otros días.
19. **Settings nuevos con migración aditiva**: `normalizeSettings` rellena
    los campos que no existían (tema, acento, estadísticas del Home, widgets)
    sin tocar lo ya configurado; no hace falta versionar la BD.
20. **Tema manual**: variante `dark` de Tailwind cambiada a clase (`.dark` en
    `<html>`); "Automático" sigue a `prefers-color-scheme` con listener.
21. **Color de acento**: variable CSS `--accent` (por defecto el verde de la
    marca) que el color del perfil sobreescribe si el usuario lo activa.
22. **Meta "Ahorro del mes" prorrateada** (corrige un bug reportado): el
    progreso es `metaAhorro × fracción del ciclo transcurrida + arrastre`,
    nunca < 0. Antes la meta configurada contaba completa desde el día 1 y
    una meta recién creada aparecía "Lograda" al instante. Las metas
    logradas ahora tienen botón "Reactivar".

## Mi plata (ronda 3, pedida por el usuario)

23. **Cuenta única derivada**: el saldo de "Mi plata" no se anota dos veces —
    se deriva del último cuadre ('set', el ancla) más los flujos posteriores:
    gastos restan, ingresos extra suman, inversiones restan (partida doble
    con el total invertido). Tabla nueva `cashEvents` (Dexie v2, migración
    aditiva).
24. **Cuadre semanal** (viernes por defecto, configurable): pregunta primero
    si entró el pago del trabajo (monto prellenado editable) y luego el saldo
    real. La diferencia contra lo calculado queda guardada en el propio
    cuadre ("¿se te olvidó anotar algún gasto?") y visible en el libro.
25. **Recordatorio diario** = tarjeta al abrir la app si ayer no se registró
    ningún movimiento (descartable por día vía localStorage). Notificaciones
    push reales con la app cerrada requieren servidor → Fase 2.
26. **Los cuadres no se borran** (son el ancla del cálculo); depósitos y
    pagos sí, desde el libro de movimientos.
27. **Pestaña "Plata"** (ronda 4): Mi plata tiene pantalla propia en la barra
    inferior (6 pestañas; "Calculadora" pasa a llamarse "Calc."), con saldo,
    patrimonio, cuadre, depósitos y libro completo. El widget compacto de Hoy
    se mantiene. Componentes compartidos viven en `screens/Cash.tsx`.
28. **Calendario interactivo en Historial** (ronda 4): reemplaza la rejilla
    de contribuciones por un calendario mensual navegable; tocar un día
    muestra su detalle completo (límite, disponible, gastado, arrastre,
    semáforo) y todos sus movimientos (gastos e ingresos editables al tocar,
    inversiones y movimientos de plata). Conserva los colores y el resumen
    de racha.
