/**
 * Script de Inicialización de Firestore
 * 
 * Este script crea el documento "app" en la colección "settings"
 * si no existe aún.
 * 
 * Uso:
 *   node init-firestore.js
 */

const { db, admin, getSettingsCollection } = require('./db-firebase');

async function initializeFirestore() {
  try {
    console.log('🚀 Inicializando Firestore...\n');

    // Verificar si el documento "app" existe en settings
    const settingsRef = getSettingsCollection();
    const appDocRef = settingsRef.doc('app');
    const appDoc = await appDocRef.get();

    if (appDoc.exists) {
      console.log('✅ El documento "app" ya existe en la colección "settings"');
      console.log('📄 Datos actuales:', JSON.stringify(appDoc.data(), null, 2));
    } else {
      console.log('📝 Creando documento "app" en la colección "settings"...');

      const initialAppData = {
        nombreApp: 'Mi Aplicación',
        version: '1.0.0',
        mantenimiento: false,
        mensajeMantenimiento: '',
        emailContacto: 'contacto@tudominio.com',
        telefonoContacto: '+1234567890',
        configuracionAdsense: {
          activo: false,
          clientId: ''
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await appDocRef.set(initialAppData);
      console.log('✅ Documento "app" creado exitosamente');
      console.log('📄 Datos iniciales:', JSON.stringify(initialAppData, null, 2));
    }

    // Verificar otras colecciones (solo informativo)
    console.log('\n📦 Verificando colecciones...');
    const collections = ['users', 'morosos', 'lawyers', 'ads', 'settings', 'evictions'];
    
    for (const collectionName of collections) {
      const collectionRef = db.collection(collectionName);
      const snapshot = await collectionRef.limit(1).get();
      
      if (snapshot.empty) {
        console.log(`   ⚠️  Colección "${collectionName}" existe pero está vacía`);
      } else {
        console.log(`   ✅ Colección "${collectionName}" existe y tiene documentos`);
      }
    }

    console.log('\n✨ Inicialización completada');
    console.log('\n💡 Nota: Las colecciones se crean automáticamente cuando insertas el primer documento.');
    console.log('   Si alguna colección no existe aún, se creará cuando ejecutes tu aplicación.\n');

  } catch (error) {
    console.error('❌ Error durante la inicialización:', error);
    process.exit(1);
  }
}

// Ejecutar inicialización
initializeFirestore()
  .then(() => {
    console.log('✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
