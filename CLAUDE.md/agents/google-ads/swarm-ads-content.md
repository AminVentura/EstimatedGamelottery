# 🟣 SWARM-ADS-CONTENT — Contenido de valor para Google Ads / AdSense
> **Contexto:** Sitios marcados como «contenido de bajo valor» o rechazos en la revisión de anunciantes.
> **Objetivo:** Orquestar investigación, redacción útil, cumplimiento de políticas y señales técnicas de página — sin relleno genérico ni texto copiado.
> Última actualización: 2026-05-09

---

## Rol del orquestador (AGENTE ADS-ORCH)

**Misión:** Llevar la URL rechazada por un pipeline reproducible hasta tener un plan de contenido + cambios de página verificables.

**Orden de trabajo (no negociable):**
1. **ADS-POLICY** — Confirmar que el nicho y las promesas de la página cumplen [Políticas para editores de Google](https://support.google.com/adsense/answer/48182) y [Contenido original y de calidad](https://support.google.com/adsense/answer/10502938). Si el sitio mezcla temas no relacionados (p. ej. lotería + barbería), separar sitios o secciones con intención clara.
2. **ADS-RESEARCH** — Si el nicho es **barbería / peluquería masculina**, ejecutar el protocolo en `sub-research-barberia.md`. Si el sitio es **lotería USA + dashboard deportivo (MLB/NFL/NBA)**, usar `sub-prediccion-historial-deportes.md` y la guía pública de fuentes. Para otros nichos, adaptar la misma estructura (preguntas reales de usuario, vocabulario técnico, fuentes).
3. **ADS-EDITORIAL** — Convertir la investigación en artículos/guías con estructura E-E-A-T según `sub-ads-editorial-eeat.md`.
4. **ADS-TECH** — Meta descripciones únicas, títulos H1–H3, datos estructurados donde aplique, navegación y páginas legales enlazadas — `sub-ads-technical-page.md`. Incluir verificación de **`ads.txt`** — `sub-ads-ads-txt-crawl.md`.

**Salida esperada del enjambre (entregable):**
- Lista de 3–8 URLs nuevas o ampliadas con propósito claro cada una.
- Borradores con fuentes citadas (no copia literal de otros sitios).
- Checklist de política marcada (sí/no) con evidencia en la propia página.

---

## Sub-agentes — Referencia rápida

| ID | Archivo | Función |
|----|---------|---------|
| SWARM-ADS-01 | `sub-ads-policy-google.md` | Alineación con políticas Google (contenido prohibido, originalidad, experiencia del usuario) |
| SWARM-ADS-02 | `sub-research-barberia.md` | Investigación de dominio: barberías, cortes, herramientas, tendencias |
| SWARM-ADS-03 | `sub-ads-editorial-eeat.md` | Estructura editorial, profundidad, evitar contenido superficial |
| SWARM-ADS-04 | `sub-ads-technical-page.md` | SEO on-page, schema, rendimiento básico, enlaces internos |
| SWARM-ADS-05 | `sub-ads-ads-txt-crawl.md` | ads.txt accesible, tipo MIME, despliegue y revisión AdSense |
| SWARM-ADS-06 | `sub-prediccion-historial-deportes.md` | Fuentes MLB/NBA/NFL, enrichment de jugadores, modelo de probabilidad |
| SWARM-ADS-PRED | `swarm-ads-prediccion-site.md` | Orquestador específico prediccionloteria.com |

---

## Reglas anti–«bajo valor» (todas las tareas)

- **No** publicar párrafos genéricos rellenables en cualquier sitio («En la actualidad, la barbería es muy importante…»).
- **Sí** datos accionables: frecuencia de corte, tipos de rostro y estilos, mantenimiento de barba, diferencias fade/taper, higiene de herramientas, cómo elegir barbero.
- **No** duplicar masivamente el mismo bloque en muchas URLs.
- **Sí** autoría o «quién escribe» si aplica (negocio real, dirección, horario, contacto) para reforzar confianza.

---

## Activación

```
Rechazo AdSense / «contenido de bajo valor» / revisión de anunciantes
  → SWARM-ADS-ORCH
  → SWARM-ADS-01 (política)
  → SWARM-ADS-02 (investigación de nicho; barbería → sub-research-barberia.md)
  → SWARM-ADS-03 (redacción)
  → SWARM-ADS-04 (página técnica)
```
