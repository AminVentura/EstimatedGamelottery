# Game Lottery (prediccionloteria)

Web estática en `sitio/` (Firebase Hosting, proyecto `game-lottery-b0e90`), con Cloud Functions en `functions/` y reglas en `firestore.rules`.

## Ramas y publicación (política de Amin, 2026-11-15)

- `develop` = pruebas. Todo el trabajo entra aquí primero (desde ramas `feat/*`, `fix/*`).
- Cuando todo pasa en `develop`, se fusiona a `main`.
- **Producción sale solo de `main`.** Se publica a mano, desde `main`:

  ```
  git checkout main
  git pull --ff-only
  firebase deploy --only hosting --project game-lottery-b0e90
  ```

- No se publica desde `develop` ni desde otra rama. Ningún workflow de GitHub publica al subir.

## Pruebas antes de pasar a `main`

```
node --test tests/web/*.test.mjs
cd functions && npm test
cd tests/rules && npm test        # emulador de Firestore
```

## No va al repositorio

- La carpeta `CLAUDE.md/` (memoria de agentes) salvo lo ya versionado en `CLAUDE.md/agents/`.
- `serviceAccountKey.json`, `.env` y cualquier credencial.
