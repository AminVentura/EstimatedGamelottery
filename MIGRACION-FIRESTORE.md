# Guía de Migración: Estructura de Datos Firestore

## 📋 Resumen

Esta guía te ayudará a crear la estructura de datos en Firestore para tu aplicación. A diferencia de SQL, **Firestore no requiere crear las colecciones manualmente** - se crean automáticamente cuando insertas el primer documento.

---

## 🔑 Conceptos Clave: SQL → Firestore

| SQL | Firestore |
|-----|-----------|
| **Base de Datos** | **Proyecto Firebase** |
| **Tabla** | **Colección (Collection)** |
| **Fila** | **Documento (Document)** |
| **Columna** | **Campo (Field)** |
| **Primary Key** | **Document ID** |
| **Foreign Key** | **Referencia (string con ID)** |

---

## 📦 Colecciones Requeridas

Tu aplicación necesita las siguientes **5 colecciones**:

1. ✅ **users** - Usuarios del sistema
2. ✅ **morosos** - Registro de inquilinos morosos
3. ✅ **lawyers** - Abogados registrados
4. ✅ **ads** - Anuncios publicitarios
5. ✅ **settings** - Configuración de la aplicación (con documento "app")
6. ✅ **evictions** - Procesos de desalojo

---

## 🚀 Método 1: Creación Automática (Recomendado)

**Las colecciones se crean automáticamente** cuando ejecutas tu código que inserta documentos. Solo necesitas:

1. Asegurarte de que `db-firebase.js` esté correctamente configurado
2. Ejecutar tu aplicación y hacer las primeras inserciones
3. Las colecciones aparecerán en Firebase Console

---

## 🛠️ Método 2: Creación Manual desde Firebase Console

Si prefieres crear las colecciones manualmente:

### Paso 1: Acceder a Firebase Console

1. Ve a https://console.firebase.google.com
2. Selecciona tu proyecto: **verificarenta**
3. En el menú izquierdo: **Build** → **Firestore Database**

### Paso 2: Crear Colecciones

Para cada colección:

1. Haz clic en **"Start collection"** o **"Agregar colección"**
2. Ingresa el nombre de la colección (ej: `users`)
3. Haz clic en **"Next"**
4. **NO necesitas agregar campos** - puedes crear un documento vacío o cancelar
5. La colección se creará automáticamente

**Repite para:**
- ✅ `users`
- ✅ `morosos`
- ✅ `lawyers`
- ✅ `ads`
- ✅ `settings`
- ✅ `evictions`

---

## ⚙️ Configuración Especial: settings/app

La colección `settings` necesita un documento específico llamado `app`:

### Crear el documento "app" en settings:

1. En Firebase Console, ve a la colección **settings**
2. Haz clic en **"Add document"** o **"Agregar documento"**
3. En **Document ID**, escribe: `app`
4. Haz clic en **"Save"**

### Estructura inicial del documento "app":

```json
{
  "nombreApp": "Tu Nombre de App",
  "version": "1.0.0",
  "mantenimiento": false,
  "emailContacto": "contacto@tudominio.com",
  "telefonoContacto": "+1234567890",
  "configuracionAdsense": {
    "activo": false,
    "clientId": ""
  },
  "createdAt": "2026-02-07T00:00:00Z",
  "updatedAt": "2026-02-07T00:00:00Z"
}
```

**Para agregar estos campos:**
1. Abre el documento `app` en Firebase Console
2. Haz clic en **"Add field"** o **"Agregar campo"**
3. Agrega cada campo con su tipo correspondiente:
   - `nombreApp` → **string**
   - `version` → **string**
   - `mantenimiento` → **boolean**
   - `emailContacto` → **string**
   - `telefonoContacto` → **string**
   - `configuracionAdsense` → **map** (objeto)
     - Dentro del map: `activo` → **boolean**, `clientId` → **string**
   - `createdAt` → **timestamp**
   - `updatedAt` → **timestamp**

---

## 📝 Estructura Detallada de Cada Colección

### 1. Colección: `users`

**Document ID:** Usualmente el UID de Firebase Auth

```json
{
  "uid": "string",
  "email": "string",
  "displayName": "string (opcional)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "role": "string ('user' | 'admin' | 'lawyer')",
  "active": "boolean"
}
```

---

### 2. Colección: `morosos`

**Document ID:** Auto-generado por Firestore

```json
{
  "userId": "string (referencia a users)",
  "nombre": "string",
  "apellido": "string",
  "documento": "string (DNI/ID)",
  "direccion": "string",
  "montoAdeudado": "number",
  "fechaVencimiento": "timestamp",
  "estado": "string ('pendiente' | 'en_proceso' | 'resuelto')",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

### 3. Colección: `lawyers`

**Document ID:** Auto-generado por Firestore

```json
{
  "userId": "string (referencia a users)",
  "nombre": "string",
  "apellido": "string",
  "matricula": "string",
  "especialidad": "string",
  "telefono": "string",
  "email": "string",
  "activo": "boolean",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

### 4. Colección: `ads`

**Document ID:** Auto-generado por Firestore

```json
{
  "titulo": "string",
  "descripcion": "string",
  "imagenUrl": "string",
  "linkUrl": "string (opcional)",
  "activo": "boolean",
  "fechaInicio": "timestamp",
  "fechaFin": "timestamp",
  "posicion": "string ('top' | 'sidebar' | 'bottom')",
  "clicks": "number",
  "impresiones": "number",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

### 5. Colección: `settings`

**Document ID:** `app` (debe ser exactamente "app")

```json
{
  "nombreApp": "string",
  "version": "string",
  "mantenimiento": "boolean",
  "mensajeMantenimiento": "string (opcional)",
  "emailContacto": "string",
  "telefonoContacto": "string",
  "configuracionAdsense": {
    "activo": "boolean",
    "clientId": "string"
  },
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

### 6. Colección: `evictions`

**Document ID:** Auto-generado por Firestore

```json
{
  "morosoId": "string (referencia a morosos)",
  "lawyerId": "string (referencia a lawyers)",
  "userId": "string (referencia a users - creador)",
  "numeroExpediente": "string",
  "fechaInicio": "timestamp",
  "fechaAudiencia": "timestamp (opcional)",
  "estado": "string ('iniciado' | 'en_tramite' | 'audiencia_programada' | 'completado' | 'cancelado')",
  "observaciones": "string (opcional)",
  "documentos": "array<string> (URLs de documentos)",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## ✅ Verificación

Después de crear las colecciones, verifica en Firebase Console:

1. Ve a **Firestore Database**
2. Deberías ver las 6 colecciones listadas:
   - ✅ users
   - ✅ morosos
   - ✅ lawyers
   - ✅ ads
   - ✅ settings (con documento "app")
   - ✅ evictions

---

## 🔒 Reglas de Seguridad

**IMPORTANTE:** Después de crear las colecciones, configura las reglas de seguridad en **Firestore Rules**.

Ejemplo básico (ajusta según tus necesidades):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permitir lectura/escritura solo a usuarios autenticados
    match /{collection}/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Reglas específicas por colección
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

---

## 📚 Recursos Adicionales

- [Documentación oficial de Firestore](https://firebase.google.com/docs/firestore)
- [Guía de migración SQL → Firestore](https://firebase.google.com/docs/firestore/manage-data/structure-data)
- [Mejores prácticas de Firestore](https://firebase.google.com/docs/firestore/best-practices)

---

## 🆘 Solución de Problemas

### Error: "Collection not found"
- Las colecciones se crean automáticamente al insertar el primer documento
- Verifica que estés usando los nombres correctos en tu código

### Error: "Permission denied"
- Revisa las reglas de seguridad en Firestore Rules
- Asegúrate de que el usuario esté autenticado

### El documento "app" no existe en settings
- Crea manualmente el documento con ID "app" en la colección settings
- O ejecuta un script de inicialización que lo cree automáticamente

---

**Última actualización:** Febrero 7, 2026
