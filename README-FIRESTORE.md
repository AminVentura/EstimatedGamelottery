# 🔥 Configuración de Firestore

## Archivos Creados

1. **`db-firebase.js`** - Configuración y estructura de datos de Firestore
2. **`init-firestore.js`** - Script para inicializar el documento "app" en settings
3. **`MIGRACION-FIRESTORE.md`** - Guía completa de migración y estructura
4. **`.env`** - Variables de entorno (ya configurado)
5. **`serviceAccountKey.json`** - Credenciales de Firebase (ya configurado)

---

## 🚀 Inicio Rápido

### 1. Instalar Dependencias

```bash
npm install firebase-admin dotenv
```

### 2. Inicializar Firestore

Ejecuta el script de inicialización para crear el documento "app" en settings:

```bash
node init-firestore.js
```

Este script:
- ✅ Verifica si el documento "app" existe en `settings`
- ✅ Lo crea si no existe con valores por defecto
- ✅ Verifica que todas las colecciones estén disponibles

### 3. Usar en tu Código

```javascript
const { db, getUsersCollection, getSettingsCollection } = require('./db-firebase');

// Ejemplo: Obtener configuración de la app
async function getAppSettings() {
  const settingsRef = getSettingsCollection();
  const appDoc = await settingsRef.doc('app').get();
  
  if (appDoc.exists) {
    return appDoc.data();
  }
  return null;
}

// Ejemplo: Crear un usuario
async function createUser(userData) {
  const usersRef = getUsersCollection();
  return await usersRef.add({
    ...userData,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

---

## 📦 Estructura de Colecciones

Tu aplicación usa las siguientes colecciones:

| Colección | Descripción | Documento Especial |
|-----------|-------------|-------------------|
| `users` | Usuarios del sistema | - |
| `morosos` | Inquilinos morosos | - |
| `lawyers` | Abogados registrados | - |
| `ads` | Anuncios publicitarios | - |
| `settings` | Configuración de la app | **"app"** (requerido) |
| `evictions` | Procesos de desalojo | - |

---

## ⚙️ Variables de Entorno

El archivo `.env` ya está configurado con:

```env
PORT=3000
FIREBASE_SERVICE_ACCOUNT_PATH="./serviceAccountKey.json"
FIREBASE_PROJECT_ID="verificarenta"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@verificarenta.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="..."
```

---

## 🔒 Seguridad

- ✅ `serviceAccountKey.json` está en `.gitignore`
- ✅ `.env` está en `.gitignore`
- ⚠️ **NUNCA** subas estos archivos a GitHub
- ⚠️ En producción (Heroku/Vercel), usa las variables de entorno individuales

---

## 📚 Documentación Completa

Para más detalles, consulta:
- **`MIGRACION-FIRESTORE.md`** - Guía completa de estructura y migración
- **`db-firebase.js`** - Comentarios detallados sobre cada colección

---

## 🆘 Solución de Problemas

### Error: "Cannot find module 'firebase-admin'"
```bash
npm install firebase-admin
```

### Error: "Permission denied"
- Verifica que `serviceAccountKey.json` tenga las credenciales correctas
- Revisa las reglas de seguridad en Firebase Console

### Error: "Collection not found"
- Las colecciones se crean automáticamente al insertar el primer documento
- Ejecuta `node init-firestore.js` para crear el documento "app"

---

**Última actualización:** Febrero 7, 2026
