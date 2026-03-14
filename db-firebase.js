/**
 * Estructura de Datos Firebase Firestore
 * 
 * Este archivo documenta la estructura de colecciones y documentos
 * necesarios para la aplicación.
 * 
 * IMPORTANTE: Firestore no requiere crear las colecciones manualmente.
 * Se crean automáticamente cuando insertas el primer documento.
 * 
 * Para migrar desde SQL:
 * - Tablas → Colecciones
 * - Filas → Documentos
 * - Columnas → Campos en documentos
 */

const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Inicializar Firebase Admin SDK
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  // Opción 1: Usar archivo JSON (desarrollo local)
  serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
} else {
  // Opción 2: Usar variables de entorno (producción)
  serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

/**
 * ESTRUCTURA DE COLECCIONES
 * 
 * Las siguientes colecciones deben existir en Firestore:
 */

// ==========================================
// COLECCIÓN: users
// ==========================================
/**
 * Colección: users
 * Descripción: Usuarios del sistema
 * 
 * Estructura del documento:
 * {
 *   uid: string (ID del documento = UID de Firebase Auth),
 *   email: string,
 *   displayName: string (opcional),
 *   createdAt: timestamp,
 *   updatedAt: timestamp,
 *   role: string ('user' | 'admin' | 'lawyer'),
 *   active: boolean
 * }
 */
const usersCollection = db.collection('users');

// ==========================================
// COLECCIÓN: morosos
// ==========================================
/**
 * Colección: morosos
 * Descripción: Registro de inquilinos morosos
 * 
 * Estructura del documento:
 * {
 *   userId: string (referencia al usuario que lo creó),
 *   nombre: string,
 *   apellido: string,
 *   documento: string (DNI/ID),
 *   direccion: string,
 *   montoAdeudado: number,
 *   fechaVencimiento: timestamp,
 *   estado: string ('pendiente' | 'en_proceso' | 'resuelto'),
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 */
const morososCollection = db.collection('morosos');

// ==========================================
// COLECCIÓN: lawyers
// ==========================================
/**
 * Colección: lawyers
 * Descripción: Abogados registrados en el sistema
 * 
 * Estructura del documento:
 * {
 *   userId: string (referencia a users),
 *   nombre: string,
 *   apellido: string,
 *   matricula: string,
 *   especialidad: string,
 *   telefono: string,
 *   email: string,
 *   activo: boolean,
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 */
const lawyersCollection = db.collection('lawyers');

// ==========================================
// COLECCIÓN: ads
// ==========================================
/**
 * Colección: ads
 * Descripción: Anuncios publicitarios
 * 
 * Estructura del documento:
 * {
 *   titulo: string,
 *   descripcion: string,
 *   imagenUrl: string,
 *   linkUrl: string (opcional),
 *   activo: boolean,
 *   fechaInicio: timestamp,
 *   fechaFin: timestamp,
 *   posicion: string ('top' | 'sidebar' | 'bottom'),
 *   clicks: number,
 *   impresiones: number,
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 */
const adsCollection = db.collection('ads');

// ==========================================
// COLECCIÓN: settings
// ==========================================
/**
 * Colección: settings
 * Descripción: Configuración de la aplicación
 * 
 * IMPORTANTE: Crear un documento llamado "app" en esta colección
 * 
 * Estructura del documento "app":
 * {
 *   nombreApp: string,
 *   version: string,
 *   mantenimiento: boolean,
 *   mensajeMantenimiento: string (opcional),
 *   emailContacto: string,
 *   telefonoContacto: string,
 *   configuracionAdsense: {
 *     activo: boolean,
 *     clientId: string
 *   },
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 */
const settingsCollection = db.collection('settings');

// ==========================================
// COLECCIÓN: evictions
// ==========================================
/**
 * Colección: evictions
 * Descripción: Procesos de desalojo
 * 
 * Estructura del documento:
 * {
 *   morosoId: string (referencia a morosos),
 *   lawyerId: string (referencia a lawyers),
 *   userId: string (referencia a users - creador),
 *   numeroExpediente: string,
 *   fechaInicio: timestamp,
 *   fechaAudiencia: timestamp (opcional),
 *   estado: string ('iniciado' | 'en_tramite' | 'audiencia_programada' | 'completado' | 'cancelado'),
 *   observaciones: string (opcional),
 *   documentos: array<string> (URLs de documentos),
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 */
const evictionsCollection = db.collection('evictions');

// ==========================================
// FUNCIONES DE ACCESO
// ==========================================

module.exports = {
  db,
  admin, // Exportar admin para usar FieldValue, Timestamp, etc.
  // Colecciones
  usersCollection,
  morososCollection,
  lawyersCollection,
  adsCollection,
  settingsCollection,
  evictionsCollection,
  // Referencias directas
  getUsersCollection: () => db.collection('users'),
  getMorososCollection: () => db.collection('morosos'),
  getLawyersCollection: () => db.collection('lawyers'),
  getAdsCollection: () => db.collection('ads'),
  getSettingsCollection: () => db.collection('settings'),
  getEvictionsCollection: () => db.collection('evictions'),
};
