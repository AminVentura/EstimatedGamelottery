# Diagnóstico AdSense «Contenido de bajo valor» — prediccionloteria.com (2026-09-30)

Estado en AdSense: **Requiere atención — Contenido de bajo valor**. Base: código de `sitio/` (lo que se despliega), `sitemap.xml`, `robots.txt`, datos de NY Open Data consultados el 30-sep-2026 y la documentación oficial de Google.

## Qué dice Google (fuentes oficiales)

- Requisitos de AdSense ([support.google.com/adsense/answer/9724](https://support.google.com/adsense/answer/9724)): el contenido debe ser «high-quality, original, and attract an audience». No hay umbral de palabras ni de número de páginas.
- Políticas para editores de Google, apartado *Inventory value* ([support.google.com/adsense/answer/10502938](https://support.google.com/adsense/answer/10502938)): no se permiten anuncios en pantallas «without publisher-content or with low-value content», en construcción o usadas para navegación.
- Políticas de spam de Búsqueda ([developers.google.com/search/docs/essentials/spam-policies](https://developers.google.com/search/docs/essentials/spam-policies)): *scaled content abuse* (muchas páginas generadas sin ayudar al usuario) y *thin affiliation* (enlaces de afiliado sin contenido original).
- Restricciones para editores, juegos de azar ([support.google.com/adsense/answer/10437795](https://support.google.com/adsense/answer/10437795)): la compra online de boletos de lotería es contenido restringido (menos anunciantes); según la página, la restricción no se aplica al tráfico de EE. UU.

Conclusión de lectura: Google no mide palabras; mide si el sitio aporta algo propio y verificable que no esté ya en otra parte. Por eso **no** se añadieron artículos en masa.

## Inventario de páginas indexables (antes del arreglo)

`robots.txt` permite todo salvo `appcheck-test.html`, `exportar-logo-png.js`, `sw.js`. `sitemap.xml` tenía 19 URL. Palabras visibles contadas sin scripts ni estilos.

| Página | Palabras | Valoración |
|---|---|---|
| `/` (home) | 2 578 | Mucho texto, pero el producto es un generador de combinaciones; historial y estadísticas se pintan con JS. Título en inglés, H1 «Predicción de Lotería Profesional». Pie con **texto copiado de la NY Lottery** («© 2026 New York State Gaming Commission — All rights reserved»). |
| `/analisis/` | 291 | Hub. Frases escritas para el revisor («Esta sección existe para que Google…», «el tipo de contenido… que AdSense marca como de poco valor»). Dato erróneo: M4L «dataset kwxv-fwze». |
| `/analisis/powerball.html` … `win-4.html` (6) | 384–490 | Misma plantilla en las 6 (intro, «qué significa acertar», señales, próxima jugada, verificar). Hablan del funcionamiento interno de la herramienta, no del juego: **sin reglas completas, sin probabilidades por premio, sin resultados** rastreables. |
| `/analisis/mega-millions.html` | 490 | **Error factual**: Mega Ball 1–25 (desde el 8-abr-2025 es 1–24). |
| `/analisis/millionaire-for-life.html` | 447 | **Error factual**: usa el conjunto kwxv-fwze, que es de **Cash4Life** (retirado el 21-feb-2026, 1–60 + bola 1–4). La herramienta (`app.js`) cargaba esos sorteos como si fueran de M4L sin filtrar rango. |
| `/analisis/proxima-jugada.html` | 603 | Correcta. |
| `metodologia-estadistica.html` | 504 | Correcta. |
| `guia-fuentes-loteria-deportes.html` | 536 | Sección 5 = instrucciones internas de ads.txt/AdSense para el webmaster; «Documentación para usuarios y revisores». |
| `guia-lectura-resultados.html`, `faq.html`, `juego-responsable.html` | 344–453 | Aceptables. |
| `about.html` | 166 | **Fina**: sin quién está detrás, sin cómo se hace, sin financiación, sin correcciones. Sin navegación. |
| `contacto.html` | 97 | **Fina**: solo un correo (distinto del de la política de privacidad). Sin navegación. |
| Legales (privacidad, cookies, términos) | 288–354 | Correctas; titular `[PENDIENTE DATO REAL]`. |
| `appcheck-test.html` | 144 | **Página de prueba publicada** (bloqueada en robots, sin `noindex`). |
| `404.html` | 35 | `noindex`, correcto. |

Resumen: 1 página de prueba publicada, 2 finas (about, contacto), 7 de análisis con plantilla repetida y sin contenido propio verificable, 2 con errores factuales, 2 con texto dirigido al revisor, pie con texto de terceros. Ninguna página «próximamente». Navegación: solo la home tenía menú; las demás, una miga de pan o nada.

## Causas probables, por peso

1. **Nada propio y verificable que no esté en otra parte.** Las páginas de juego describían la herramienta del sitio, no el juego; las probabilidades y los resultados (lo que un lector busca) no estaban en el HTML.
2. **El producto central es un «predictor» de lotería**, una categoría que Google ve como de poco valor o engañosa salvo que el sitio demuestre con datos que no promete nada. Los avisos existían, pero sin datos que los respaldaran.
3. **E-E-A-T débil**: Acerca de y Contacto finas, sin responsable, titular sin confirmar, dos correos distintos.
4. **Texto copiado de terceros** en el pie de la home y **texto escrito para el revisor** en dos páginas.
5. **Errores factuales** (Mega Ball, M4L con datos de Cash4Life): restan confianza.
6. **Página de prueba publicada** y navegación inconsistente entre páginas.
7. (Riesgo aparte, no de «bajo valor») Bloque de afiliado Jackpocket de compra online de lotería: contenido restringido según la política de juegos de azar. Decisión de Amin.

## Arreglos aplicados (ver `docs/CAMBIOS-2026-09-30-adsense.md`)

- **Nueva** `probabilidades-loteria.html`: cálculo combinatorio de cada resultado en los 6 juegos, con fórmula, casos favorables y la cifra oficial al lado. Las 9 de Powerball (powerball.com), las 9 de Mega Millions (megamillions.com) y 4 de M4L (nclottery.com) coinciden con la cifra oficial; la global de Powerball sale 1 en 24,87, igual que la oficial. Pick 10 (6) y Take 5 (4) coinciden con las cifras que reproducen guías públicas; la página de la NY Lottery se carga con JS y no se pudo leer automáticamente, así que el pie de tabla lo dice.
- **Páginas de juego**: sección «Probabilidades reales, calculadas» y «Últimos resultados oficiales y prueba de azar» (tabla de sorteos con fuente y fecha + chi-cuadrado de uniformidad; en Win 4, comparación de tipos de número observados con la combinatoria). Mega Millions: se documenta que el conjunto oficial tiene 17 sorteos desde abr-2025 frente a ~147 esperados y por eso no se publican frecuencias. Todo generado por `scripts/contenido-estatico.mjs` en HTML estático.
- **Errores corregidos**: Mega Ball 1–24 (páginas, `app.js`, formulario de la home); M4L ya no carga Cash4Life (`app.js` filtra fecha ≥ 2026-02-22 y rango 5×1–58 + 1–5).
- **Acerca de** (652 palabras) y **Contacto** (257) reescritas con datos reales y `[PENDIENTE DATO REAL]` donde falta.
- **Navegación y pie comunes** en 19 páginas (`scripts/aplicar-plantilla.mjs`).
- **Home**: título en español y H1 sin «Profesional»/«con IA»; pie con texto propio (fuera el texto y el copyright de la NY Gaming Commission).
- **Quitado**: texto dirigido al revisor; sección de ads.txt de la guía de fuentes (sustituida por una tabla de cobertura real de cada conjunto de datos).
- **Fuera de indexación**: `appcheck-test.html` con `noindex` y excluida del hosting (`firebase.json` → `ignore`, junto a `run-walkforward.mjs`, `exportar-logo-png.js`, `LEEME-LOGO-ADSENSE.txt`). `404.html` excluida del sitemap. Sitemap regenerado: 20 URL.

## Datos pendientes de Amin (`[PENDIENTE DATO REAL]`)

1. Nombre legal exacto y estado de constitución de Businessskore LLC (about, contacto, términos, privacidad).
2. Nombre y función de la persona responsable del contenido (about).
3. Dirección postal (contacto).
4. Confirmar que `contacto@prediccionloteria.com` reenvía a un buzón que lees (el dominio tiene MX de Namecheap eforward) y unificar con `prediccionloteria@gmail.com` de la política de privacidad.
5. Decidir si se queda el bloque de afiliado Jackpocket.
6. `functions/index.js` sigue con Mega Ball 1–25 y M4L = kwxv-fwze (agente del servidor). No se tocó porque el despliegue autorizado es solo hosting.
