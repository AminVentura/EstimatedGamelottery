/**
 * Servidor Principal de la Aplicación
 *
 * Este es el punto de entrada de tu aplicación Node.js
 */

const crypto  = require('crypto');
const express = require('express');
const cors    = require('cors');           // OPCIÓN C — npm install cors si no está instalado
const rateLimit = require('express-rate-limit');
const helmet  = require('helmet');
const { db, getUsersCollection } = require('./db-firebase');

const app  = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// ─── OPCIÓN C: CORS ────────────────────────────────────────────────────────────
// Debe montarse ANTES de cualquier otro middleware para que las pre-flight
// OPTIONS también reciban los headers correctos.
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://www.prediccionloteria.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-token'],
  credentials: true
}));
// ──────────────────────────────────────────────────────────────────────────────

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas peticiones. Intenta más tarde.' }
});

const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Límite de peticiones administrativas alcanzado.' }
});

// Middleware
app.use('/api', apiLimiter);
app.use(express.json({ limit: '100kb' }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' }
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// ─── Helper: autenticación admin ──────────────────────────────────────────────
function verifyAdminToken(req, res) {
  const adminToken    = String(process.env.ADMIN_API_TOKEN || '').trim();
  const providedToken = String(req.headers['x-admin-token'] || '').trim();

  if (!adminToken) {
    res.status(503).json({ success: false, error: 'Endpoint administrativo deshabilitado.' });
    return false;
  }
  // Use constant-time comparison to prevent timing attacks.
  // Both buffers must be the same byte length; pad/truncate to avoid length-leaking.
  if (!providedToken) {
    res.status(403).json({ success: false, error: 'No autorizado.' });
    return false;
  }
  const adminBuf    = Buffer.from(adminToken,    'utf8');
  const providedBuf = Buffer.from(providedToken, 'utf8');
  // If lengths differ, timingSafeEqual would throw; compare against a fixed-length
  // HMAC digest so the length itself is not leaked and the call always takes constant time.
  const hmacKey = Buffer.from(adminToken, 'utf8');
  const digestAdmin    = crypto.createHmac('sha256', hmacKey).update(adminBuf).digest();
  const digestProvided = crypto.createHmac('sha256', hmacKey).update(providedBuf).digest();
  if (!crypto.timingSafeEqual(digestAdmin, digestProvided)) {
    res.status(403).json({ success: false, error: 'No autorizado.' });
    return false;
  }
  return true;
}
// ──────────────────────────────────────────────────────────────────────────────

// Rutas básicas
app.get('/', (req, res) => {
  res.json({
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Ejemplo de ruta usando Firestore
app.get('/api/users', adminLimiter, async (req, res) => {
  try {
    if (!verifyAdminToken(req, res)) return;

    const usersRef = getUsersCollection();
    const snapshot = await usersRef.get();

    const users = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// ─── OPCIONES A + B: POST /api/drawings ───────────────────────────────────────
/**
 * POST /api/drawings
 * Crea un nuevo sorteo en Firestore.
 *
 * Headers:
 *   x-admin-token  — token administrativo
 *
 * Body JSON:
 *   game         {string}   'powerball' | 'megamillions'
 *   drawDate     {string}   Fecha ISO, ej: "2026-05-06"
 *   numbers      {number[]} Array de exactamente 5 enteros
 *   specialNumber {number}  Entero requerido
 *   multiplier   {number}   Opcional (default null)
 */
app.post('/api/drawings', adminLimiter, async (req, res) => {
  try {
    // ── Autenticación ──────────────────────────────────────────────────────────
    if (!verifyAdminToken(req, res)) return;

    // ── Validación de campos ───────────────────────────────────────────────────
    const { game, drawDate, numbers, specialNumber, multiplier = null } = req.body;

    // game
    if (!game || typeof game !== 'string') {
      return res.status(400).json({ success: false, error: 'El campo "game" es requerido y debe ser un string.' });
    }
    if (!['powerball', 'megamillions'].includes(game)) {
      return res.status(400).json({ success: false, error: 'El campo "game" debe ser "powerball" o "megamillions".' });
    }

    // drawDate
    if (!drawDate || typeof drawDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) {
      return res.status(400).json({ success: false, error: 'El campo "drawDate" es requerido y debe tener formato ISO YYYY-MM-DD.' });
    }

    // numbers
    if (!Array.isArray(numbers) || numbers.length !== 5) {
      return res.status(400).json({ success: false, error: 'El campo "numbers" debe ser un array de exactamente 5 elementos.' });
    }
    const allIntegers = numbers.every(n => Number.isInteger(n));
    if (!allIntegers) {
      return res.status(400).json({ success: false, error: 'Todos los elementos de "numbers" deben ser números enteros.' });
    }

    // specialNumber
    if (specialNumber === undefined || specialNumber === null || !Number.isInteger(specialNumber)) {
      return res.status(400).json({ success: false, error: 'El campo "specialNumber" es requerido y debe ser un número entero.' });
    }

    // multiplier (opcional)
    if (multiplier !== null && !Number.isFinite(multiplier)) {
      return res.status(400).json({ success: false, error: 'El campo "multiplier" debe ser un número o null.' });
    }

    // ── OPCIÓN B: Sanity check de duplicados ──────────────────────────────────
    const drawingsRef = db.collection('drawings');

    const duplicateSnapshot = await drawingsRef
      .where('game', '==', game)
      .where('drawDate', '==', drawDate)
      .limit(1)
      .get();

    if (!duplicateSnapshot.empty) {
      return res.status(409).json({
        success: false,
        error: 'Sorteo duplicado para esta fecha y juego.'
      });
    }

    // ── OPCIÓN A: Guardar en Firestore ─────────────────────────────────────────
    const docRef = await drawingsRef.add({
      game,
      drawDate,
      numbers,
      specialNumber,
      multiplier,
      createdAt: new Date().toISOString()
    });

    return res.status(201).json({
      success: true,
      message: 'Sorteo guardado correctamente.',
      id: docRef.id
    });

  } catch (error) {
    console.error('Error guardando sorteo:', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});
// ──────────────────────────────────────────────────────────────────────────────

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
