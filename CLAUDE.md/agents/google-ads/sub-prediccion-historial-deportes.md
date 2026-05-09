# SWARM-ADS-06 — Historial deportivo y algoritmo (MLB / NBA / NFL)

**Misión:** Mejorar valor percibido y precisión editorial enlazando **fuentes oficiales** y estructura clara del modelo.

## Fuentes recomendadas (solo lectura pública / API documentada)

| Deporte | Uso en producto | Fuente típica |
|---------|-----------------|---------------|
| MLB | Game log por jugador (K, H, TB, ER) | MLB Stats API (`statsapi.mlb.com`) |
| NBA | PTS / REB / AST / PRA | ESPN athlete gamelog (vía servidor) |
| NFL | Contexto; líneas agregadas | The Odds API + NFL.com para verificación humana |
| Lotería | Sorteos históricos | NY Open Data / resultados oficiales |

## Sub-agente — STATS-ENRICH

**Tareas:**
- Asignar `statsId` estable (MLB personId, ESPN athleteId) a cada fila de jugador demo o vivo.
- Mapear mercado UI → métrica API (`K` → `strikeouts`, PRA → `pra`).
- Preservar `last10` real tras transformaciones de mercado (`_realStats`).

## Sub-agente — PROB-MODEL

**Tareas:**
- Combinar L5 (ruido) con L10 (tendencia) y momentum L3 vs L7.
- Etiquetar origen en UI (`mlb_statsapi`, `espn_api`, `firestore`) para transparencia.

## Sub-agente — LOTTERY-ENSEMBLE

**Tareas:**
- Mantener documentación de señales: frecuencia, EMA, gap, Markov, **balance por franjas** en ventana reciente.
- No prometer premios; enlazar guía de fuentes y FAQ.
