/**
 * Servidor Principal de la Aplicación
 * 
 * Este es el punto de entrada de tu aplicación Node.js
 */

const express = require('express');
const { db, getUsersCollection } = require('./db-firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas básicas
app.get('/', (req, res) => {
  res.json({ 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Ejemplo de ruta usando Firestore
app.get('/api/users', async (req, res) => {
  try {
    const usersRef = getUsersCollection();
    const snapshot = await usersRef.get();
    
    const users = [];
    snapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Firebase conectado al proyecto: verificarenta`);
});
