# Sorteos de navegadores archivados — 2026-10-14

Decisión de Amin (2026-10-14): archivar, no borrar. 98 documentos de `artifacts/EstimatedGamelottery-app/public/data/<juego>_drawings` creados por navegadores antes de la ingesta oficial.

- Copia: `archived_browser_drawings/<juego>__<id>` con todos los campos originales más `archivedAt`, `archivedReason` y `originalPath`. Cerrada a clientes en `firestore.rules`.
- Cada copia se releyó y comparó con el original antes de quitarlo (con precondición de que el original no cambió).
- Clasificación contra NY Open Data de la misma fecha (Millionaire For Life: conjunto `a4w9-a3tp`). El 2026-10-13 los 5 de Millionaire For Life figuraban «sin sorteo oficial» porque se comparaban con `kwxv-fwze` (Cash4Life).
- Script: `scripts/archivar-sorteos-navegador.js`. Copia previa completa: `gs://game-lottery-b0e90-firestore-backups-us/2026-10-14-antes-archivo`.
- Sin datos personales: solo juego, id del documento, fecha del sorteo y clasificación.

## Resumen

| Juego | Coincide | No coincide | Fecha sin sorteo | Vacío |
|---|---|---|---|---|
| powerball | 50 | 10 | 2 | 0 |
| megamillions | 7 | 9 | 3 | 0 |
| millionaireforlife | 5 | 0 | 0 | 1 |
| pick10 | 4 | 0 | 0 | 0 |
| take5day | 3 | 0 | 0 | 0 |
| take5eve | 4 | 0 | 0 | 0 |
| **Total** | 73 | 19 | 5 | 1 |

## Listado

| Juego | Id del documento | Fecha | Clasificación |
|---|---|---|---|
| powerball | `28yrhqrJEX2dSLXvvS7m` | 2026-01-21 | coincide |
| powerball | `36gxOB5pekyuCV4X6nBg` | 2025-12-22 | no coincide |
| powerball | `567mGvAYiQr08hop3Jzt` | 2025-12-08 | coincide |
| powerball | `57V5b3Ui8TssYpLquR8b` | 2025-11-15 | coincide |
| powerball | `5Ttpq7nP32PESFKLnjrI` | 2025-11-26 | coincide |
| powerball | `5dlnQ73FRTTdgevtrK9d` | 2026-09-07 | coincide |
| powerball | `5sSdRMquDIjiJMXEnBhI` | 2025-12-06 | coincide |
| powerball | `7KCa3aYzeAM9DBaQng2K` | 2026-01-12 | coincide |
| powerball | `8C1336J04GF0xbcq003D` | 2026-01-19 | coincide |
| powerball | `8F0gqqsibKoKl9w151tK` | 2026-01-07 | coincide |
| powerball | `8mdIInBjVg2uReWcNaAk` | 2026-02-11 | coincide |
| powerball | `AO3iGifFrWFdZQC9CYlA` | 2026-10-05 | no coincide |
| powerball | `B5yTB6CA9K6guhyzG8Kp` | 2026-02-28 | coincide |
| powerball | `B73C4leSmieiLY6ujTWU` | 2026-03-04 | coincide |
| powerball | `DO7mIJdMJHBJWkHcXw4n` | 2025-12-24 | coincide |
| powerball | `DxRijCboSUBUHk5yLHMg` | 2025-12-27 | coincide |
| powerball | `FBIUjd7OlsPafV36gu5F` | 2026-01-10 | coincide |
| powerball | `GmUA0BvyDfKVF2el33tF` | 2026-07-18 | no coincide |
| powerball | `H6hBZMgWkApTrgbCGxPb` | 2026-08-10 | no coincide |
| powerball | `IB12SQrB3O5lWfvP9SPE` | 2025-12-10 | coincide |
| powerball | `IUfEuWpRgLibb69oCWhy` | 2025-12-13 | coincide |
| powerball | `JivAOgDMDAQ62w4gd0f4` | 2026-02-09 | coincide |
| powerball | `K3zQuRelQFnkIBSK7XpJ` | 2026-01-31 | coincide |
| powerball | `KV48V9KW3ZnXWJlX6FkW` | 2026-06-27 | no coincide |
| powerball | `PAFh1UtRkb0iCO6JOyuZ` | 2025-11-24 | coincide |
| powerball | `PCLaVyu9NXG3n6SmbRCT` | 2026-02-25 | coincide |
| powerball | `QmnohhqxaNh1bMIHrwKZ` | 2025-11-08 | coincide |
| powerball | `RwMheqlxfp61mLnxyJmw` | 2025-11-17 | coincide |
| powerball | `WkzxxfHAAihmpCwuvZdL` | 2026-02-04 | coincide |
| powerball | `YQ5YPuZJuSpmXhwLl20v` | 2026-02-07 | coincide |
| powerball | `YvbEyW0GMEc8dAYHuFot` | 2026-02-23 | coincide |
| powerball | `Z50zNMcVxxMKpwCFfwEE` | 2026-08-12 | no coincide |
| powerball | `ZvzSaWhi3O76PM1gqnJK` | 2026-02-14 | coincide |
| powerball | `a55mbavkpxJXKciAOPXG` | 2026-08-16 | fecha sin sorteo |
| powerball | `aGXe9J5EO44yaNidGgGO` | 2026-01-17 | coincide |
| powerball | `arRTFOFfaKiJgDNEAf8V` | 2026-03-02 | coincide |
| powerball | `fWi4fw8x36lZCwRUF8dK` | 2025-12-01 | coincide |
| powerball | `fuxDQtq07JdoiSOZNpTi` | 2025-09-13 | no coincide |
| powerball | `gH5UhnB3AbcjoMCTbNrO` | 2026-02-16 | coincide |
| powerball | `i2rUtcsYwvHoxb4SOE9o` | 2026-01-28 | coincide |
| powerball | `iF1wL0zhg25BWLqhC8l4` | 2025-11-12 | coincide |
| powerball | `kvkYnJbDWpZAnVXHUtWG` | 2026-10-12 | coincide |
| powerball | `kx0va6U7k6ONnbdpKuEy` | 2025-11-29 | coincide |
| powerball | `lGVW9Sy3rH5ulMCa5VVu` | 2025-11-19 | coincide |
| powerball | `lp4bZ6yy29yfH1OEGBIH` | 2025-11-05 | coincide |
| powerball | `mW478nwluMT6PrRaz1Kg` | 2026-02-21 | no coincide |
| powerball | `n9WrnpJMufRupygBbqAv` | 2025-12-31 | coincide |
| powerball | `oBImpVB8QPXu8XDTYGnq` | 2026-04-04 | no coincide |
| powerball | `qGJrefSbVSmXpSVETka3` | 2025-11-10 | coincide |
| powerball | `qH0Ud5L29azLGCxO46oP` | 2026-01-03 | coincide |
| powerball | `sM1lywVSTc0Bw0rVktyy` | 2026-01-24 | coincide |
| powerball | `skDb8OokzGDBtvSQLEhg` | 2026-01-14 | coincide |
| powerball | `t3PsngZLH7v1E9p8In5w` | 2026-01-05 | coincide |
| powerball | `tUlhduRG7VBEuwN1Ut6R` | 2025-12-15 | coincide |
| powerball | `vKMi1exrWLMXaNU5fOjY` | 2026-02-18 | coincide |
| powerball | `vPUcx5awl9j5GbIEOjQ9` | 2025-11-22 | coincide |
| powerball | `vXY5Iz0OxIbwXhPi3D5q` | 2026-05-14 | fecha sin sorteo |
| powerball | `vfUKs9xILZOk7OuyXv1n` | 2025-12-20 | coincide |
| powerball | `wXn2ngYauKWlzNjTZ8po` | 2025-12-03 | coincide |
| powerball | `xxl0XPyLwCOwPfRbMQu6` | 2026-02-02 | coincide |
| powerball | `z409GeUB1LHIK52Ov2La` | 2026-08-03 | no coincide |
| powerball | `zTUX2N8gwN6fYHswjXOd` | 2025-12-17 | coincide |
| megamillions | `2uJ1DoTGxyf8CgjPfkvP` | 2023-12-22 | no coincide |
| megamillions | `5leVoUHBi0okUlDylYZH` | 2026-02-20 | coincide |
| megamillions | `72HPAfrenONEAppKWuYB` | 2026-07-17 | no coincide |
| megamillions | `AQ3DLIqVb7ZRLPrsWaKv` | 2026-07-07 | no coincide |
| megamillions | `HKQwNpkadvRSjl1cggj7` | 2024-01-05 | no coincide |
| megamillions | `Ln56Xc47sSL9Nqdy7J6X` | 2026-02-24 | coincide |
| megamillions | `LqkuwkMP2TTGyhb5mgIT` | 2026-02-13 | coincide |
| megamillions | `NqMO2dec4Cedk0r0V5dp` | 2026-03-06 | coincide |
| megamillions | `RzQCvDIGKYG2GvQltnIF` | 2026-04-10 | no coincide |
| megamillions | `W1jLgnTRuAlYM2yQqujf` | 2026-03-03 | coincide |
| megamillions | `XbD7FnqfLJMnOn8EyS20` | 2026-01-27 | no coincide |
| megamillions | `XmWPanlVjA7P4h1jpzht` | 2023-12-29 | no coincide |
| megamillions | `dHMRI8vpHWZLJmXRuxF9` | 2026-02-27 | no coincide |
| megamillions | `kSNaS62shk1ZcMoRk4Tu` | 2024-01-10 | fecha sin sorteo |
| megamillions | `mP5MO7rIyriJDbGU1Vpl` | 2026-02-17 | coincide |
| megamillions | `naAWjSgmGAMXKTFJbMsc` | 2026-01-30 | no coincide |
| megamillions | `s99JpunuyM3EEpW5a3wc` | 2025-09-18 | fecha sin sorteo |
| megamillions | `xadJKdBUnUH1sMKgnJlD` | 2026-02-10 | coincide |
| megamillions | `zIMz8oW7XV0dH1td6R5w` | 2024-01-15 | fecha sin sorteo |
| millionaireforlife | `1x2PORM9c6L2kqtg6tNs` | 2026-03-07 | coincide |
| millionaireforlife | `790aeVrseQK3ITEThtvq` | 2026-03-06 | coincide |
| millionaireforlife | `IQKv6vUoBKGzSTjsiyga` | 2026-02-23 | coincide |
| millionaireforlife | `J8hPeNa6gQdfZoKbORUA` | — | vacío |
| millionaireforlife | `Unr02qhDlLVbaiO04gZM` | 2026-02-22 | coincide |
| millionaireforlife | `vN8fTZcd9tEJDJBZOeKr` | 2026-03-08 | coincide |
| pick10 | `3BeA2QSxxkWUfnCBx40M` | 2026-03-09 | coincide |
| pick10 | `78KHBuQzrH13yFM5ov6E` | 2026-03-08 | coincide |
| pick10 | `lCxDlXO7EZheidUFrogs` | 2026-03-07 | coincide |
| pick10 | `ty7Yv7CQ31QttfcL3mGZ` | 2026-02-09 | coincide |
| take5day | `9RpkjATMHhtTFZk0NObq` | 2026-03-07 | coincide |
| take5day | `KxqR3obONOQOxwkwjKCA` | 2026-02-10 | coincide |
| take5day | `v9JuwXczBu9ul8qcJVe9` | 2026-03-08 | coincide |
| take5eve | `2nbdUrNG3eDxPlXN6k8a` | 2026-02-09 | coincide |
| take5eve | `Zv7WlpDMwIuhm7zwotvn` | 2026-03-08 | coincide |
| take5eve | `e7PT2Pb4Ax9Hl4JyiYXz` | 2026-03-06 | coincide |
| take5eve | `uJfqS6UhUoFL2ORWWIjS` | 2026-03-07 | coincide |
