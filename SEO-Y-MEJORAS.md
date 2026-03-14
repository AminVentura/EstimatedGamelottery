# SEO y mejoras de código – prediccionloteria.com

## 1. Robots.txt – solución urgente

### Código correcto (ya aplicado en `sitio/robots.txt`)

```txt
User-agent: *
Allow: /

Sitemap: https://www.prediccionloteria.com/sitemap.xml
```

### Dónde subir el archivo

- **Firebase Hosting:** El sitio está en la carpeta `sitio`. El archivo debe estar en la **raíz de lo que se publica**, es decir:
  - **Ruta en el proyecto:** `sitio/robots.txt`
  - **URL pública:** `https://www.prediccionloteria.com/robots.txt`

- **Otro hosting (cPanel, etc.):** Sube `robots.txt` en la **raíz del dominio** (por ejemplo `public_html/` o la carpeta que sea la raíz del sitio). La URL debe ser exactamente `https://tudominio.com/robots.txt`.

### Comprobar que funciona

1. Despliega los cambios.
2. Abre en el navegador: `https://www.prediccionloteria.com/robots.txt`
3. Debe verse el texto plano (User-agent: *, Allow: /, Sitemap: ...), **no** la página principal.
4. En Google Search Console → Configuración → Volver a comprobar la URL de robots.txt.

---

## 2. Sitemap.xml

El sitemap ya existe en `sitio/sitemap.xml` y está referenciado en `robots.txt`. Se actualizó `lastmod` a la fecha actual. Si añades más páginas (por ejemplo una página de Aviso Legal independiente), añade su `<url>` al sitemap.

---

## 3. Tres mejoras de código para velocidad y SEO (YA APLICADAS)

### A) Carga y prioridad de recursos (velocidad) ✅

- **Problema:** Tailwind desde CDN, Font Awesome y fuentes Google cargan en el `<head>` y pueden bloquear el primer render.
- **Cambios recomendados:**
  - Añadir `rel="preload"` para la fuente principal y para `styles.css`.
  - Cargar Font Awesome con `media="print" onload="this.media='all'"` o mover el `<link>` al final del `<body>` para que no bloquee.
  - Considerar sustituir el CDN de Tailwind por una build compilada (Tailwind CLI o npm) y servir un único CSS minificado; reduce tamaño y peticiones.

### B) Scripts y primer render (velocidad + UX) ✅

- **Problema:** `app.js` y `lottery-algorithms.js` son `type="module"` (bien), pero el `alert()` legal en `window.addEventListener('load', ...)` bloquea al usuario y puede afectar métricas (por ejemplo LCP/CLS si se muestra tarde).
- **Cambios recomendados:**
  - Quitar el `alert()` y dejar solo el banner de cookies y la sección “Aviso Legal” en la página; así no bloqueas el hilo principal y mejora la experiencia.
  - Mantener los scripts de módulo; si en el futuro añades más JS, cargar con `defer` o al final del `<body>` para no bloquear el parser.

### C) Estructura para SEO (schema y meta) ✅

- **Problema:** Un solo `WebPage` en JSON-LD está bien, pero se puede afinar para que Google entienda mejor el sitio y los juegos.
- **Cambios recomendados:**
  - Añadir `"inLanguage": "en"` (o "es" si mantienes español) y `"dateModified"` en el JSON-LD.
  - Incluir `WebSite` con `url` y `potentialAction` (por ejemplo SearchAction) si tienes o tendrás búsqueda.
  - Mantener la meta `description` por debajo de ~155 caracteres para que no se corte en resultados de búsqueda (la actual ya está dentro de rango).

---

## Resumen de lo aplicado en el repo

| Tarea                    | Estado |
|--------------------------|--------|
| robots.txt estándar      | ✅ En `sitio/robots.txt` |
| Cabeceras Firebase       | ✅ Content-Type y Cache-Control para robots.txt; Content-Type para sitemap.xml |
| sitemap.xml              | ✅ Actualizado lastmod |
| Sección Aviso Legal      | ✅ HTML + CSS (fondo oscuro, texto dorado/claro) |
| Meta title/description   | ✅ Orientados a USA, nacional, todos los estados |
| Schema JSON-LD           | ✅ Texto alineado con “national / all states” |

Despliega los cambios, verifica la URL de robots.txt en el navegador y en Search Console, y en unos días debería desaparecer el error “Robots.txt unreachable” si el archivo se sirve correctamente desde la raíz.
