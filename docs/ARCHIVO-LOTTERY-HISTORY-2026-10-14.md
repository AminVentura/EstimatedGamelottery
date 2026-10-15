# Archivo de lottery_history — 2026-10-14

Decisión de Amin del 2026-10-14. Script `scripts/archivar-lottery-history.js`, ejecutado el 2026-10-15 entre las 02:25 y las 02:30 UTC (noche del 14 de octubre en Nueva York) contra `game-lottery-b0e90`.
Copia previa: `gs://game-lottery-b0e90-firestore-backups-us/2026-10-14-pre-archivo-lottery-history` (SUCCESSFUL, 9 859 documentos).

Destino: `archived_lottery_history/<historyId>__<drawId>` (copia íntegra + `archivedAt`, `archivedReason`, `originalPath`). Cerrada a clientes en `firestore.rules`.
Sin datos personales: solo identificadores de sorteo, fecha, fuente y clasificación.

## Resumen

- Documentos en `lottery_history` antes: 2242; archivados: 256; se quedan: 1986 (todos coinciden con NY Open Data).

| historyId | Clasificación | Documentos |
|---|---|---|
| megamillions_2026 | mock_fallback (datos generados) | 51 |
| millionaireforlife_2025 | Cash4Life guardado como Millionaire For Life | 126 |
| millionaireforlife_2026 | Cash4Life guardado como Millionaire For Life | 39 |
| powerball_2026 | mock_fallback (datos generados) | 40 |

## Listado

| historyId | id | Fecha | source | Clasificación |
|---|---|---|---|---|
| megamillions_2026 | 2026-05-02 | 2026-05-02 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-03 | 2026-05-03 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-04 | 2026-05-04 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-06 | 2026-05-06 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-07 | 2026-05-07 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-09 | 2026-05-09 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-10 | 2026-05-10 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-11 | 2026-05-11 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-13 | 2026-05-13 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-14 | 2026-05-14 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-16 | 2026-05-16 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-17 | 2026-05-17 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-18 | 2026-05-18 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-20 | 2026-05-20 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-21 | 2026-05-21 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-23 | 2026-05-23 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-24 | 2026-05-24 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-25 | 2026-05-25 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-27 | 2026-05-27 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-28 | 2026-05-28 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-30 | 2026-05-30 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-05-31 | 2026-05-31 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-01 | 2026-06-01 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-03 | 2026-06-03 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-04 | 2026-06-04 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-06 | 2026-06-06 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-07 | 2026-06-07 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-08 | 2026-06-08 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-10 | 2026-06-10 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-11 | 2026-06-11 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-13 | 2026-06-13 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-14 | 2026-06-14 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-15 | 2026-06-15 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-17 | 2026-06-17 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-18 | 2026-06-18 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-20 | 2026-06-20 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-21 | 2026-06-21 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-22 | 2026-06-22 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-24 | 2026-06-24 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-25 | 2026-06-25 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-27 | 2026-06-27 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-28 | 2026-06-28 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-06-29 | 2026-06-29 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-01 | 2026-07-01 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-02 | 2026-07-02 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-04 | 2026-07-04 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-05 | 2026-07-05 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-06 | 2026-07-06 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-08 | 2026-07-08 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-09 | 2026-07-09 | mock_fallback | mock_fallback (datos generados) |
| megamillions_2026 | 2026-07-11 | 2026-07-11 | mock_fallback | mock_fallback (datos generados) |
| millionaireforlife_2025 | 2025-08-06 | 2025-08-06 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-07 | 2025-08-07 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-08 | 2025-08-08 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-09 | 2025-08-09 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-10 | 2025-08-10 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-11 | 2025-08-11 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-12 | 2025-08-12 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-13 | 2025-08-13 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-14 | 2025-08-14 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-15 | 2025-08-15 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-16 | 2025-08-16 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-17 | 2025-08-17 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-18 | 2025-08-18 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-19 | 2025-08-19 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-20 | 2025-08-20 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-21 | 2025-08-21 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-22 | 2025-08-22 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-25 | 2025-08-25 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-26 | 2025-08-26 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-27 | 2025-08-27 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-28 | 2025-08-28 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-29 | 2025-08-29 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-30 | 2025-08-30 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-08-31 | 2025-08-31 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-01 | 2025-09-01 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-02 | 2025-09-02 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-03 | 2025-09-03 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-04 | 2025-09-04 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-05 | 2025-09-05 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-06 | 2025-09-06 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-07 | 2025-09-07 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-08 | 2025-09-08 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-09 | 2025-09-09 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-10 | 2025-09-10 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-11 | 2025-09-11 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-12 | 2025-09-12 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-13 | 2025-09-13 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-14 | 2025-09-14 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-15 | 2025-09-15 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-16 | 2025-09-16 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-17 | 2025-09-17 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-18 | 2025-09-18 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-19 | 2025-09-19 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-20 | 2025-09-20 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-21 | 2025-09-21 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-22 | 2025-09-22 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-23 | 2025-09-23 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-24 | 2025-09-24 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-25 | 2025-09-25 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-27 | 2025-09-27 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-28 | 2025-09-28 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-29 | 2025-09-29 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-09-30 | 2025-09-30 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-01 | 2025-10-01 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-03 | 2025-10-03 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-06 | 2025-10-06 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-07 | 2025-10-07 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-08 | 2025-10-08 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-09 | 2025-10-09 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-10 | 2025-10-10 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-11 | 2025-10-11 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-13 | 2025-10-13 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-14 | 2025-10-14 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-15 | 2025-10-15 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-16 | 2025-10-16 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-17 | 2025-10-17 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-18 | 2025-10-18 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-19 | 2025-10-19 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-20 | 2025-10-20 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-21 | 2025-10-21 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-22 | 2025-10-22 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-26 | 2025-10-26 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-27 | 2025-10-27 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-28 | 2025-10-28 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-29 | 2025-10-29 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-30 | 2025-10-30 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-10-31 | 2025-10-31 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-01 | 2025-11-01 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-03 | 2025-11-03 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-04 | 2025-11-04 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-05 | 2025-11-05 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-06 | 2025-11-06 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-07 | 2025-11-07 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-08 | 2025-11-08 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-09 | 2025-11-09 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-10 | 2025-11-10 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-11 | 2025-11-11 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-12 | 2025-11-12 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-13 | 2025-11-13 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-15 | 2025-11-15 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-16 | 2025-11-16 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-17 | 2025-11-17 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-18 | 2025-11-18 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-19 | 2025-11-19 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-20 | 2025-11-20 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-21 | 2025-11-21 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-22 | 2025-11-22 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-24 | 2025-11-24 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-26 | 2025-11-26 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-27 | 2025-11-27 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-28 | 2025-11-28 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-29 | 2025-11-29 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-11-30 | 2025-11-30 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-02 | 2025-12-02 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-03 | 2025-12-03 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-04 | 2025-12-04 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-05 | 2025-12-05 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-06 | 2025-12-06 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-07 | 2025-12-07 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-09 | 2025-12-09 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-10 | 2025-12-10 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-11 | 2025-12-11 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-12 | 2025-12-12 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-13 | 2025-12-13 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-16 | 2025-12-16 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-19 | 2025-12-19 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-20 | 2025-12-20 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-21 | 2025-12-21 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-22 | 2025-12-22 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-23 | 2025-12-23 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-26 | 2025-12-26 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-27 | 2025-12-27 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-28 | 2025-12-28 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-29 | 2025-12-29 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-30 | 2025-12-30 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2025 | 2025-12-31 | 2025-12-31 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-01 | 2026-01-01 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-02 | 2026-01-02 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-05 | 2026-01-05 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-06 | 2026-01-06 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-07 | 2026-01-07 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-08 | 2026-01-08 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-10 | 2026-01-10 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-11 | 2026-01-11 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-13 | 2026-01-13 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-14 | 2026-01-14 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-16 | 2026-01-16 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-17 | 2026-01-17 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-18 | 2026-01-18 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-19 | 2026-01-19 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-22 | 2026-01-22 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-23 | 2026-01-23 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-24 | 2026-01-24 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-25 | 2026-01-25 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-26 | 2026-01-26 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-28 | 2026-01-28 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-29 | 2026-01-29 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-01-31 | 2026-01-31 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-01 | 2026-02-01 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-02 | 2026-02-02 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-04 | 2026-02-04 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-05 | 2026-02-05 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-06 | 2026-02-06 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-07 | 2026-02-07 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-09 | 2026-02-09 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-10 | 2026-02-10 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-11 | 2026-02-11 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-12 | 2026-02-12 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-13 | 2026-02-13 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-14 | 2026-02-14 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-15 | 2026-02-15 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-16 | 2026-02-16 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-18 | 2026-02-18 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-20 | 2026-02-20 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| millionaireforlife_2026 | 2026-02-21 | 2026-02-21 | ny_open_data | Cash4Life guardado como Millionaire For Life |
| powerball_2026 | 2026-05-03 | 2026-05-03 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-05 | 2026-05-05 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-07 | 2026-05-07 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-08 | 2026-05-08 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-10 | 2026-05-10 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-12 | 2026-05-12 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-14 | 2026-05-14 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-15 | 2026-05-15 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-17 | 2026-05-17 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-19 | 2026-05-19 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-21 | 2026-05-21 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-22 | 2026-05-22 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-24 | 2026-05-24 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-26 | 2026-05-26 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-28 | 2026-05-28 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-29 | 2026-05-29 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-05-31 | 2026-05-31 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-02 | 2026-06-02 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-04 | 2026-06-04 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-05 | 2026-06-05 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-07 | 2026-06-07 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-09 | 2026-06-09 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-11 | 2026-06-11 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-12 | 2026-06-12 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-14 | 2026-06-14 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-16 | 2026-06-16 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-18 | 2026-06-18 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-19 | 2026-06-19 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-21 | 2026-06-21 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-23 | 2026-06-23 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-25 | 2026-06-25 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-26 | 2026-06-26 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-28 | 2026-06-28 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-06-30 | 2026-06-30 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-07-02 | 2026-07-02 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-07-03 | 2026-07-03 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-07-05 | 2026-07-05 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-07-07 | 2026-07-07 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-07-09 | 2026-07-09 | mock_fallback | mock_fallback (datos generados) |
| powerball_2026 | 2026-07-10 | 2026-07-10 | mock_fallback | mock_fallback (datos generados) |
