# Cambios 2026-09-30 — AdSense «Contenido de bajo valor»

Diagnóstico completo: `docs/ADSENSE-BAJO-VALOR-2026-09-30.md`. Criterio: calidad y datos propios verificables, no cantidad. Ningún artículo generado en masa; una sola página nueva.

## Páginas nuevas
- `sitio/probabilidades-loteria.html` — probabilidades de cada resultado en Powerball, Mega Millions, Millionaire For Life, Pick 10, Take 5 y Win 4 por combinatoria (fórmula + casos favorables + cifra oficial al lado), mitos frecuentes y cómo comprobarlo en una hoja de cálculo.

## Páginas reescritas o ampliadas
- `analisis/powerball|mega-millions|millionaire-for-life|pick-10|take-5|win-4.html`: sección «Probabilidades reales, calculadas»; en Powerball, Pick 10, Take 5 y Win 4, además, «Últimos resultados oficiales y prueba de azar» (tabla con fuente NY Open Data y fecha de la instantánea, chi-cuadrado de uniformidad; Win 4 compara tipos de número observados con los esperados). Mega Millions: nota con la incompletitud del conjunto oficial (17 sorteos frente a ~147 esperados desde abr-2025).
- `about.html`: quién opera, qué hace y qué no, fuentes, cómo se calculan los datos y uso de IA, financiación (AdSense con consentimiento, afiliado Jackpocket), correcciones, juego responsable.
- `contacto.html`: correo, titular y dirección (`[PENDIENTE DATO REAL]`), cómo reportar errores, privacidad, adónde ir para premios y ayuda.
- `guia-fuentes-loteria-deportes.html`: fuera la sección interna de ads.txt/AdSense; nueva tabla de cobertura y estado de cada conjunto de datos.
- `analisis/index.html`: fuera el texto dirigido al revisor; corregido M4L; enlace a probabilidades.
- `index.html`: título en español; H1 «Análisis estadístico de lotería USA»; subtítulo sin «Predicciones con IA»; enlaces a Probabilidades; **pie con texto propio** (fuera el texto y el copyright copiados de la NY Gaming Commission).
- Navegación y pie comunes en las 19 páginas secundarias (`scripts/aplicar-plantilla.mjs`; sustituye al aviso suelto del 29-sep, que sigue dentro del pie: +18/21+, sin garantía, juego responsable).

## Correcciones factuales
- Mega Ball 1–24 (antes 1–25): `analisis/mega-millions.html`, `app.js` (`specialMax: 24`), formulario de la home.
- Millionaire For Life: el conjunto kwxv-fwze es de Cash4Life (retirado). `app.js` solo acepta filas desde el 2026-02-22 y dentro de rango (5 × 1–58 + 1–5), lo que hoy deja fuera todos los sorteos de Cash4Life. Página corregida.

## Indexación
- `appcheck-test.html`: `noindex, nofollow` y excluida del hosting junto con `run-walkforward.mjs`, `exportar-logo-png.js`, `LEEME-LOGO-ADSENSE.txt` (`firebase.json` → `hosting.ignore`).
- `generate-sitemap.js`: excluye `404.html`; prioridades para `probabilidades-loteria.html` y `terminos.html`. `sitemap.xml` regenerado: 20 URL.

## Scripts nuevos
- `scripts/contenido-estatico.mjs` — regenera probabilidades e historial (`--sin-red` para solo probabilidades). Volver a correrlo para refrescar resultados; luego `node generate-sitemap.js` y deploy.
- `scripts/aplicar-plantilla.mjs` — navegación y pie comunes (idempotente).

## Sin cambios (se mantienen)
`consent.js` y Consent Mode v2, sin «efectividad», avisos +18/21+ y juego responsable, `ads.txt`, `robots.txt`, legales.

## Verificación
- `html-validate@8` (reglas recomendadas, sin las de estilo) sobre las 19 páginas secundarias: 0 errores; `index.html` sin errores de estructura (close-order, dup-id, contenido permitido).
- `node --check`: `sitio/app.js`, `sitio/consent.js`, `sitio/sw.js`, `scripts/*.mjs`, `generate-sitemap.js` OK.
- `functions`: `npm test` 10/10.
- Servidor estático local (`python -m http.server`): rastreo de todos los enlaces internos desde `/` → 20 páginas, 26 URL, **0 rotos**. Móvil 375 px: sin scroll horizontal de página (las tablas se desplazan dentro de su contenedor).
- Cifras: las 9 de Powerball, 9 de Mega Millions y 4 de M4L coinciden con las oficiales; Pick 10 y Take 5 coinciden con las cifras redondeadas publicadas.

## Tareas de Amin
1. Datos `[PENDIENTE DATO REAL]`: nombre legal y estado de la LLC, responsable del contenido, dirección postal; confirmar que `contacto@prediccionloteria.com` llega a un buzón y unificar con el correo de la política de privacidad.
2. Decidir el bloque de afiliado Jackpocket (compra online de lotería = contenido restringido de juegos de azar).
3. `functions/index.js` sigue con Mega Ball 1–25 y M4L = kwxv-fwze: corregir y desplegar functions cuando lo autorices.
4. Pedir la revisión en AdSense según el paso a paso de la nota de Obsidian (no antes de 48–72 h tras el deploy).

## Publicación (autorizada por Amin)
- Commit `aee51df` en `develop`, push a `origin/develop` OK. No entran `serviceAccountKey.json`, `.env`, `docs/AUDITORIA*`, `docs/SRS*`, `CLAUDE.md/`, `.claude/` ni notas internas sin seguimiento.
- `firebase deploy --only hosting --project game-lottery-b0e90` → «Deploy complete».
- curl en producción (www): 200 en `/`, `/probabilidades-loteria.html`, `/about.html`, `/contacto.html`, `/analisis/powerball.html`, `/analisis/win-4.html`, `/analisis/mega-millions.html`, `/guia-fuentes-loteria-deportes.html`, `/sitemap.xml` (20 `<loc>`), `/robots.txt`, `/ads.txt`, `/consent.js`; 404 en `/appcheck-test.html` y `/no-existe-xyz`. Home con el H1 nuevo, `consent.js` presente y sin «All rights reserved» de la NY Gaming Commission. `app.js` servido con `specialMax: 24`.

## Actualización 2026-10-02 (datos de Amin + functions)
Autorizado por Amin: titular «Businessskore LLC», correo único `businessskore@gmail.com`, responsable del contenido «Businessskore LLC», sin dirección postal, Jackpocket se mantiene con su aviso de afiliado.
- `about`, `contacto`, `politica-privacidad`, `terminos`, `politica-cookies`: titular y correo nuevos; quitados `contacto@prediccionloteria.com` y `prediccionloteria@gmail.com`; quitada la línea de dirección. Términos §8 pasa a «Reclamaciones» (sin ley aplicable inventada). `grep PENDIENTE sitio/` → 0.
- `functions/index.js`: Mega Millions `bonusPool`/`specialMax` 24 y `rulesSince: '2025-04-08'`; Millionaire For Life `rulesSince: '2026-02-22'` (descarta Cash4Life) y lee `millionaire_ball` antes que `cash_ball`. `normalizeDraw` descarta sorteos anteriores a `rulesSince`. `node --check` OK; `npm test` 10/10.
- Deploy: `firebase deploy --only hosting,functions:trainLotteryAgent,functions:ingestOfficialLotteryResults,functions:getLotteryAgentInsight,functions:getLotteryAgentsBoard`. No se hizo `--only functions` completo porque producción tiene `getLotteryDrawHistory` y `getLotteryRecentHistories`, que no están en el código: un deploy completo propondría borrarlas. Las 4 funciones: «Successful update operation». No faltó ningún secreto.
- Verificación: curl 200 en las 5 páginas, correo nuevo visible, 0 «PENDIENTE», 0 correos viejos. `firebase functions:list`: 26 funciones (las mismas que antes).
- Pendiente: `getLotteryDrawHistory` y `getLotteryRecentHistories` existen en producción sin código en el repo (decidir si se recuperan o se retiran). `estimatePreferredNumbers` está en el código pero no desplegada.
