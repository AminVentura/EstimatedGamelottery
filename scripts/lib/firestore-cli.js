'use strict';
// Firestore para los scripts de operación (no para la web ni las functions).
//
// Credenciales, en este orden:
//   1. Emulador: FIRESTORE_EMULATOR_HOST (sin credenciales).
//   2. GCLOUD_ACCESS_TOKEN: un token de acceso de corta vida de la sesión de gcloud
//      (export GCLOUD_ACCESS_TOKEN=$(gcloud auth print-access-token)). Solo vive en
//      la variable de entorno del proceso; no se escribe en ningún archivo.
//   3. Credenciales de aplicación (gcloud auth application-default login).
// Nunca usa serviceAccountKey.json.

const path = require('node:path');

const functionsDir = path.join(__dirname, '..', '..', 'functions');
const requireFromFunctions = require('node:module').createRequire(path.join(functionsDir, 'package.json'));

function openFirestore(projectId) {
  if (!projectId) throw new Error('Falta el id del proyecto.');
  const { Firestore, FieldValue, Timestamp } = requireFromFunctions('@google-cloud/firestore');
  const token = process.env.GCLOUD_ACCESS_TOKEN || '';
  if (!process.env.FIRESTORE_EMULATOR_HOST && token) {
    const { OAuth2Client } = requireFromFunctions('google-auth-library');
    const authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: token });
    return { db: new Firestore({ projectId, authClient }), FieldValue, Timestamp, auth: 'gcloud-token' };
  }
  return {
    db: new Firestore({ projectId }),
    FieldValue,
    Timestamp,
    auth: process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'adc',
  };
}

module.exports = { openFirestore, functionsDir, requireFromFunctions };
