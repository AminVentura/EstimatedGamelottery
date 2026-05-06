# Firebase: reglas Firestore, Storage, App Check y despliegue

## 1. Firestore — publicar reglas (obligatorio tras cambios en `firestore.rules`)

```bash
firebase deploy --only firestore:rules
```

O en consola: **Firestore → Reglas** → pega el contenido de **`firestore.rules`** → Publicar.

**Política actual (resumen):** solo colecciones de sorteos listadas + `user_stats`. Sin `lotto_comments` (el chat fue retirado del sitio). Sin `cash4life_drawings`. Sorteos: sin `update`, solo `create`/`delete` del dueño. Fechas `YYYY-MM-DD`. `user_stats`: dueño del doc y máximo 48 campos.

---

## 2. Storage — publicar reglas (nuevo)

El archivo **`storage.rules`** deniega todo lectura/escritura (si no usas Storage, no afecta al sitio; si más adelante subes archivos, abre reglas con cuidado).

```bash
firebase deploy --only storage
```

Si el proyecto no tiene Storage activado, la CLI puede pedirte activarlo o puedes omitir este paso hasta que lo uses.

---

## 3. App Check (reCAPTCHA v3) — consola + sitio

1. **Firebase Console** → **App Check** → registra la app web con **reCAPTCHA v3** y copia la **clave del sitio** (site key).
2. En **`sitio/index.html`** (y copia en raíz si la usas), rellena el meta:
   ```html
   <meta name="firebase-appcheck-recaptcha-site-key" content="TU_CLAVE_PUBLICA_AQUI">
   ```
3. Despliega **Hosting** para que el meta llegue a producción.
4. En App Check, activa **aplicación forzada** (enforcement) para **Firestore** (y **Auth** si lo recomienda la consola) **solo después** de comprobar en un dispositivo real que el sitio carga bien y Firestore responde. Si activas enforcement sin clave en el meta, los clientes fallarán.

El cliente ya importa `firebase-app-check` y llama a `initializeAppCheck` solo si el meta tiene contenido.

---

## 4. Hosting (CSP + cabeceras)

```bash
firebase deploy --only hosting
```

---

## 5. Borrar legacy `cash4life_drawings` (opcional, Admin SDK)

```bash
npm run delete-cash4life-legacy
```

Comprueba que el `projectId` impreso sea **game-lottery-b0e90**.

---

## 6. Datos viejos de `lotto_comments`

Las reglas ya no definen esa colección (acceso denegado). Puedes borrar la colección desde la consola de Firestore o con un script Admin similar al de cash4life si quieres liberar espacio.

---

## 7. Google Cloud — API key y dominios

En **Google Cloud Console** → APIs y servicios → **Credenciales** → restricciones de la clave de API del navegador (HTTP referrers: `https://www.prediccionloteria.com/*`, etc.). Esto complementa App Check; no sustituye las reglas de Firestore.
