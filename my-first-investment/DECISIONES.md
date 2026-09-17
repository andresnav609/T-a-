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

## Predicciones "Tu futuro" (ronda 5, pedida por el usuario)

29. **Motor local, no ML en la nube**: predicción estadística + Monte Carlo
    (400 simulaciones, RNG sembrado para reproducibilidad) corriendo en el
    celular. Nada sale del dispositivo. `src/lib/forecast.ts`.
30. **Modelo de gasto**: media y desviación por día de semana con
    encogimiento hacia la media global, prior de configuración (límite base)
    con peso de 7 días para funcionar desde el día 1, tendencia lineal
    amortiguada al 50% y acotada a ±2%/día. Solo pesan las últimas 8 semanas.
31. **Ingresos**: pagos observados (eventos 'salary') mandan sobre el monto
    configurado y sobre salario/52. Ingresos extra = promedio semanal de las
    últimas 8 semanas. Inversión mensual = promedio de los últimos 3 cierres
    (o la meta de ahorro si no hay cierres).
32. **Rangos honestos**: se muestra p50 con banda p10–p90 (abanico) y
    etiqueta de confianza según días de datos (config <7, aprendiendo <28,
    sólida 28+). Aviso si el escenario pesimista cae a negativo.
33. **Metas**: fecha de cruce con el camino esperado determinista (hasta 10
    años), más la variante "gastando $2 menos al día".

## Acciones con precios nocturnos (ronda 6, pedida por el usuario)

34. **Robot nocturno en GitHub Actions** (no "Claude corriendo de noche"):
    cron diario 03:00 UTC descarga cierres de Stooq (gratis, sin API key)
    para los tickers de `stocks/tickers.json` y publica `prices.json` en
    gh-pages. El deploy usa `keep_files: true` para no borrarlo. El cron solo
    corre desde la rama por defecto del repo, así que el YAML vive ahí y hace
    checkout de la rama de la app para el script.
35. **Posiciones privadas, precios públicos**: al repo solo van los tickers;
    cuánto y cuándo compró cada quien queda en su celular (Dexie v3,
    `stockPositions`, incluido en el respaldo).
36. **Registro por monto en $** (fracciones): precio prellenado con el cierre
    de la fecha de compra, corregible con el del broker. Vendida = congelada
    con su precio de venta; se conserva hasta borrarla.
37. **Separado de Mi plata** (decisión del usuario): la sección muestra
    "de tu bolsillo" vs "valor hoy" y no toca la cuenta de banco ni las
    predicciones. Ante fallo de un ticker, el robot conserva la serie
    anterior; la app cachea el último prices.json para funcionar offline.
38. **Cuadre con aportes** (ronda 6b): en Mis acciones, la app compara los
    aportes anotados (Total invertido) contra las compras de acciones:
    aportes − compras + ventas = efectivo en el broker. Si da negativo
    (compraste más de lo aportado) lo marca como discrepancia y ofrece
    anotar el aporte faltante con un toque.
