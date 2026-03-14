/**
 * Script para Eliminar el Documento "app" de settings
 * 
 * ⚠️ ADVERTENCIA: Este script elimina el documento "app" de la colección "settings"
 * 
 * Uso:
 *   node delete-app-doc.js
 */

const { db, admin, getSettingsCollection } = require('./db-firebase');

async function deleteAppDocument() {
  try {
    console.log('⚠️  ADVERTENCIA: Este script eliminará el documento "app" de la colección "settings"\n');
    
    // Verificar qué proyecto estamos usando
    const projectId = admin.app().options.projectId || process.env.FIREBASE_PROJECT_ID;
    console.log(`📦 Proyecto Firebase: ${projectId}\n`);

    // Verificar si el documento existe
    const settingsRef = getSettingsCollection();
    const appDocRef = settingsRef.doc('app');
    const appDoc = await appDocRef.get();

    if (!appDoc.exists) {
      console.log('ℹ️  El documento "app" no existe en la colección "settings"');
      console.log('   No hay nada que eliminar.\n');
      return;
    }

    console.log('📄 Documento "app" encontrado:');
    console.log(JSON.stringify(appDoc.data(), null, 2));
    console.log('\n');

    // Confirmar eliminación
    console.log('🗑️  Eliminando documento "app"...');
    await appDocRef.delete();
    
    console.log('✅ Documento "app" eliminado exitosamente');
    console.log(`   Proyecto: ${projectId}`);
    console.log('   Colección: settings');
    console.log('   Documento ID: app\n');

  } catch (error) {
    console.error('❌ Error al eliminar el documento:', error);
    process.exit(1);
  }
}

// Ejecutar eliminación
deleteAppDocument()
  .then(() => {
    console.log('✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
