# SWARM-ADS-05 — ads.txt y rastreo de Google

**Misión:** Resolver avisos de AdSense del tipo «No se detectó ningún archivo ads.txt» o estado «Requiere revisión».

## Checklist técnico

1. **Ubicación:** `https://www.TUDOMINIO.com/ads.txt` y, si usas apex, `https://TUDOMINIO.com/ads.txt` (mismo contenido o redirección 301 coherente).
2. **Formato:** `text/plain; charset=utf-8`, una línea de registro IAB por proveedor autorizado (p. ej. `google.com, pub-XXXXXXXX, DIRECT, f08c47fec0942fa0`).
3. **Despliegue:** El archivo debe estar en la carpeta pública del hosting (p. ej. Firebase `public`/`sitio`), no solo en el repo sin publicar.
4. **SPA / rewrites:** Si hay fallback `** → /index.html`, comprobar que `ads.txt` sigue sirviendo como archivo estático (Firebase lo hace si el fichero existe en `public`).
5. **Cabeceras:** Evitar `X-Robots-Tag: noindex` en `ads.txt` (puede interferir con validaciones). Caché razonable (`max-age=3600`–86400).
6. **Verificación:** En AdSense → Sitios → ads.txt → Comprobar. Tras corregir, solicitar revisión del sitio.

## Sub-agente — ADS-TXT-DEPLOY

**Disparador:** Mensaje de Google sobre ads.txt ausente.

**Pasos:** Localizar `pub-` en la cuenta AdSense → escribir `ads.txt` → desplegar → `curl -sI https://www.dominio/ads.txt` debe devolver 200 y `content-type: text/plain`.
