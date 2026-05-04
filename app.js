import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-check.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, getFirestore, collection, addDoc, onSnapshot, query, where, getDocs, orderBy, deleteDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtNNiANCMdMILI5qiL9fF5aWhjfknUMWQ",
  authDomain: "game-lottery-b0e90.firebaseapp.com",
  projectId: "game-lottery-b0e90",
  storageBucket: "game-lottery-b0e90.firebasestorage.app",
  messagingSenderId: "192610858921",
  appId: "1:192610858921:web:7b36e8"
};

const appId = "EstimatedGamelottery-app";
let _resolveFirebaseSportsBridge;
window.firebaseSportsBridgeReady = new Promise((resolve) => {
  _resolveFirebaseSportsBridge = resolve;
});
window.firebaseServices = window.firebaseServices || {};
console.log('✅ Bridge Firebase Services Vinculado');

let auth, userId, db;
let totalPredictions = 0;

// Configuración central de todas las loterías (Number Selection por juego)
const LOTTERY_CONFIG = {
  powerball:    { mainCount: 5, mainMin: 1, mainMax: 69,  hasSpecial: true,  specialMin: 1, specialMax: 26,  verMasId: 'pb' },
  millionaireforlife: { mainCount: 5, mainMin: 1, mainMax: 58,  hasSpecial: true,  specialMin: 1, specialMax: 5,   verMasId: 'm4l' },
  megamillions:{ mainCount: 5, mainMin: 1, mainMax: 70,  hasSpecial: true,  specialMin: 1, specialMax: 25,  verMasId: 'mm' },
  pick10:      { mainCount: 10, mainMin: 1, mainMax: 80, hasSpecial: false, verMasId: 'pick10', drawResultCount: 20 },
  take5day:    { mainCount: 5, mainMin: 1, mainMax: 39,  hasSpecial: false, verMasId: 'take5day' },
  take5eve:    { mainCount: 5, mainMin: 1, mainMax: 39,  hasSpecial: false, verMasId: 'take5eve' },
  win4day:     { mainCount: 4, mainMin: 0, mainMax: 9,   hasSpecial: false, verMasId: 'win4day' },
  win4eve:     { mainCount: 4, mainMin: 0, mainMax: 9,   hasSpecial: false, verMasId: 'win4eve' }
};

const LOTTERY_IDS = Object.keys(LOTTERY_CONFIG);
const INSIGHT_SUPPORTED_GAMES = new Set(['powerball', 'megamillions']);

// Próximo sorteo: días de la semana (0=Dom, 1=Lun, ..., 6=Sab) y hora en ET (22:59 = 10:59 PM)
// Powerball: Lun, Mié, Sáb 10:59 PM ET. Mega Millions: Mar, Vie 11:00 PM ET. Millionaire For Life: diario 11:15 PM ET (10:15 PM Central).
const DRAW_SCHEDULE = {
  powerball:    { days: [1, 3, 6], hourET: 22, minuteET: 59 },
  megamillions: { days: [2, 5], hourET: 23, minuteET: 0 },
  millionaireforlife: { days: [0, 1, 2, 3, 4, 5, 6], hourET: 23, minuteET: 15 }
};

function getETOffsetMs() {
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  const std = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  const isDST = now.getTimezoneOffset() < std;
  return (isDST ? -4 : -5) * 60 * 60 * 1000;
}

function getNextDrawTime(lottery) {
  const schedule = DRAW_SCHEDULE[lottery];
  if (!schedule) return null;
  const etOffset = getETOffsetMs();
  const nowEt = new Date(Date.now() + etOffset);
  const currentDay = nowEt.getUTCDay();
  const currentHour = nowEt.getUTCHours();
  const currentMin = nowEt.getUTCMinutes();
  const targetHour = schedule.hourET;
  const targetMin = schedule.minuteET;
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidateDay = (currentDay + daysAhead) % 7;
    if (!schedule.days.includes(candidateDay)) continue;
    if (daysAhead === 0 && (currentHour > targetHour || (currentHour === targetHour && currentMin >= targetMin))) continue;
    const drawEt = new Date(nowEt);
    drawEt.setUTCDate(drawEt.getUTCDate() + daysAhead);
    drawEt.setUTCHours(targetHour, targetMin, 0, 0);
    const utcDraw = new Date(drawEt.getTime() - etOffset);
    if (utcDraw > new Date()) return { date: utcDraw, label: `${dayNames[candidateDay]} ${targetHour}:${String(targetMin).padStart(2,'0')} ET` };
  }
  const fallback = new Date(nowEt);
  fallback.setUTCDate(fallback.getUTCDate() + 7);
  fallback.setUTCHours(targetHour, targetMin, 0, 0);
  return { date: new Date(fallback.getTime() - etOffset), label: `${targetHour}:${String(targetMin).padStart(2,'0')} ET` };
}

function formatCountdown(ms) {
  if (ms <= 0) return '0d 00:00:00';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

let countdownInterval = null;
function startNextDrawingCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  function updateAll() {
    ['powerball', 'millionaireforlife', 'megamillions'].forEach(lottery => {
      const strip = document.querySelector(`.next-drawing-strip[data-lottery="${lottery}"]`);
      if (!strip) return;
      const next = getNextDrawTime(lottery);
      const dateEl = strip.querySelector('.next-drawing-date');
      const countEl = strip.querySelector('.countdown');
      if (dateEl && next) {
        dateEl.textContent = next.date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' (' + next.label + ')';
      }
      if (countEl && next) {
        const ms = next.date.getTime() - Date.now();
        countEl.textContent = formatCountdown(ms);
      }
    });
  }
  updateAll();
  countdownInterval = setInterval(updateAll, 1000);
}

// Historial inicial Millionaire For Life (5 números 1-58 + Millionaire Ball 1-5)
const M4L_SEED_HISTORY = [
  { id: 'seed-m4l-2026-03-05', data: { date: '2026-03-05', mainNumbers: [17, 20, 23, 30, 33], special: 5 } },
  { id: 'seed-m4l-2026-03-04', data: { date: '2026-03-04', mainNumbers: [12, 13, 36, 39, 58], special: 3 } },
  { id: 'seed-m4l-2026-03-03', data: { date: '2026-03-03', mainNumbers: [9, 10, 13, 25, 54], special: 5 } },
  { id: 'seed-m4l-2026-03-02', data: { date: '2026-03-02', mainNumbers: [28, 41, 42, 50, 55], special: 2 } },
  { id: 'seed-m4l-2026-03-01', data: { date: '2026-03-01', mainNumbers: [10, 11, 12, 35, 56], special: 4 } },
  { id: 'seed-m4l-2026-02-28', data: { date: '2026-02-28', mainNumbers: [13, 20, 28, 44, 48], special: 4 } },
  { id: 'seed-m4l-2026-02-27', data: { date: '2026-02-27', mainNumbers: [3, 4, 13, 28, 42], special: 2 } },
  { id: 'seed-m4l-2026-02-26', data: { date: '2026-02-26', mainNumbers: [31, 42, 25, 5, 7], special: 4 } },
  { id: 'seed-m4l-2026-02-25', data: { date: '2026-02-25', mainNumbers: [13, 33, 53, 9, 55], special: 3 } },
  { id: 'seed-m4l-2026-02-24', data: { date: '2026-02-24', mainNumbers: [12, 15, 33, 46, 53], special: 5 } }
];

// Historial inicial Mega Millions (resultados oficiales)
const MEGA_MILLIONS_SEED_HISTORY = [
  { id: 'seed-mm-2026-02-06', data: { date: '2026-02-06', mainNumbers: [13,21,25,52,62], special: 19 } },
  { id: 'seed-mm-2026-02-03', data: { date: '2026-02-03', mainNumbers: [5,11,22,25,69], special: 21 } },
  { id: 'seed-mm-2026-01-30', data: { date: '2026-01-30', mainNumbers: [11,34,36,43,63], special: 13 } },
  { id: 'seed-mm-2026-01-27', data: { date: '2026-01-27', mainNumbers: [4,20,38,56,66], special: 5 } },
  { id: 'seed-mm-2026-01-23', data: { date: '2026-01-23', mainNumbers: [30,42,49,53,66], special: 4 } },
  { id: 'seed-mm-2026-01-20', data: { date: '2026-01-20', mainNumbers: [8,47,50,56,70], special: 12 } },
  { id: 'seed-mm-2026-01-16', data: { date: '2026-01-16', mainNumbers: [22,23,34,62,67], special: 1 } },
  { id: 'seed-mm-2026-01-13', data: { date: '2026-01-13', mainNumbers: [16,40,56,64,66], special: 4 } },
  { id: 'seed-mm-2026-01-09', data: { date: '2026-01-09', mainNumbers: [12,30,36,42,47], special: 16 } },
  { id: 'seed-mm-2026-01-06', data: { date: '2026-01-06', mainNumbers: [9,39,47,58,68], special: 24 } },
  { id: 'seed-mm-2026-01-02', data: { date: '2026-01-02', mainNumbers: [6,13,34,43,52], special: 4 } }
];

// Historial inicial Pick 10 (resultados oficiales; incluye Feb 17 - Mar 4 y Jan 1 - Feb 16)
const PICK10_SEED_HISTORY = [
  { id: 'seed-2026-03-04', data: { date: '2026-03-04', mainNumbers: [36,11,16,20,22,25,27,38,39,45,48,49,58,60,62,64,70,75,7,6] } },
  { id: 'seed-2026-03-03', data: { date: '2026-03-03', mainNumbers: [23,27,28,30,31,35,36,39,43,50,51,57,58,59,63,66,67,72,73,77] } },
  { id: 'seed-2026-03-02', data: { date: '2026-03-02', mainNumbers: [5,7,8,9,15,17,18,21,22,24,26,45,52,61,64,65,66,69,78,79] } },
  { id: 'seed-2026-03-01', data: { date: '2026-03-01', mainNumbers: [6,13,14,16,17,26,34,37,39,45,46,48,56,58,61,68,70,71,72,76] } },
  { id: 'seed-2026-02-28', data: { date: '2026-02-28', mainNumbers: [12,10,19,26,29,33,34,35,41,46,49,54,59,60,63,66,68,70,7,77] } },
  { id: 'seed-2026-02-27', data: { date: '2026-02-27', mainNumbers: [3,11,12,15,17,19,20,24,40,43,52,54,56,58,60,61,65,67,75,79] } },
  { id: 'seed-2026-02-26', data: { date: '2026-02-26', mainNumbers: [11,13,26,42,43,52,55,56,57,59,60,62,65,66,67,68,72,75,76,77] } },
  { id: 'seed-2026-02-25', data: { date: '2026-02-25', mainNumbers: [4,11,13,15,22,28,35,36,37,41,48,49,50,58,62,64,66,70,71,79] } },
  { id: 'seed-2026-02-24', data: { date: '2026-02-24', mainNumbers: [2,7,8,11,12,15,19,20,26,31,32,33,35,44,55,57,62,74,77,8] } },
  { id: 'seed-2026-02-23', data: { date: '2026-02-23', mainNumbers: [1,6,7,8,12,13,21,31,35,36,39,43,44,47,50,53,56,58,65,75] } },
  { id: 'seed-2026-02-22', data: { date: '2026-02-22', mainNumbers: [1,8,14,18,19,20,26,28,32,37,48,49,57,66,67,68,70,72,73,77] } },
  { id: 'seed-2026-02-21', data: { date: '2026-02-21', mainNumbers: [5,12,19,29,32,35,45,53,54,55,57,58,61,64,67,68,72,73,76,80] } },
  { id: 'seed-2026-02-20', data: { date: '2026-02-20', mainNumbers: [2,7,9,10,20,25,28,36,39,48,51,53,57,58,60,64,67,68,71,74] } },
  { id: 'seed-2026-02-19', data: { date: '2026-02-19', mainNumbers: [10,13,21,30,35,37,41,42,47,50,54,55,60,67,71,73,74,75,76,77] } },
  { id: 'seed-2026-02-18', data: { date: '2026-02-18', mainNumbers: [1,2,3,4,12,15,22,25,31,34,36,37,39,43,48,51,52,67,68,78] } },
  { id: 'seed-2026-02-17', data: { date: '2026-02-17', mainNumbers: [2,4,9,10,17,18,20,26,31,35,41,44,53,55,58,60,67,71,74,76] } },
  { id: 'seed-2026-02-16', data: { date: '2026-02-16', mainNumbers: [3,4,7,8,9,16,19,21,25,33,34,36,41,49,53,55,58,63,69,80] } },
  { id: 'seed-2026-02-15', data: { date: '2026-02-15', mainNumbers: [3,5,16,18,19,22,27,29,33,34,35,41,42,46,48,49,57,59,64,65] } },
  { id: 'seed-2026-02-14', data: { date: '2026-02-14', mainNumbers: [10,13,17,22,25,27,35,37,44,45,52,53,55,56,57,58,65,68,69,71] } },
  { id: 'seed-2026-02-13', data: { date: '2026-02-13', mainNumbers: [1,4,5,6,9,25,27,32,33,41,46,47,49,51,60,61,69,71,79,80] } },
  { id: 'seed-2026-02-12', data: { date: '2026-02-12', mainNumbers: [2,7,8,11,18,22,38,45,48,50,55,56,61,66,67,74,77,78,79,80] } },
  { id: 'seed-2026-02-11', data: { date: '2026-02-11', mainNumbers: [2,3,17,18,22,23,24,29,32,34,38,39,41,44,49,52,54,58,64,74] } },
  { id: 'seed-2026-02-10', data: { date: '2026-02-10', mainNumbers: [5,6,7,10,15,29,34,37,39,42,44,50,56,66,69,70,73,77,78,79] } },
  { id: 'seed-2026-02-08', data: { date: '2026-02-08', mainNumbers: [8,9,12,14,15,16,17,19,22,25,30,39,42,45,50,51,60,67,71,77] } },
  { id: 'seed-2026-02-07', data: { date: '2026-02-07', mainNumbers: [1,5,12,15,22,23,26,28,30,33,34,41,55,61,62,66,67,74,76,77] } },
  { id: 'seed-2026-02-06', data: { date: '2026-02-06', mainNumbers: [3,7,8,12,13,19,25,27,28,36,37,39,42,44,45,51,55,62,76,80] } },
  { id: 'seed-2026-02-05', data: { date: '2026-02-05', mainNumbers: [5,19,21,22,30,33,39,46,54,56,64,67,68,74,75,76,77,78,79,80] } },
  { id: 'seed-2026-02-04', data: { date: '2026-02-04', mainNumbers: [5,7,8,10,12,19,20,32,36,48,61,63,65,66,67,69,70,73,76,77] } },
  { id: 'seed-2026-02-03', data: { date: '2026-02-03', mainNumbers: [6,14,18,21,26,27,29,31,34,36,46,53,55,59,60,63,68,69,73,77] } },
  { id: 'seed-2026-02-02', data: { date: '2026-02-02', mainNumbers: [7,9,12,16,17,19,21,23,33,34,35,40,41,45,48,50,58,70,75,80] } },
  { id: 'seed-2026-02-01', data: { date: '2026-02-01', mainNumbers: [8,10,14,25,28,31,32,44,45,49,51,52,55,57,61,65,71,74,79,80] } },
  { id: 'seed-2026-01-31', data: { date: '2026-01-31', mainNumbers: [3,11,13,16,27,28,29,34,37,41,42,43,48,51,53,58,63,74,76,78] } },
  { id: 'seed-2026-01-30', data: { date: '2026-01-30', mainNumbers: [7,11,17,19,22,23,25,26,27,29,34,36,47,50,53,66,68,71,72,76] } },
  { id: 'seed-2026-01-29', data: { date: '2026-01-29', mainNumbers: [9,13,17,18,23,26,27,30,37,41,52,58,65,67,69,71,72,76,79,80] } },
  { id: 'seed-2026-01-28', data: { date: '2026-01-28', mainNumbers: [2,9,12,14,15,20,21,23,28,36,42,45,56,62,63,65,66,67,76,78] } },
  { id: 'seed-2026-01-27', data: { date: '2026-01-27', mainNumbers: [2,3,19,22,27,29,30,35,44,45,47,54,58,62,63,66,67,68,76,80] } },
  { id: 'seed-2026-01-26', data: { date: '2026-01-26', mainNumbers: [1,7,12,13,26,28,31,33,42,45,46,58,60,63,65,66,67,68,72,80] } },
  { id: 'seed-2026-01-25', data: { date: '2026-01-25', mainNumbers: [4,12,13,23,33,36,42,43,46,50,54,60,64,66,68,71,72,73,76,80] } },
  { id: 'seed-2026-01-24', data: { date: '2026-01-24', mainNumbers: [5,9,11,18,22,24,25,26,38,40,41,42,46,47,49,63,66,68,70,74] } },
  { id: 'seed-2026-01-23', data: { date: '2026-01-23', mainNumbers: [10,12,13,19,23,26,27,30,33,37,46,48,52,62,64,65,68,70,74,75] } },
  { id: 'seed-2026-01-22', data: { date: '2026-01-22', mainNumbers: [2,6,16,19,24,28,33,37,40,41,45,47,48,60,66,69,72,73,74,75] } },
  { id: 'seed-2026-01-21', data: { date: '2026-01-21', mainNumbers: [11,21,22,30,36,37,38,43,45,49,50,55,64,67,68,69,71,73,74,80] } },
  { id: 'seed-2026-01-20', data: { date: '2026-01-20', mainNumbers: [2,3,5,7,13,14,17,27,28,37,39,40,44,48,54,55,60,66,71,80] } },
  { id: 'seed-2026-01-19', data: { date: '2026-01-19', mainNumbers: [5,11,12,17,23,28,33,34,44,48,55,59,61,63,64,66,68,72,78,80] } },
  { id: 'seed-2026-01-18', data: { date: '2026-01-18', mainNumbers: [4,12,13,18,20,21,22,23,27,30,35,39,44,45,50,54,58,61,62,74] } },
  { id: 'seed-2026-01-17', data: { date: '2026-01-17', mainNumbers: [9,13,17,20,21,23,27,35,38,40,42,44,53,56,60,64,68,74,75,79] } },
  { id: 'seed-2026-01-16', data: { date: '2026-01-16', mainNumbers: [2,3,5,8,24,27,29,37,40,42,45,48,53,54,61,68,70,72,78,79] } },
  { id: 'seed-2026-01-15', data: { date: '2026-01-15', mainNumbers: [3,6,13,14,26,27,32,35,43,52,54,55,60,62,65,66,67,69,78,79] } },
  { id: 'seed-2026-01-14', data: { date: '2026-01-14', mainNumbers: [5,7,10,12,18,19,20,25,31,32,37,38,39,40,45,47,52,57,74,77] } },
  { id: 'seed-2026-01-13', data: { date: '2026-01-13', mainNumbers: [9,14,15,21,23,27,29,34,38,42,46,49,51,56,60,63,65,69,70,75] } },
  { id: 'seed-2026-01-12', data: { date: '2026-01-12', mainNumbers: [1,5,9,11,14,16,18,19,20,21,23,39,43,51,53,56,58,64,65,80] } },
  { id: 'seed-2026-01-11', data: { date: '2026-01-11', mainNumbers: [10,14,17,29,35,38,47,50,51,55,56,59,60,61,62,70,71,72,75,76] } },
  { id: 'seed-2026-01-10', data: { date: '2026-01-10', mainNumbers: [3,11,21,25,38,40,46,47,48,49,54,60,62,63,68,70,72,75,76,78] } },
  { id: 'seed-2026-01-09', data: { date: '2026-01-09', mainNumbers: [3,4,6,10,13,16,22,25,30,34,40,46,50,55,59,63,64,65,73,74] } },
  { id: 'seed-2026-01-08', data: { date: '2026-01-08', mainNumbers: [6,7,16,20,21,22,24,27,28,40,43,44,51,52,62,63,67,73,78,80] } },
  { id: 'seed-2026-01-07', data: { date: '2026-01-07', mainNumbers: [9,10,11,12,15,21,29,37,39,44,46,53,57,60,62,65,66,72,75,76] } },
  { id: 'seed-2026-01-06', data: { date: '2026-01-06', mainNumbers: [8,15,25,30,32,36,38,42,45,48,52,53,54,55,56,58,59,66,68,72] } },
  { id: 'seed-2026-01-05', data: { date: '2026-01-05', mainNumbers: [1,4,6,10,18,22,25,30,39,40,43,49,50,53,63,68,70,71,72,77] } },
  { id: 'seed-2026-01-04', data: { date: '2026-01-04', mainNumbers: [1,4,11,12,13,17,18,22,26,27,31,35,46,49,51,63,65,66,67,79] } },
  { id: 'seed-2026-01-03', data: { date: '2026-01-03', mainNumbers: [7,9,20,22,26,29,30,33,38,41,46,47,50,53,56,57,59,66,68,71] } },
  { id: 'seed-2026-01-02', data: { date: '2026-01-02', mainNumbers: [7,11,17,24,25,28,34,35,42,45,47,48,52,56,58,59,62,67,70,74] } },
  { id: 'seed-2026-01-01', data: { date: '2026-01-01', mainNumbers: [7,8,10,16,18,20,21,22,28,36,38,47,48,53,54,56,57,63,64,77] } }
];

// Historial inicial Take 5 Midday (resultados oficiales)
const TAKE5DAY_SEED_HISTORY = [
  { id: 'seed-t5d-2026-03-06', data: { date: '2026-03-06', mainNumbers: [5,16,24,35,38] } },
  { id: 'seed-t5d-2026-03-05', data: { date: '2026-03-05', mainNumbers: [11,24,25,29,39] } },
  { id: 'seed-t5d-2026-03-04', data: { date: '2026-03-04', mainNumbers: [9,15,23,26,31] } },
  { id: 'seed-t5d-2026-03-03', data: { date: '2026-03-03', mainNumbers: [8,25,30,31,36] } },
  { id: 'seed-t5d-2026-03-02', data: { date: '2026-03-02', mainNumbers: [7,19,29,32,38] } },
  { id: 'seed-t5d-2026-03-01', data: { date: '2026-03-01', mainNumbers: [12,25,26,29,35] } },
  { id: 'seed-t5d-2026-02-28', data: { date: '2026-02-28', mainNumbers: [18,21,22,24,36] } },
  { id: 'seed-t5d-2026-02-27', data: { date: '2026-02-27', mainNumbers: [2,10,21,23,38] } },
  { id: 'seed-t5d-2026-02-26', data: { date: '2026-02-26', mainNumbers: [7,13,16,24,37] } },
  { id: 'seed-t5d-2026-02-25', data: { date: '2026-02-25', mainNumbers: [19,25,27,30,36] } },
  { id: 'seed-t5d-2026-02-24', data: { date: '2026-02-24', mainNumbers: [14,25,27,28,29] } },
  { id: 'seed-t5d-2026-02-23', data: { date: '2026-02-23', mainNumbers: [5,8,17,29,37] } },
  { id: 'seed-t5d-2026-02-22', data: { date: '2026-02-22', mainNumbers: [15,29,30,33,38] } },
  { id: 'seed-t5d-2026-02-21', data: { date: '2026-02-21', mainNumbers: [9,13,18,22,23] } },
  { id: 'seed-t5d-2026-02-20', data: { date: '2026-02-20', mainNumbers: [10,13,18,28,33] } },
  { id: 'seed-t5d-2026-02-19', data: { date: '2026-02-19', mainNumbers: [7,8,23,28,34] } },
  { id: 'seed-t5d-2026-02-18', data: { date: '2026-02-18', mainNumbers: [7,11,19,20,35] } },
  { id: 'seed-t5d-2026-02-17', data: { date: '2026-02-17', mainNumbers: [6,21,26,33,36] } },
  { id: 'seed-t5d-2026-02-16', data: { date: '2026-02-16', mainNumbers: [2,7,22,23,29] } },
  { id: 'seed-t5d-2026-02-15', data: { date: '2026-02-15', mainNumbers: [4,8,17,32,38] } },
  { id: 'seed-t5d-2026-02-14', data: { date: '2026-02-14', mainNumbers: [5,6,9,18,20] } },
  { id: 'seed-t5d-2026-02-13', data: { date: '2026-02-13', mainNumbers: [3,16,25,29,36] } },
  { id: 'seed-t5d-2026-02-12', data: { date: '2026-02-12', mainNumbers: [2,15,28,32,33] } },
  { id: 'seed-t5d-2026-02-11', data: { date: '2026-02-11', mainNumbers: [6,22,23,26,27] } },
  { id: 'seed-t5d-2026-02-10', data: { date: '2026-02-10', mainNumbers: [7,16,29,33,38] } },
  { id: 'seed-t5d-2026-02-09', data: { date: '2026-02-09', mainNumbers: [14,18,19,22,37] } },
  { id: 'seed-t5d-2026-02-08', data: { date: '2026-02-08', mainNumbers: [6,10,12,21,24] } },
  { id: 'seed-t5d-2026-02-07', data: { date: '2026-02-07', mainNumbers: [4,14,19,32,34] } },
  { id: 'seed-t5d-2026-02-06', data: { date: '2026-02-06', mainNumbers: [3,7,15,26,34] } },
  { id: 'seed-t5d-2026-02-05', data: { date: '2026-02-05', mainNumbers: [1,17,28,32,35] } },
  { id: 'seed-t5d-2026-02-04', data: { date: '2026-02-04', mainNumbers: [7,13,22,26,36] } },
  { id: 'seed-t5d-2026-02-03', data: { date: '2026-02-03', mainNumbers: [10,11,22,25,33] } },
  { id: 'seed-t5d-2026-02-02', data: { date: '2026-02-02', mainNumbers: [3,8,9,28,36] } },
  { id: 'seed-t5d-2026-02-01', data: { date: '2026-02-01', mainNumbers: [1,15,26,30,36] } },
  { id: 'seed-t5d-2026-01-31', data: { date: '2026-01-31', mainNumbers: [14,17,25,29,32] } },
  { id: 'seed-t5d-2026-01-30', data: { date: '2026-01-30', mainNumbers: [2,3,18,31,37] } },
  { id: 'seed-t5d-2026-01-29', data: { date: '2026-01-29', mainNumbers: [5,16,22,33,34] } },
  { id: 'seed-t5d-2026-01-28', data: { date: '2026-01-28', mainNumbers: [1,8,22,25,39] } },
  { id: 'seed-t5d-2026-01-27', data: { date: '2026-01-27', mainNumbers: [1,16,25,33,37] } },
  { id: 'seed-t5d-2026-01-26', data: { date: '2026-01-26', mainNumbers: [7,8,26,27,38] } },
  { id: 'seed-t5d-2026-01-25', data: { date: '2026-01-25', mainNumbers: [3,12,23,30,35] } },
  { id: 'seed-t5d-2026-01-24', data: { date: '2026-01-24', mainNumbers: [2,23,25,27,33] } },
  { id: 'seed-t5d-2026-01-23', data: { date: '2026-01-23', mainNumbers: [9,10,32,33,39] } },
  { id: 'seed-t5d-2026-01-22', data: { date: '2026-01-22', mainNumbers: [5,6,27,28,29] } },
  { id: 'seed-t5d-2026-01-21', data: { date: '2026-01-21', mainNumbers: [2,6,26,31,34] } },
  { id: 'seed-t5d-2026-01-20', data: { date: '2026-01-20', mainNumbers: [11,14,20,23,27] } },
  { id: 'seed-t5d-2026-01-19', data: { date: '2026-01-19', mainNumbers: [1,4,24,25,28] } },
  { id: 'seed-t5d-2026-01-18', data: { date: '2026-01-18', mainNumbers: [15,17,20,28,30] } },
  { id: 'seed-t5d-2026-01-17', data: { date: '2026-01-17', mainNumbers: [10,15,22,24,38] } },
  { id: 'seed-t5d-2026-01-16', data: { date: '2026-01-16', mainNumbers: [1,11,12,26,37] } },
  { id: 'seed-t5d-2026-01-15', data: { date: '2026-01-15', mainNumbers: [12,18,28,34,39] } },
  { id: 'seed-t5d-2026-01-14', data: { date: '2026-01-14', mainNumbers: [9,18,19,20,35] } },
  { id: 'seed-t5d-2026-01-13', data: { date: '2026-01-13', mainNumbers: [5,7,11,19,37] } },
  { id: 'seed-t5d-2026-01-12', data: { date: '2026-01-12', mainNumbers: [2,7,21,23,34] } },
  { id: 'seed-t5d-2026-01-11', data: { date: '2026-01-11', mainNumbers: [2,21,31,32,33] } },
  { id: 'seed-t5d-2026-01-10', data: { date: '2026-01-10', mainNumbers: [1,5,8,19,25] } },
  { id: 'seed-t5d-2026-01-09', data: { date: '2026-01-09', mainNumbers: [3,5,27,37,39] } },
  { id: 'seed-t5d-2026-01-08', data: { date: '2026-01-08', mainNumbers: [21,23,36,37,38] } },
  { id: 'seed-t5d-2026-01-07', data: { date: '2026-01-07', mainNumbers: [10,24,25,28,32] } },
  { id: 'seed-t5d-2026-01-06', data: { date: '2026-01-06', mainNumbers: [2,7,21,33,37] } },
  { id: 'seed-t5d-2026-01-05', data: { date: '2026-01-05', mainNumbers: [12,13,15,25,33] } },
  { id: 'seed-t5d-2026-01-04', data: { date: '2026-01-04', mainNumbers: [6,17,19,28,31] } },
  { id: 'seed-t5d-2026-01-03', data: { date: '2026-01-03', mainNumbers: [11,12,17,29,33] } },
  { id: 'seed-t5d-2026-01-02', data: { date: '2026-01-02', mainNumbers: [10,11,18,22,28] } },
  { id: 'seed-t5d-2026-01-01', data: { date: '2026-01-01', mainNumbers: [8,12,13,15,27] } }
];

// Historial inicial Take 5 Evening (resultados oficiales)
const TAKE5EVE_SEED_HISTORY = [
  { id: 'seed-t5e-2026-03-05', data: { date: '2026-03-05', mainNumbers: [3,5,20,30,36] } },
  { id: 'seed-t5e-2026-03-04', data: { date: '2026-03-04', mainNumbers: [8,21,27,34,37] } },
  { id: 'seed-t5e-2026-03-03', data: { date: '2026-03-03', mainNumbers: [3,5,19,22,36] } },
  { id: 'seed-t5e-2026-03-02', data: { date: '2026-03-02', mainNumbers: [14,19,31,33,36] } },
  { id: 'seed-t5e-2026-03-01', data: { date: '2026-03-01', mainNumbers: [1,13,14,19,34] } },
  { id: 'seed-t5e-2026-02-28', data: { date: '2026-02-28', mainNumbers: [2,25,36,37,39] } },
  { id: 'seed-t5e-2026-02-27', data: { date: '2026-02-27', mainNumbers: [8,12,22,27,30] } },
  { id: 'seed-t5e-2026-02-26', data: { date: '2026-02-26', mainNumbers: [15,17,20,23,27] } },
  { id: 'seed-t5e-2026-02-25', data: { date: '2026-02-25', mainNumbers: [9,18,21,25,38] } },
  { id: 'seed-t5e-2026-02-23', data: { date: '2026-02-23', mainNumbers: [2,10,13,24,32] } },
  { id: 'seed-t5e-2026-02-22', data: { date: '2026-02-22', mainNumbers: [14,25,27,31,32] } },
  { id: 'seed-t5e-2026-02-21', data: { date: '2026-02-21', mainNumbers: [5,13,18,26,31] } },
  { id: 'seed-t5e-2026-02-20', data: { date: '2026-02-20', mainNumbers: [6,8,9,15,20] } },
  { id: 'seed-t5e-2026-02-19', data: { date: '2026-02-19', mainNumbers: [6,22,29,35,37] } },
  { id: 'seed-t5e-2026-02-18', data: { date: '2026-02-18', mainNumbers: [4,5,7,31,39] } },
  { id: 'seed-t5e-2026-02-17', data: { date: '2026-02-17', mainNumbers: [8,15,21,28,33] } },
  { id: 'seed-t5e-2026-02-16', data: { date: '2026-02-16', mainNumbers: [3,15,18,23,30] } },
  { id: 'seed-t5e-2026-02-15', data: { date: '2026-02-15', mainNumbers: [16,18,21,25,38] } },
  { id: 'seed-t5e-2026-02-14', data: { date: '2026-02-14', mainNumbers: [1,8,23,34,35] } },
  { id: 'seed-t5e-2026-02-13', data: { date: '2026-02-13', mainNumbers: [4,25,26,32,39] } },
  { id: 'seed-t5e-2026-02-12', data: { date: '2026-02-12', mainNumbers: [15,16,20,28,34] } },
  { id: 'seed-t5e-2026-02-11', data: { date: '2026-02-11', mainNumbers: [2,3,15,28,29] } },
  { id: 'seed-t5e-2026-02-10', data: { date: '2026-02-10', mainNumbers: [19,20,22,36,39] } },
  { id: 'seed-t5e-2026-02-09', data: { date: '2026-02-09', mainNumbers: [12,16,17,25,31] } },
  { id: 'seed-t5e-2026-02-08', data: { date: '2026-02-08', mainNumbers: [1,20,23,34,38] } },
  { id: 'seed-t5e-2026-02-07', data: { date: '2026-02-07', mainNumbers: [1,8,13,34,37] } },
  { id: 'seed-t5e-2026-02-06', data: { date: '2026-02-06', mainNumbers: [19,21,22,23,32] } },
  { id: 'seed-t5e-2026-02-05', data: { date: '2026-02-05', mainNumbers: [7,17,23,27,36] } },
  { id: 'seed-t5e-2026-02-04', data: { date: '2026-02-04', mainNumbers: [3,18,21,24,35] } },
  { id: 'seed-t5e-2026-02-03', data: { date: '2026-02-03', mainNumbers: [8,14,20,25,28] } },
  { id: 'seed-t5e-2026-02-02', data: { date: '2026-02-02', mainNumbers: [14,19,20,23,29] } },
  { id: 'seed-t5e-2026-02-01', data: { date: '2026-02-01', mainNumbers: [3,5,7,16,37] } },
  { id: 'seed-t5e-2026-01-31', data: { date: '2026-01-31', mainNumbers: [1,11,16,30,36] } },
  { id: 'seed-t5e-2026-01-30', data: { date: '2026-01-30', mainNumbers: [10,21,28,29,32] } },
  { id: 'seed-t5e-2026-01-29', data: { date: '2026-01-29', mainNumbers: [5,19,33,36,38] } },
  { id: 'seed-t5e-2026-01-28', data: { date: '2026-01-28', mainNumbers: [2,7,21,22,37] } },
  { id: 'seed-t5e-2026-01-27', data: { date: '2026-01-27', mainNumbers: [2,6,26,35,38] } },
  { id: 'seed-t5e-2026-01-26', data: { date: '2026-01-26', mainNumbers: [18,21,25,32,34] } },
  { id: 'seed-t5e-2026-01-25', data: { date: '2026-01-25', mainNumbers: [12,22,26,30,38] } },
  { id: 'seed-t5e-2026-01-24', data: { date: '2026-01-24', mainNumbers: [3,24,30,33,37] } },
  { id: 'seed-t5e-2026-01-23', data: { date: '2026-01-23', mainNumbers: [5,7,13,15,18] } },
  { id: 'seed-t5e-2026-01-22', data: { date: '2026-01-22', mainNumbers: [4,13,15,18,33] } },
  { id: 'seed-t5e-2026-01-21', data: { date: '2026-01-21', mainNumbers: [6,18,25,28,37] } },
  { id: 'seed-t5e-2026-01-20', data: { date: '2026-01-20', mainNumbers: [6,22,24,30,38] } },
  { id: 'seed-t5e-2026-01-19', data: { date: '2026-01-19', mainNumbers: [22,5,28,33,39] } },
  { id: 'seed-t5e-2026-01-18', data: { date: '2026-01-18', mainNumbers: [1,9,12,25,30] } },
  { id: 'seed-t5e-2026-01-17', data: { date: '2026-01-17', mainNumbers: [13,24,27,33,38] } },
  { id: 'seed-t5e-2026-01-16', data: { date: '2026-01-16', mainNumbers: [7,8,14,17,30] } },
  { id: 'seed-t5e-2026-01-15', data: { date: '2026-01-15', mainNumbers: [11,18,19,34,39] } },
  { id: 'seed-t5e-2026-01-14', data: { date: '2026-01-14', mainNumbers: [1,2,12,23,38] } },
  { id: 'seed-t5e-2026-01-13', data: { date: '2026-01-13', mainNumbers: [21,11,4,22,26] } },
  { id: 'seed-t5e-2026-01-12', data: { date: '2026-01-12', mainNumbers: [4,5,13,22,26] } },
  { id: 'seed-t5e-2026-01-11', data: { date: '2026-01-11', mainNumbers: [10,12,21,36,38] } },
  { id: 'seed-t5e-2026-01-10', data: { date: '2026-01-10', mainNumbers: [3,4,10,15,39] } },
  { id: 'seed-t5e-2026-01-09', data: { date: '2026-01-09', mainNumbers: [5,18,29,34,35] } },
  { id: 'seed-t5e-2026-01-08', data: { date: '2026-01-08', mainNumbers: [11,5,24,29,39] } },
  { id: 'seed-t5e-2026-01-07', data: { date: '2026-01-07', mainNumbers: [31,33,34,37,39] } },
  { id: 'seed-t5e-2026-01-06', data: { date: '2026-01-06', mainNumbers: [3,14,19,24,32] } },
  { id: 'seed-t5e-2026-01-05', data: { date: '2026-01-05', mainNumbers: [5,14,18,24,39] } },
  { id: 'seed-t5e-2026-01-04', data: { date: '2026-01-04', mainNumbers: [4,10,18,27,39] } },
  { id: 'seed-t5e-2026-01-03', data: { date: '2026-01-03', mainNumbers: [4,6,18,21,27] } },
  { id: 'seed-t5e-2026-01-02', data: { date: '2026-01-02', mainNumbers: [7,15,17,18,26] } },
  { id: 'seed-t5e-2026-01-01', data: { date: '2026-01-01', mainNumbers: [6,8,9,16,27] } }
];

// Historial inicial Win 4 Midday (4 dígitos 0-9)
const WIN4DAY_SEED_HISTORY = [
  { id: 'seed-w4d-2026-03-06', data: { date: '2026-03-06', mainNumbers: [3,5,5,9] } },
  { id: 'seed-w4d-2026-03-05', data: { date: '2026-03-05', mainNumbers: [6,1,3,9] } },
  { id: 'seed-w4d-2026-03-04', data: { date: '2026-03-04', mainNumbers: [5,2,1,4] } },
  { id: 'seed-w4d-2026-03-03', data: { date: '2026-03-03', mainNumbers: [5,7,3,4] } },
  { id: 'seed-w4d-2026-03-02', data: { date: '2026-03-02', mainNumbers: [8,5,7,2] } },
  { id: 'seed-w4d-2026-03-01', data: { date: '2026-03-01', mainNumbers: [7,8,7,5] } },
  { id: 'seed-w4d-2026-02-28', data: { date: '2026-02-28', mainNumbers: [4,2,5,6] } },
  { id: 'seed-w4d-2026-02-27', data: { date: '2026-02-27', mainNumbers: [6,1,5,5] } },
  { id: 'seed-w4d-2026-02-26', data: { date: '2026-02-26', mainNumbers: [8,7,0,4] } },
  { id: 'seed-w4d-2026-02-25', data: { date: '2026-02-25', mainNumbers: [4,6,5,6] } },
  { id: 'seed-w4d-2026-02-24', data: { date: '2026-02-24', mainNumbers: [1,2,5,3] } },
  { id: 'seed-w4d-2026-02-23', data: { date: '2026-02-23', mainNumbers: [5,2,5,5] } },
  { id: 'seed-w4d-2026-02-22', data: { date: '2026-02-22', mainNumbers: [9,8,3,7] } },
  { id: 'seed-w4d-2026-02-21', data: { date: '2026-02-21', mainNumbers: [8,5,1,5] } },
  { id: 'seed-w4d-2026-02-20', data: { date: '2026-02-20', mainNumbers: [8,3,9,6] } },
  { id: 'seed-w4d-2026-02-19', data: { date: '2026-02-19', mainNumbers: [6,9,0,3] } },
  { id: 'seed-w4d-2026-02-18', data: { date: '2026-02-18', mainNumbers: [7,2,1,3] } },
  { id: 'seed-w4d-2026-02-17', data: { date: '2026-02-17', mainNumbers: [8,2,1,7] } },
  { id: 'seed-w4d-2026-02-16', data: { date: '2026-02-16', mainNumbers: [1,9,2,5] } },
  { id: 'seed-w4d-2026-02-15', data: { date: '2026-02-15', mainNumbers: [5,7,5,8] } },
  { id: 'seed-w4d-2026-02-14', data: { date: '2026-02-14', mainNumbers: [8,9,1,1] } },
  { id: 'seed-w4d-2026-02-13', data: { date: '2026-02-13', mainNumbers: [7,5,1,5] } },
  { id: 'seed-w4d-2026-02-12', data: { date: '2026-02-12', mainNumbers: [3,6,8,1] } },
  { id: 'seed-w4d-2026-02-11', data: { date: '2026-02-11', mainNumbers: [8,3,8,3] } },
  { id: 'seed-w4d-2026-02-10', data: { date: '2026-02-10', mainNumbers: [8,5,4,8] } },
  { id: 'seed-w4d-2026-02-09', data: { date: '2026-02-09', mainNumbers: [0,6,3,3] } },
  { id: 'seed-w4d-2026-02-08', data: { date: '2026-02-08', mainNumbers: [3,4,6,6] } },
  { id: 'seed-w4d-2026-02-07', data: { date: '2026-02-07', mainNumbers: [4,3,2,5] } },
  { id: 'seed-w4d-2026-02-06', data: { date: '2026-02-06', mainNumbers: [4,6,8,4] } },
  { id: 'seed-w4d-2026-02-05', data: { date: '2026-02-05', mainNumbers: [7,1,8,3] } },
  { id: 'seed-w4d-2026-02-04', data: { date: '2026-02-04', mainNumbers: [1,3,3,0] } },
  { id: 'seed-w4d-2026-02-03', data: { date: '2026-02-03', mainNumbers: [2,6,4,7] } },
  { id: 'seed-w4d-2026-02-02', data: { date: '2026-02-02', mainNumbers: [3,9,6,2] } },
  { id: 'seed-w4d-2026-02-01', data: { date: '2026-02-01', mainNumbers: [1,2,2,0] } },
  { id: 'seed-w4d-2026-01-31', data: { date: '2026-01-31', mainNumbers: [5,9,6,4] } },
  { id: 'seed-w4d-2026-01-30', data: { date: '2026-01-30', mainNumbers: [8,1,8,8] } },
  { id: 'seed-w4d-2026-01-29', data: { date: '2026-01-29', mainNumbers: [3,3,9,1] } },
  { id: 'seed-w4d-2026-01-28', data: { date: '2026-01-28', mainNumbers: [1,0,4,4] } },
  { id: 'seed-w4d-2026-01-27', data: { date: '2026-01-27', mainNumbers: [1,5,5,0] } },
  { id: 'seed-w4d-2026-01-26', data: { date: '2026-01-26', mainNumbers: [5,3,9,5] } },
  { id: 'seed-w4d-2026-01-25', data: { date: '2026-01-25', mainNumbers: [9,9,8,3] } },
  { id: 'seed-w4d-2026-01-24', data: { date: '2026-01-24', mainNumbers: [7,3,7,6] } },
  { id: 'seed-w4d-2026-01-23', data: { date: '2026-01-23', mainNumbers: [0,8,1,4] } },
  { id: 'seed-w4d-2026-01-22', data: { date: '2026-01-22', mainNumbers: [2,4,4,4] } },
  { id: 'seed-w4d-2026-01-21', data: { date: '2026-01-21', mainNumbers: [9,3,4,7] } },
  { id: 'seed-w4d-2026-01-20', data: { date: '2026-01-20', mainNumbers: [0,9,0,5] } },
  { id: 'seed-w4d-2026-01-19', data: { date: '2026-01-19', mainNumbers: [3,9,7,1] } },
  { id: 'seed-w4d-2026-01-18', data: { date: '2026-01-18', mainNumbers: [1,5,0,1] } },
  { id: 'seed-w4d-2026-01-17', data: { date: '2026-01-17', mainNumbers: [0,8,0,4] } },
  { id: 'seed-w4d-2026-01-16', data: { date: '2026-01-16', mainNumbers: [8,3,5,0] } },
  { id: 'seed-w4d-2026-01-15', data: { date: '2026-01-15', mainNumbers: [0,6,1,7] } },
  { id: 'seed-w4d-2026-01-14', data: { date: '2026-01-14', mainNumbers: [6,2,5,0] } },
  { id: 'seed-w4d-2026-01-13', data: { date: '2026-01-13', mainNumbers: [1,1,7,2] } },
  { id: 'seed-w4d-2026-01-12', data: { date: '2026-01-12', mainNumbers: [4,9,4,5] } },
  { id: 'seed-w4d-2026-01-11', data: { date: '2026-01-11', mainNumbers: [2,9,9,0] } },
  { id: 'seed-w4d-2026-01-10', data: { date: '2026-01-10', mainNumbers: [4,7,0,7] } },
  { id: 'seed-w4d-2026-01-09', data: { date: '2026-01-09', mainNumbers: [0,9,4,5] } },
  { id: 'seed-w4d-2026-01-08', data: { date: '2026-01-08', mainNumbers: [6,7,2,9] } },
  { id: 'seed-w4d-2026-01-07', data: { date: '2026-01-07', mainNumbers: [6,1,1,8] } },
  { id: 'seed-w4d-2026-01-06', data: { date: '2026-01-06', mainNumbers: [2,6,6,6] } },
  { id: 'seed-w4d-2026-01-05', data: { date: '2026-01-05', mainNumbers: [8,3,6,3] } },
  { id: 'seed-w4d-2026-01-04', data: { date: '2026-01-04', mainNumbers: [8,4,0,4] } },
  { id: 'seed-w4d-2026-01-03', data: { date: '2026-01-03', mainNumbers: [4,5,4,0] } },
  { id: 'seed-w4d-2026-01-02', data: { date: '2026-01-02', mainNumbers: [3,6,3,0] } },
  { id: 'seed-w4d-2026-01-01', data: { date: '2026-01-01', mainNumbers: [5,5,4,6] } }
];

// Historial inicial Win 4 Evening (4 dígitos 0-9)
const WIN4EVE_SEED_HISTORY = [
  { id: 'seed-w4e-2026-03-05', data: { date: '2026-03-05', mainNumbers: [8,6,8,1] } },
  { id: 'seed-w4e-2026-03-04', data: { date: '2026-03-04', mainNumbers: [8,8,9,6] } },
  { id: 'seed-w4e-2026-03-03', data: { date: '2026-03-03', mainNumbers: [6,2,1,2] } },
  { id: 'seed-w4e-2026-03-02', data: { date: '2026-03-02', mainNumbers: [4,6,8,6] } },
  { id: 'seed-w4e-2026-03-01', data: { date: '2026-03-01', mainNumbers: [7,3,5,8] } },
  { id: 'seed-w4e-2026-02-28', data: { date: '2026-02-28', mainNumbers: [5,0,7,6] } },
  { id: 'seed-w4e-2026-02-27', data: { date: '2026-02-27', mainNumbers: [6,5,0,6] } },
  { id: 'seed-w4e-2026-02-26', data: { date: '2026-02-26', mainNumbers: [2,0,0,2] } },
  { id: 'seed-w4e-2026-02-25', data: { date: '2026-02-25', mainNumbers: [8,6,9,1] } },
  { id: 'seed-w4e-2026-02-24', data: { date: '2026-02-24', mainNumbers: [4,8,5,4] } },
  { id: 'seed-w4e-2026-02-23', data: { date: '2026-02-23', mainNumbers: [8,0,7,6] } },
  { id: 'seed-w4e-2026-02-22', data: { date: '2026-02-22', mainNumbers: [8,6,8,6] } },
  { id: 'seed-w4e-2026-02-21', data: { date: '2026-02-21', mainNumbers: [8,1,2,2] } },
  { id: 'seed-w4e-2026-02-20', data: { date: '2026-02-20', mainNumbers: [5,0,7,6] } },
  { id: 'seed-w4e-2026-02-19', data: { date: '2026-02-19', mainNumbers: [2,2,9,4] } },
  { id: 'seed-w4e-2026-02-18', data: { date: '2026-02-18', mainNumbers: [8,2,4,4] } },
  { id: 'seed-w4e-2026-02-16', data: { date: '2026-02-16', mainNumbers: [4,2,5,4] } },
  { id: 'seed-w4e-2026-02-15', data: { date: '2026-02-15', mainNumbers: [5,5,7,5] } },
  { id: 'seed-w4e-2026-02-14', data: { date: '2026-02-14', mainNumbers: [8,8,2,0] } },
  { id: 'seed-w4e-2026-02-13', data: { date: '2026-02-13', mainNumbers: [6,1,7,5] } },
  { id: 'seed-w4e-2026-02-12', data: { date: '2026-02-12', mainNumbers: [7,4,6,5] } },
  { id: 'seed-w4e-2026-02-11', data: { date: '2026-02-11', mainNumbers: [8,1,0,6] } },
  { id: 'seed-w4e-2026-02-10', data: { date: '2026-02-10', mainNumbers: [2,7,7,1] } },
  { id: 'seed-w4e-2026-02-09', data: { date: '2026-02-09', mainNumbers: [1,8,4,9] } },
  { id: 'seed-w4e-2026-02-08', data: { date: '2026-02-08', mainNumbers: [2,6,8,6] } },
  { id: 'seed-w4e-2026-02-07', data: { date: '2026-02-07', mainNumbers: [9,3,6,3] } },
  { id: 'seed-w4e-2026-02-06', data: { date: '2026-02-06', mainNumbers: [6,1,8,4] } },
  { id: 'seed-w4e-2026-02-05', data: { date: '2026-02-05', mainNumbers: [3,3,2,6] } },
  { id: 'seed-w4e-2026-02-04', data: { date: '2026-02-04', mainNumbers: [1,3,3,3] } },
  { id: 'seed-w4e-2026-02-03', data: { date: '2026-02-03', mainNumbers: [9,4,7,4] } },
  { id: 'seed-w4e-2026-02-02', data: { date: '2026-02-02', mainNumbers: [5,3,3,0] } },
  { id: 'seed-w4e-2026-02-01', data: { date: '2026-02-01', mainNumbers: [1,4,6,5] } },
  { id: 'seed-w4e-2026-01-31', data: { date: '2026-01-31', mainNumbers: [1,9,7,7] } },
  { id: 'seed-w4e-2026-01-30', data: { date: '2026-01-30', mainNumbers: [2,9,6,8] } },
  { id: 'seed-w4e-2026-01-29', data: { date: '2026-01-29', mainNumbers: [2,0,0,6] } },
  { id: 'seed-w4e-2026-01-28', data: { date: '2026-01-28', mainNumbers: [7,9,0,6] } },
  { id: 'seed-w4e-2026-01-27', data: { date: '2026-01-27', mainNumbers: [0,4,9,5] } },
  { id: 'seed-w4e-2026-01-26', data: { date: '2026-01-26', mainNumbers: [9,0,9,4] } },
  { id: 'seed-w4e-2026-01-25', data: { date: '2026-01-25', mainNumbers: [1,6,7,3] } },
  { id: 'seed-w4e-2026-01-24', data: { date: '2026-01-24', mainNumbers: [1,9,6,0] } },
  { id: 'seed-w4e-2026-01-23', data: { date: '2026-01-23', mainNumbers: [8,0,3,5] } },
  { id: 'seed-w4e-2026-01-22', data: { date: '2026-01-22', mainNumbers: [0,0,7,7] } },
  { id: 'seed-w4e-2026-01-21', data: { date: '2026-01-21', mainNumbers: [2,6,1,6] } },
  { id: 'seed-w4e-2026-01-20', data: { date: '2026-01-20', mainNumbers: [0,0,4,7] } },
  { id: 'seed-w4e-2026-01-19', data: { date: '2026-01-19', mainNumbers: [1,9,5,9] } },
  { id: 'seed-w4e-2026-01-18', data: { date: '2026-01-18', mainNumbers: [9,1,9,5] } },
  { id: 'seed-w4e-2026-01-17', data: { date: '2026-01-17', mainNumbers: [9,9,8,8] } },
  { id: 'seed-w4e-2026-01-16', data: { date: '2026-01-16', mainNumbers: [8,0,7,2] } },
  { id: 'seed-w4e-2026-01-15', data: { date: '2026-01-15', mainNumbers: [3,8,8,9] } },
  { id: 'seed-w4e-2026-01-14', data: { date: '2026-01-14', mainNumbers: [9,7,1,9] } },
  { id: 'seed-w4e-2026-01-13', data: { date: '2026-01-13', mainNumbers: [8,3,4,0] } },
  { id: 'seed-w4e-2026-01-12', data: { date: '2026-01-12', mainNumbers: [9,5,4,4] } },
  { id: 'seed-w4e-2026-01-11', data: { date: '2026-01-11', mainNumbers: [2,9,2,6] } },
  { id: 'seed-w4e-2026-01-10', data: { date: '2026-01-10', mainNumbers: [9,4,9,3] } },
  { id: 'seed-w4e-2026-01-09', data: { date: '2026-01-09', mainNumbers: [1,0,9,0] } },
  { id: 'seed-w4e-2026-01-08', data: { date: '2026-01-08', mainNumbers: [6,9,5,7] } },
  { id: 'seed-w4e-2026-01-07', data: { date: '2026-01-07', mainNumbers: [5,9,2,7] } },
  { id: 'seed-w4e-2026-01-06', data: { date: '2026-01-06', mainNumbers: [4,4,2,4] } },
  { id: 'seed-w4e-2026-01-05', data: { date: '2026-01-05', mainNumbers: [8,2,2,3] } },
  { id: 'seed-w4e-2026-01-04', data: { date: '2026-01-04', mainNumbers: [6,7,3,1] } },
  { id: 'seed-w4e-2026-01-03', data: { date: '2026-01-03', mainNumbers: [1,2,7,9] } },
  { id: 'seed-w4e-2026-01-02', data: { date: '2026-01-02', mainNumbers: [8,0,4,9] } },
  { id: 'seed-w4e-2026-01-01', data: { date: '2026-01-01', mainNumbers: [3,3,1,7] } }
];

const paths = {
  powerball: `artifacts/${appId}/public/data/powerball_drawings`,
  millionaireforlife: `artifacts/${appId}/public/data/millionaireforlife_drawings`,
  megamillions: `artifacts/${appId}/public/data/megamillions_drawings`,
  pick10: `artifacts/${appId}/public/data/pick10_drawings`,
  take5day: `artifacts/${appId}/public/data/take5day_drawings`,
  take5eve: `artifacts/${appId}/public/data/take5eve_drawings`,
  win4day: `artifacts/${appId}/public/data/win4day_drawings`,
  win4eve: `artifacts/${appId}/public/data/win4eve_drawings`
};

let showAll = Object.fromEntries(LOTTERY_IDS.map(id => [id, false]));
let allHistoryData = Object.fromEntries(LOTTERY_IDS.map(id => {
  if (id === 'pick10') return [id, [...PICK10_SEED_HISTORY]];
  if (id === 'megamillions') return [id, [...MEGA_MILLIONS_SEED_HISTORY]];
  if (id === 'millionaireforlife') return [id, [...M4L_SEED_HISTORY]];
  if (id === 'take5day') return [id, [...TAKE5DAY_SEED_HISTORY]];
  if (id === 'take5eve') return [id, [...TAKE5EVE_SEED_HISTORY]];
  if (id === 'win4day') return [id, [...WIN4DAY_SEED_HISTORY]];
  if (id === 'win4eve') return [id, [...WIN4EVE_SEED_HISTORY]];
  return [id, []];
}));

const domElements = {
  message: document.getElementById('messageBox'),
  tabs: Object.fromEntries(LOTTERY_IDS.map(lottery => {
    const cfg = LOTTERY_CONFIG[lottery];
    return [
      lottery,
      {
        history: document.querySelector(`.history-list[data-lottery="${lottery}"]`),
        loading: document.querySelector(`.loading-history[data-lottery="${lottery}"]`),
        verMasBtn: document.getElementById(`verMasBtn_${cfg.verMasId}`),
        verMasContainer: document.getElementById(`verMasContainer_${cfg.verMasId}`)
      }
    ];
  }))
};

const generateFriendlyId = () => {
  const adj = ["Ágil", "Brillante", "Creativo", "Dinámico", "Elegante"];
  const animals = ["Águila", "Ballena", "Conejo", "Delfín", "Elefante"];
  return `${adj[Math.floor(Math.random() * adj.length)]}-${animals[Math.floor(Math.random() * animals.length)]}-${Math.floor(Math.random() * 1000)}`;
};

const getLotteryRanges = (lottery) => {
  const c = LOTTERY_CONFIG[lottery];
  if (!c) return null;
  const drawCount = c.drawResultCount != null ? c.drawResultCount : c.mainCount;
  return {
    mainCount: c.mainCount,
    drawResultCount: drawCount,
    main: { min: c.mainMin, max: c.mainMax },
    special: c.hasSpecial ? { min: c.specialMin, max: c.specialMax } : null,
    hasSpecial: c.hasSpecial
  };
};

const validateNumber = (num, range) => num >= range.min && num <= range.max;
const validateNumbers = (nums, range) => nums.every(num => validateNumber(num, range));

const showMessage = (message, className) => {
  const msgBox = domElements.message;
  if (!msgBox) return;
  msgBox.textContent = message;
  msgBox.className = `mt-4 p-4 text-center rounded-lg transition-all duration-300 font-bold ${className}`;
  msgBox.style.display = 'block';
  setTimeout(() => { msgBox.style.display = 'none'; }, 4000);
};

const hideLoadingSpinners = () => {
  Object.values(domElements.tabs).forEach(tab => {
    if (tab && tab.loading) tab.loading.style.display = 'none';
  });
};

const getSpecialBallClass = (lottery) => ({
  powerball: 'special-ball',
  millionaireforlife: 'millionaire-ball',
  megamillions: 'mega-ball'
}[lottery] || '');

const displayBalls = (container, numbers, type, ballType) => {
  if (!container) return;
  container.innerHTML = '';
  numbers.forEach(num => {
    const ball = document.createElement('div');
    ball.textContent = num;
    ball.className = `lottery-ball ${ballType === 'main' ? (type === 'hot' ? 'hot-number' : 'cold-number') : ''}`;
    container.appendChild(ball);
  });
};

const displayPairs = (container, pairs) => {
  if (!container) return;
  container.innerHTML = '';
  pairs.forEach(pair => {
    const pairBox = document.createElement('div');
    pairBox.className = 'pair-box';
    pairBox.innerHTML = `
      <div class="lottery-ball" style="width:24px; height:24px; font-size:0.75rem">${pair[0]}</div>
      <div class="lottery-ball" style="width:24px; height:24px; font-size:0.75rem">${pair[1]}</div>
    `;
    container.appendChild(pairBox);
  });
};

const displayCombination = (container, title, mainNumbers, specialNumber, lottery) => {
  const ranges = getLotteryRanges(lottery);
  const hasSpecial = ranges && ranges.hasSpecial && specialNumber != null;
  const specialHtml = hasSpecial
    ? `<div class="lottery-ball ${getSpecialBallClass(lottery)}">${specialNumber}</div>`
    : '';
  const div = document.createElement('div');
  div.className = 'generated-combination mb-3';
  div.innerHTML = `
    <h4 class="text-sm font-bold mb-2 text-gray-300 uppercase">
      <i class="fas fa-microchip mr-1"></i>${title}
    </h4>
    <div class="flex flex-wrap items-center justify-center gap-3">
      ${mainNumbers.map(num => `<div class="lottery-ball">${num}</div>`).join('')}
      ${specialHtml}
    </div>
  `;
  container.appendChild(div);
  container.style.display = 'block';
};

const parseDrawingData = (data) => {
  let mainNumbers = [];
  if (data.mainNumbers) {
    try {
      mainNumbers = Array.isArray(data.mainNumbers) ? data.mainNumbers : JSON.parse(data.mainNumbers);
    } catch (e) {
      console.error("Error parsing mainNumbers:", e);
    }
  }
  return { ...data, mainNumbers };
};

// ==========================================
// PRECISIÓN
// ==========================================
function getPrecisionDivisor(lottery) {
  const c = LOTTERY_CONFIG[lottery];
  return c ? c.mainCount + (c.hasSpecial ? 1 : 0) : 6;
}

function calculatePrecision(lottery, realMain, realSpecial) {
  const today = new Date().toISOString().split('T')[0];
  const saved = localStorage.getItem(`prediction_${lottery}_${today}`);
  if (!saved) return 0;

  const prediction = JSON.parse(saved);
  let hits = 0;
  prediction.mainNumbers.forEach(num => {
    if (realMain.includes(num)) hits++;
  });
  const c = LOTTERY_CONFIG[lottery];
  if (c && c.hasSpecial && realSpecial !== undefined && prediction.special !== undefined && realSpecial === prediction.special) hits++;

  const divisor = getPrecisionDivisor(lottery);
  const precision = Math.round((hits / divisor) * 100);
  localStorage.setItem(`precision_${lottery}`, String(precision));
  return precision;
}

function saveUserPrediction(lottery, mainNumbers, specialNumber) {
  const today = new Date().toISOString().split('T')[0];
  const key = `prediction_${lottery}_${today}`;
  const prediction = { mainNumbers, special: specialNumber, date: today };
  localStorage.setItem(key, JSON.stringify(prediction));
}

function formatLotteryPlayText(mainNumbers, specialNumber) {
  const nums = Array.isArray(mainNumbers) ? mainNumbers.join(' - ') : 'N/D';
  return specialNumber != null ? `${nums} + ${specialNumber}` : nums;
}

function normalizeAgentConfidence(value) {
  let n = Number(value);
  if (!Number.isFinite(n)) return 6;
  if (n > 10) n = n / 10;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function buildLocalLotteryInsight(lottery, mainNumbers, specialNumber) {
  return {
    play: formatLotteryPlayText(mainNumbers, specialNumber),
    wisdom: `Ajustada con tendencia reciente de ${lottery.toUpperCase()} y balance de frecuencias.`,
    confidence: 6,
  };
}

function renderLotteryAgentPanel(lottery, insight) {
  const panel = document.getElementById('lotteryAgentInsightPanel');
  if (!panel) return;
  const playEl   = document.getElementById('lotteryAgentPlay');
  const wisdomEl = document.getElementById('lotteryAgentWisdom');
  const confEl   = document.getElementById('lotteryAgentConfidence');
  const confBar  = document.getElementById('lotteryAgentConfBar');
  const gameEl   = document.getElementById('lotteryAgentGame');
  const tsEl     = document.getElementById('lotteryAgentTimestamp');
  if (!playEl || !wisdomEl || !confEl || !gameEl) return;

  const safeInsight = insight || {
    play: 'No disponible',
    wisdom: 'Sin datos del agente en este momento.',
    confidence: 5,
  };
  const conf    = normalizeAgentConfidence(safeInsight.confidence);
  const confPct = conf * 10;

  playEl.textContent   = safeInsight.play    || 'No disponible';
  wisdomEl.textContent = safeInsight.wisdom  || 'Sin sabiduría disponible.';
  confEl.textContent   = `${conf}/10`;
  gameEl.textContent   = (lottery || '').toUpperCase();

  if (tsEl) {
    const now = new Date();
    tsEl.textContent = 'Hoy ' + now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  if (confBar) {
    confBar.style.width = '0%';
    requestAnimationFrame(() => {
      confBar.style.width = confPct + '%';
      if (conf >= 8) {
        confBar.className = 'h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-green-500 to-teal-400';
      } else if (conf >= 6) {
        confBar.className = 'h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-cyan-500 to-teal-400';
      } else {
        confBar.className = 'h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-yellow-500 to-orange-400';
      }
    });
  }

  panel.classList.remove('hidden');
}

async function refreshLotteryAgentInsight(lottery, fallbackInsight) {
  let insight = fallbackInsight || null;
  if (INSIGHT_SUPPORTED_GAMES.has(lottery) && window.firebaseServices && typeof window.firebaseServices.getLotteryAgentInsight === 'function') {
    try {
      const remote = await window.firebaseServices.getLotteryAgentInsight(lottery);
      if (remote) {
        insight = {
          play: remote.play || remote.jugada || remote.pick || (remote.mainNumbers ? formatLotteryPlayText(remote.mainNumbers, remote.special) : null),
          wisdom: remote.wisdom || remote.explanation || remote.reason || remote.summary,
          confidence: remote.confidence || remote.confidence10 || remote.score,
        };
      }
    } catch (_) {
      // silent fallback
    }
  }
  if (!insight) {
    const saved = localStorage.getItem(`prediction_${lottery}_${new Date().toISOString().split('T')[0]}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        insight = buildLocalLotteryInsight(lottery, parsed.mainNumbers || [], parsed.special ?? null);
      } catch (_) {
        insight = null;
      }
    }
  }
  renderLotteryAgentPanel(lottery, insight);
}

function updatePrecisionDisplay() {
  LOTTERY_IDS.forEach(lot => {
    const p = localStorage.getItem(`precision_${lot}`) || 0;
    const el = document.getElementById(`precisionReal_${lot}`);
    if (el) el.textContent = `${p}%`;
  });
  const anyPrecision = LOTTERY_IDS.some(lot => parseFloat(localStorage.getItem(`precision_${lot}`) || 0) > 0);
  const help = document.getElementById('precisionHelp');
  if (help) help.style.display = anyPrecision ? 'none' : '';
}

// ==========================================
// RENDER HISTORIAL
// ==========================================
const renderHistory = (lottery) => {
  const data = allHistoryData[lottery];
  const tab = domElements.tabs[lottery];
  if (!tab) return;
  const { history, loading, verMasBtn, verMasContainer } = tab;
  if (!loading || !history) return;

  loading.style.display = 'none';
  history.innerHTML = '';
  const ranges = getLotteryRanges(lottery);
  const hasSpecial = ranges && ranges.hasSpecial;

  if (data.length === 0) {
    history.innerHTML = `<p class="text-gray-500 text-sm text-center py-6 italic">No hay sorteos registrados.</p>`;
    if (verMasContainer) verMasContainer.style.display = 'none';
    return;
  }

  data.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
  const toShow = showAll[lottery] ? data : data.slice(0, 5);

  toShow.forEach(item => {
    const parsed = parseDrawingData(item.data);
    const isSeed = item.id && String(item.id).startsWith('seed-');
    const entryDiv = document.createElement('div');
    entryDiv.className = 'history-item history-line flex flex-col sm:flex-row sm:items-center justify-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg mb-2 flex-nowrap';
    const specialHtml = hasSpecial && item.data.special != null
      ? `<span class="history-special-label text-gray-500 text-xs uppercase mr-1">${lottery === 'powerball' ? 'PB' : lottery === 'megamillions' || lottery === 'millionaireforlife' ? 'MB' : 'CB'}</span><div class="lottery-ball ${getSpecialBallClass(lottery)}">${item.data.special}</div>`
      : '';
    entryDiv.innerHTML = `
      <span class="text-gray-400 text-xs font-mono bg-gray-900 px-2 py-1 rounded shrink-0">${item.data.date}</span>
      <div class="flex gap-1 flex-wrap sm:flex-nowrap items-center justify-start">
        ${parsed.mainNumbers.map(num => `<div class="lottery-ball lottery-ball-inline">${num}</div>`).join('')}
        ${specialHtml}
      </div>
    `;

    if (!isSeed) {
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      deleteBtn.className = 'delete-btn text-gray-600 hover:text-red-500 p-2 rounded-full ml-auto';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (!window.confirm('¿Eliminar sorteo?')) return;
        try {
          await deleteDoc(doc(db, paths[lottery], item.id));
          showMessage('Sorteo eliminado.', 'bg-yellow-600 text-white');
        } catch (error) {
          showMessage('Error al eliminar.', 'bg-red-500 text-white');
        }
      };
      entryDiv.appendChild(deleteBtn);
    }
    history.appendChild(entryDiv);
  });

  if (verMasContainer) {
    verMasContainer.style.display = data.length > 5 ? 'block' : 'none';
    if (verMasBtn) {
      verMasBtn.innerHTML = showAll[lottery]
        ? 'Ver menos <i class="fas fa-chevron-up ml-1"></i>'
        : `Ver ${data.length - 5} más <i class="fas fa-chevron-down ml-1"></i>`;
    }
  }
};

// ==========================================
// AUTO-TAB EN CAMPOS DE REGISTRAR SORTEO (móvil y desktop)
// ==========================================
function setupAutoTabForDrawingInputs() {
  document.querySelectorAll('.lottery-section').forEach(section => {
    const mainInputs = section.querySelectorAll('input[data-type="main"]');
    const specialInput = section.querySelector('input[data-type="special"]');
    const inputs = [...Array.from(mainInputs), ...(specialInput ? [specialInput] : [])];
    if (inputs.length === 0) return;

    inputs.forEach((input, index) => {
      const maxAttr = input.getAttribute('max');
      const maxVal = maxAttr ? parseInt(maxAttr, 10) : 80;
      const maxLen = maxVal <= 9 ? 1 : 2;
      if (!input.getAttribute('maxlength')) input.setAttribute('maxlength', String(maxLen));

      input.addEventListener('input', function () {
        const v = this.value.replace(/\D/g, '').slice(0, maxLen);
        if (this.value !== v) this.value = v;
        if (v.length >= maxLen) {
          const next = inputs[index + 1];
          if (next) {
            next.focus();
            if (next.select) next.select();
          }
        }
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'Tab' || e.key === 'Enter') {
          const next = inputs[index + 1];
          if (next) {
            e.preventDefault();
            next.focus();
            next.select && next.select();
          }
        } else if (e.key === 'ArrowLeft') {
          const prev = inputs[index - 1];
          if (prev) {
            e.preventDefault();
            prev.focus();
            prev.select && prev.select();
          }
        }
      });
    });
  });
}

// ==========================================
// EVENT LISTENERS
// ==========================================
// Mostrar última predicción guardada al cambiar de pestaña o cargar
function showLastPrediction(lottery) {
  const today = new Date().toISOString().split('T')[0];
  const key = `prediction_${lottery}_${today}`;
  const saved = localStorage.getItem(key);
  if (!saved) return;
  
  try {
    const prediction = JSON.parse(saved);
    const section = document.getElementById(`${lottery}-section`);
    if (!section) return;
    const container = section.querySelector('.generated-numbers-container');
    if (!container) return;
    
    // Solo mostrar si el contenedor está vacío (no hay predicciones nuevas)
    if (container.innerHTML.trim() === '' || container.querySelector('.loading-spinner')) {
      container.innerHTML = '';
      displayCombination(container, '📌 Tu predicción de hoy', prediction.mainNumbers, prediction.special ?? null, lottery);
      container.style.display = 'block';
    }
  } catch (e) {
    console.warn('Error al cargar predicción guardada:', e);
  }
}

const setupEventListeners = () => {
  document.querySelectorAll('.lottery-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const lottery = tab.dataset.lottery;
      document.querySelectorAll('.lottery-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.lottery-section').forEach(s => s.classList.add('hidden'));
      const section = document.getElementById(`${lottery}-section`);
      if (section) section.classList.remove('hidden');
      // Mostrar última predicción guardada para este juego
      setTimeout(() => showLastPrediction(lottery), 100);
      refreshLotteryAgentInsight(lottery);
    });
  });

  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const lottery = (e.currentTarget || e.target).dataset.lottery;
      const section = document.getElementById(`${lottery}-section`);
      if (!section) return;
      const date = section.querySelector('input[type="date"]').value;
      const mainInputs = section.querySelectorAll('input[data-type="main"]');
      const mains = Array.from(mainInputs).map(i => parseInt(i.value, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      const specialInput = section.querySelector('input[data-type="special"]');
      const special = specialInput ? parseInt(specialInput.value, 10) : null;
      const ranges = getLotteryRanges(lottery);
      if (!ranges) return;

      if (!date) return showMessage('Selecciona una fecha.', 'bg-red-500 text-white');
      const requiredCount = ranges.drawResultCount != null ? ranges.drawResultCount : ranges.mainCount;
      if (mains.length !== requiredCount || !validateNumbers(mains, ranges.main)) {
        return showMessage(`Verifica los números (${requiredCount} números ${ranges.main.min}-${ranges.main.max}).`, 'bg-red-500 text-white');
      }
      if (ranges.hasSpecial && (isNaN(special) || !validateNumber(special, ranges.special))) {
        return showMessage('Verifica el número especial.', 'bg-red-500 text-white');
      }

      try {
        const q = query(collection(db, paths[lottery]), where("date", "==", date));
        if (!(await getDocs(q)).empty) return showMessage('Ya existe ese sorteo.', 'bg-yellow-500 text-black');

        await addDoc(collection(db, paths[lottery]), {
          mainNumbers: JSON.stringify(mains),
          special: ranges.hasSpecial ? special : null,
          date,
          createdAt: new Date(),
          userId
        });

        showMessage('¡Sorteo guardado!', 'bg-green-600 text-white');
        Array.from(section.querySelectorAll('input')).forEach(i => { i.value = ''; });
        calculatePrecision(lottery, mains, ranges.hasSpecial ? special : undefined);
        updateStatistics();
        updatePrecisionDisplay();
      } catch (e) {
        showMessage('Error al guardar.', 'bg-red-500 text-white');
      }
    });
  });

  document.querySelectorAll('.generate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const lottery = (e.currentTarget || e.target).dataset.lottery;
      if (!lottery) return;
      const section = document.getElementById(`${lottery}-section`);
      if (!section) return;
      const data = allHistoryData[lottery] || [];
      const ranges = getLotteryRanges(lottery);
      const minData = Math.max(3, ranges ? ranges.mainCount : 5);
      if (data.length < minData) {
        showMessage('Pocos datos históricos. Registra más sorteos.', 'bg-yellow-500 text-black');
        return;
      }

      const analysisEl = section.querySelector('.analysis-results');
      if (analysisEl) analysisEl.style.display = 'none';
      const container = section.querySelector('.generated-numbers-container');
      container.innerHTML = '<div class="loading-spinner mx-auto"></div>';
      container.style.display = 'block';

      if (!window.lotteryAlgorithms) {
        showMessage('Error: Algoritmos no cargados. Actualiza la página.', 'bg-red-500 text-white');
        return;
      }

      setTimeout(() => {
        try {
          const combos = window.lotteryAlgorithms.generateMultipleCombinations(data, ranges, lottery);
          container.innerHTML = '';
          const titles = [
            '1. Basado en Frecuencia',
            '2. Números Fríos',
            '3. Mixta Equilibrada',
            '4. Patrones de Repetición',
            '5. Por decenas (1-9, 10-19, 20-29…)',
            '6. IA Aleatoria',
            '7. Markov+Poisson+Logística',
            '8. ⭐ Consenso Ensemble (Mejor Jugada)'
          ];
          const methodHints = {
            'basado-en-frecuencia': '📊 Frecuencia ponderada por fecha: sorteos recientes cuentan más para la próxima jugada.',
            'cold-numbers': '❄️ Números que menos han salido (fríos).',
            'mixed-balanced': '⚖️ Mezcla de números calientes y fríos.',
            'repeat-pattern': '🔁 Números que se repiten de un sorteo al siguiente.',
            'por-decenas': '📐 Por decenas (1-9, 10-19, 20-29…) con ponderación por fecha: sorteos recientes pesan más.',
            'random-optimized': '🎲 Paridad óptima (impar/par) y ajuste de suma histórica.',
            'markov-poisson-logistic': '📈 Modelo Markov (con suavizado Laplace) + Poisson por gap + Regresión Logística.',
            'consenso-ensemble': '🏆 Ensemble: combina frecuencia (30%), frecuencia ponderada (25%), EMA reciente (25%), gap analysis (10%) y Markov (10%) para seleccionar la jugada con mayor puntaje estadístico global.'
          };
          combos.forEach((combo, i) => {
            displayCombination(container, titles[i] || (i + 1) + '.', combo.mainNumbers, combo.special ?? null, lottery);
            const hintText = methodHints[combo.method];
            if (hintText) {
              const hint = document.createElement('div');
              hint.className = 'text-xs text-gray-400 mt-2';
              hint.textContent = hintText;
              container.lastElementChild.appendChild(hint);
            }
          });
          if (combos.length > 0) {
            saveUserPrediction(lottery, combos[0].mainNumbers, combos[0].special ?? null);
            refreshLotteryAgentInsight(lottery, buildLocalLotteryInsight(lottery, combos[0].mainNumbers, combos[0].special ?? null));
          } else {
            refreshLotteryAgentInsight(lottery);
          }
          totalPredictions += combos.length;
          const totalPredEl = document.getElementById('totalPredictions');
          if (totalPredEl) totalPredEl.textContent = totalPredictions;
          updateStatistics();
          showMessage('Predicciones generadas.', 'bg-blue-500 text-white');
        } catch (err) {
          console.error('Error al generar predicciones:', err);
          container.innerHTML = '';
          container.style.display = 'none';
          showMessage('Error al generar. Prueba de nuevo o registra más sorteos.', 'bg-red-500 text-white');
        }
      }, 10);
    });
  });

  document.querySelectorAll('.analyze-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const lottery = (e.currentTarget || e.target).dataset.lottery;
      const section = document.getElementById(`${lottery}-section`);
      const data = allHistoryData[lottery] || [];
      if (data.length === 0) return showMessage('No hay datos. Registra al menos un sorteo.', 'bg-yellow-500 text-black');

      const genContainer = section.querySelector('.generated-numbers-container');
      if (genContainer) genContainer.style.display = 'none';
      const mains = data.flatMap(item => parseDrawingData(item.data).mainNumbers);
      const ranges = getLotteryRanges(lottery);
      if (!ranges) return showMessage('Configuración del juego no encontrada.', 'bg-red-500 text-white');
      if (!window.lotteryAlgorithms) return showMessage('Módulo de estadísticas no cargado.', 'bg-red-500 text-white');

      const mainFreq = window.lotteryAlgorithms.calculateFrequency(mains, ranges.main.max, ranges.main.min);
      const hot = window.lotteryAlgorithms.getSortedNumbers(mainFreq, 'desc', 8);
      const cold = window.lotteryAlgorithms.getSortedNumbers(mainFreq, 'asc', 8);
      // calculatePairFrequency espera array de { id, data: { mainNumbers } }
      const pairFreq = window.lotteryAlgorithms.calculatePairFrequency(data);
      const pairs = window.lotteryAlgorithms.getSortedPairs(pairFreq, 6);

      const analysis = section.querySelector('.analysis-results');
      if (analysis) {
        displayBalls(analysis.querySelector('.hot-numbers'), hot, 'hot', 'main');
        displayBalls(analysis.querySelector('.cold-numbers'), cold, 'cold', 'main');
        displayPairs(analysis.querySelector('.hot-pairs'), pairs);
        analysis.style.display = 'block';
      }
    });
  });

  LOTTERY_IDS.forEach(lottery => {
    const cfg = LOTTERY_CONFIG[lottery];
    const btn = document.getElementById(`verMasBtn_${cfg.verMasId}`);
    if (btn) btn.onclick = () => {
      showAll[lottery] = !showAll[lottery];
      renderHistory(lottery);
    };
  });
};

// ==========================================
// LISTENERS DE FIREBASE
// ==========================================
const setupRealtimeListeners = () => {
  if (!userId || !db) return;

  const drawingKeys = LOTTERY_IDS.filter(id => paths[id]);
  drawingKeys.forEach(key => {
    if (paths[key]) {
      onSnapshot(
        query(collection(db, paths[key]), orderBy("date", "desc")),
        (snapshot) => {
          const firebaseItems = snapshot.docs.map(d => ({ id: d.id, data: d.data() }));
          if (key === 'pick10') {
            const existingDates = new Set(firebaseItems.map(i => i.data.date));
            const seedOnly = PICK10_SEED_HISTORY.filter(s => !existingDates.has(s.data.date));
            allHistoryData[key] = [...seedOnly, ...firebaseItems].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
          } else if (key === 'megamillions') {
            const existingDates = new Set(firebaseItems.map(i => i.data.date));
            const seedOnly = MEGA_MILLIONS_SEED_HISTORY.filter(s => !existingDates.has(s.data.date));
            allHistoryData[key] = [...seedOnly, ...firebaseItems].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
          } else if (key === 'millionaireforlife') {
            const existingDates = new Set(firebaseItems.map(i => i.data.date));
            const seedOnly = M4L_SEED_HISTORY.filter(s => !existingDates.has(s.data.date));
            allHistoryData[key] = [...seedOnly, ...firebaseItems].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
          } else if (key === 'take5day') {
            const existingDates = new Set(firebaseItems.map(i => i.data.date));
            const seedOnly = TAKE5DAY_SEED_HISTORY.filter(s => !existingDates.has(s.data.date));
            allHistoryData[key] = [...seedOnly, ...firebaseItems].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
          } else if (key === 'take5eve') {
            const existingDates = new Set(firebaseItems.map(i => i.data.date));
            const seedOnly = TAKE5EVE_SEED_HISTORY.filter(s => !existingDates.has(s.data.date));
            allHistoryData[key] = [...seedOnly, ...firebaseItems].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
          } else if (key === 'win4day') {
            const existingDates = new Set(firebaseItems.map(i => i.data.date));
            const seedOnly = WIN4DAY_SEED_HISTORY.filter(s => !existingDates.has(s.data.date));
            allHistoryData[key] = [...seedOnly, ...firebaseItems].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
          } else if (key === 'win4eve') {
            const existingDates = new Set(firebaseItems.map(i => i.data.date));
            const seedOnly = WIN4EVE_SEED_HISTORY.filter(s => !existingDates.has(s.data.date));
            allHistoryData[key] = [...seedOnly, ...firebaseItems].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
          } else {
            allHistoryData[key] = firebaseItems;
          }
          renderHistory(key);
          updateStatistics();
        },
        (err) => {
          if (err && err.code === 'permission-denied') {
            console.warn('[Firestore] Sin permiso para', key, '- Actualiza las reglas en Firebase Console.');
          } else if (err) {
            console.warn('[Firestore]', key, err.message || err);
          }
        }
      );
    }
  });
};

// ==========================================
// FETCH HISTORIAL COMPLETO — NY OPEN DATA
// ==========================================
// Estos endpoints son los mismos que alimentan jackpot.com y nylottery.ny.gov
const NY_OPEN_DATA = {
  powerball:          'https://data.ny.gov/resource/d6yy-54nr.json',
  megamillions:       'https://data.ny.gov/resource/5xaw-6ayf.json',
  take5:              'https://data.ny.gov/resource/dg63-4siq.json',
  win4:               'https://data.ny.gov/resource/hsys-3def.json',
  pick10:             'https://data.ny.gov/resource/bycu-cw7c.json',
  millionaireforlife: 'https://data.ny.gov/resource/kwxv-fwze.json'
};

function _nyDate(str) { return str ? str.split('T')[0] : null; }

function _nyItem(prefix, date, mainNumbers, special = null) {
  const d = { date, mainNumbers };
  if (special !== null) d.special = special;
  return { id: `ny-${prefix}-${date}`, data: d };
}

function _mergeNYInto(lottery, newItems) {
  const existingDates = new Set(allHistoryData[lottery].map(i => i.data.date));
  const fresh = newItems.filter(item => item.data.date && !existingDates.has(item.data.date));
  if (fresh.length > 0) {
    allHistoryData[lottery] = [...allHistoryData[lottery], ...fresh]
      .sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
    renderHistory(lottery);
    updateStatistics();
  }
  return fresh.length;
}

async function fetchNYOpenData() {
  const PARAMS = '?$limit=1000&$order=draw_date+DESC';
  let totalNew = 0;

  try {
    const [pbRes, mmRes, t5Res, w4Res, p10Res, m4lRes] = await Promise.allSettled([
      fetch(NY_OPEN_DATA.powerball + PARAMS).then(r => r.json()),
      fetch(NY_OPEN_DATA.megamillions + PARAMS).then(r => r.json()),
      fetch(NY_OPEN_DATA.take5 + PARAMS).then(r => r.json()),
      fetch(NY_OPEN_DATA.win4 + PARAMS).then(r => r.json()),
      fetch(NY_OPEN_DATA.pick10 + PARAMS).then(r => r.json()),
      fetch(NY_OPEN_DATA.millionaireforlife + PARAMS).then(r => r.json())
    ]);

    // --- Powerball: "n1 n2 n3 n4 n5 PB" ---
    if (pbRes.status === 'fulfilled' && Array.isArray(pbRes.value)) {
      const items = pbRes.value.map(row => {
        const date = _nyDate(row.draw_date);
        const nums = row.winning_numbers.trim().split(/\s+/).map(Number);
        return _nyItem('pb', date, nums.slice(0, 5).sort((a, b) => a - b), nums[5]);
      });
      totalNew += _mergeNYInto('powerball', items);
    }

    // --- Mega Millions: winning_numbers + mega_ball ---
    if (mmRes.status === 'fulfilled' && Array.isArray(mmRes.value)) {
      const items = mmRes.value.map(row => {
        const date = _nyDate(row.draw_date);
        const main = row.winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
        return _nyItem('mm', date, main, Number(row.mega_ball));
      });
      totalNew += _mergeNYInto('megamillions', items);
    }

    // --- Take 5: midday_winning_numbers + evening_winning_numbers ---
    if (t5Res.status === 'fulfilled' && Array.isArray(t5Res.value)) {
      const dayItems = [], eveItems = [];
      t5Res.value.forEach(row => {
        const date = _nyDate(row.draw_date);
        if (!date) return;
        if (row.midday_winning_numbers) {
          const nums = row.midday_winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
          dayItems.push(_nyItem('t5day', date, nums));
        }
        if (row.evening_winning_numbers) {
          const nums = row.evening_winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
          eveItems.push(_nyItem('t5eve', date, nums));
        }
      });
      totalNew += _mergeNYInto('take5day', dayItems);
      totalNew += _mergeNYInto('take5eve', eveItems);
    }

    // --- Win 4: midday_win_4 + evening_win_4 (4-digit string → [d,d,d,d]) ---
    if (w4Res.status === 'fulfilled' && Array.isArray(w4Res.value)) {
      const dayItems = [], eveItems = [];
      w4Res.value.forEach(row => {
        const date = _nyDate(row.draw_date);
        if (!date) return;
        if (row.midday_win_4 != null) {
          const digits = String(row.midday_win_4).padStart(4, '0').split('').map(Number);
          dayItems.push(_nyItem('w4day', date, digits));
        }
        if (row.evening_win_4 != null) {
          const digits = String(row.evening_win_4).padStart(4, '0').split('').map(Number);
          eveItems.push(_nyItem('w4eve', date, digits));
        }
      });
      totalNew += _mergeNYInto('win4day', dayItems);
      totalNew += _mergeNYInto('win4eve', eveItems);
    }

    // --- Pick 10: 20 numbers ---
    if (p10Res.status === 'fulfilled' && Array.isArray(p10Res.value)) {
      const items = p10Res.value.map(row => {
        const date = _nyDate(row.draw_date);
        const nums = row.winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
        return _nyItem('pick10', date, nums);
      });
      totalNew += _mergeNYInto('pick10', items);
    }

    // --- Millionaire For Life / Cash4Life: winning_numbers + cash_ball ---
    if (m4lRes.status === 'fulfilled' && Array.isArray(m4lRes.value)) {
      const items = m4lRes.value.map(row => {
        const date = _nyDate(row.draw_date);
        const main = row.winning_numbers.trim().split(/\s+/).map(Number).sort((a, b) => a - b);
        return _nyItem('m4l', date, main, Number(row.cash_ball));
      });
      totalNew += _mergeNYInto('millionaireforlife', items);
    }

    if (totalNew > 0) {
      console.log(`✅ NY Open Data: ${totalNew} nuevos sorteos agregados al historial.`);
    } else {
      console.log('✅ NY Open Data: Historial ya está actualizado.');
    }

  } catch (err) {
    console.warn('⚠️ Error cargando NY Open Data:', err.message || err);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setupAutoTabForDrawingInputs();
  startNextDrawingCountdown();
  // Mostrar de inmediato el historial seed (sin esperar a Firebase) para que se vean Pick 10, Mega Millions, Take 5, Win 4
  LOTTERY_IDS.forEach(lottery => {
    if (allHistoryData[lottery] && allHistoryData[lottery].length > 0) {
      renderHistory(lottery);
    }
  });
  hideLoadingSpinners();
  // Cargar historial completo desde NY Open Data en segundo plano
  fetchNYOpenData();

  // Mostrar "Tu predicción de hoy" para todos los juegos que tengan una guardada (no solo Powerball)
  LOTTERY_IDS.forEach(lottery => showLastPrediction(lottery));
  refreshLotteryAgentInsight('powerball');
  
  // Verificación del sistema al cargar
  console.log('🎯 Predicción de Lotería: Sistema cargado correctamente.');
  const today = new Date().toISOString().split('T')[0];
  const savedPredictions = LOTTERY_IDS.filter(lot => {
    const key = `prediction_${lot}_${today}`;
    return localStorage.getItem(key) !== null;
  });
  if (savedPredictions.length > 0) {
    console.log(`✅ Se encontraron ${savedPredictions.length} predicción(es) guardada(s) para hoy:`, savedPredictions.join(', '));
  }

  try {
    const app = initializeApp(firebaseConfig);
    const appCheckMeta = document.querySelector('meta[name="firebase-appcheck-recaptcha-site-key"]');
    const appCheckKey = (appCheckMeta && appCheckMeta.getAttribute('content') || '').trim();
    if (appCheckKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckKey),
        isTokenAutoRefreshEnabled: true
      });
    }
    auth = getAuth(app);
    initializeFirestore(app, {
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: false
    });
    db = getFirestore(app);
    const functions = getFunctions(app, 'us-central1');

    const userCredential = await signInAnonymously(auth);
    userId = userCredential.user.uid;
    const waitForAuthAndWarmTokens = async function () {
      if (!auth.currentUser) return;
      // Warm token to avoid first-call unauthenticated races in callable headers.
      await auth.currentUser.getIdToken(true);
      await new Promise((resolve) => setTimeout(resolve, 250));
    };
    const isTransientUnauth = function (error) {
      const code = (error && error.code) ? String(error.code) : '';
      const msg = (error && error.message) ? String(error.message) : '';
      return code === 'functions/unauthenticated'
        || code === 'unauthenticated'
        || /Unauthenticated/i.test(msg);
    };
    const runCallableWithAuthRetry = async function (callable, payload, opts) {
      const options = opts || {};
      const maxRetries = Number(options.maxRetries || 2);
      const retryDelayMs = Number(options.retryDelayMs || 350);
      await waitForAuthAndWarmTokens();
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await callable(payload || {});
        } catch (error) {
          if (!isTransientUnauth(error) || attempt >= maxRetries) throw error;
          await waitForAuthAndWarmTokens();
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        }
      }
      return callable(payload || {});
    };

    const friendlyId = localStorage.getItem('friendlyUserId') || generateFriendlyId();
    localStorage.setItem('friendlyUserId', friendlyId);
    const userIdDisplay = document.getElementById('userIdDisplay');
    if (userIdDisplay) userIdDisplay.textContent = friendlyId;

    const _getSportsOdds = httpsCallable(functions, 'getSportsOdds');
    const _getSportsEvents = httpsCallable(functions, 'getSportsEvents');
    const _getStandings = httpsCallable(functions, 'getStandings');
    const _getAgentPrediction = httpsCallable(functions, 'getAgentPrediction');
    const _getMlbAgentPrediction = httpsCallable(functions, 'getMlbAgentPrediction');
    const _getMLBAgentPrediction = httpsCallable(functions, 'getMLBAgentPrediction');
    const _getLotteryAgentInsight = httpsCallable(functions, 'getLotteryAgentInsight');
    const _getUserPlan = httpsCallable(functions, 'getUserPlan');
    const _seedStandings = httpsCallable(functions, 'seedStandings');
    const _createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
    const _createCustomerPortalSession = httpsCallable(functions, 'createCustomerPortalSession');

    window.firebaseServices = {
      callSportsOdds: async function (sport) {
        try {
          const result = await runCallableWithAuthRetry(
            _getSportsOdds,
            { sport },
            { maxRetries: 3, retryDelayMs: 400 }
          );
          const d = result.data;
          if (d && d.remaining !== undefined) {
            window._sportsQuotaRemaining = d.remaining;
          }
          return d && d.odds ? d.odds : null;
        } catch (e) {
          if (e.code === 'functions/resource-exhausted') {
            return { __rateLimited: true, message: e.message };
          }
          if (isTransientUnauth(e)) return null;
          console.warn('[Sports] Cloud Function error:', e.message);
          return null;
        }
      },
      getStandings: async function (sport) {
        try {
          const result = await runCallableWithAuthRetry(
            _getStandings,
            { sport },
            { maxRetries: 2, retryDelayMs: 300 }
          );
          return result.data || { teams: [], updatedAt: null };
        } catch (e) {
          console.warn('[Sports] getStandings error:', e.message);
          return { teams: [], updatedAt: null };
        }
      },
      getSportsEvents: async function (sport) {
        try {
          const result = await runCallableWithAuthRetry(
            _getSportsEvents,
            { sport },
            { maxRetries: 2, retryDelayMs: 300 }
          );
          return result.data || { sport, source: 'empty', events: [] };
        } catch (e) {
          console.warn('[Sports] getSportsEvents error:', e.message);
          return { sport, source: 'error', events: [] };
        }
      },
      getAgentPrediction: async function (payload) {
        var safePayload = payload || {};
        try {
          const result = await runCallableWithAuthRetry(
            _getAgentPrediction,
            safePayload,
            { maxRetries: 2, retryDelayMs: 300 }
          );
          var data = result && result.data ? result.data : null;
          if (data && typeof data === 'object') {
            if (Array.isArray(data.parlays) && data.parlays.length) return data;
            if (data.prediction != null || data.agentPlay || data.topPlay) return data;
          }
        } catch (e) {
          // fallback below
        }
        return {
          source: 'mock',
          generatedAt: 'fallback',
          parlays: []
        };
      },
      getMlbAgentPrediction: async function (payload) {
        const safePayload = payload || {};
        try {
          const result = await runCallableWithAuthRetry(
            _getMlbAgentPrediction,
            safePayload,
            { maxRetries: 2, retryDelayMs: 300 }
          );
          return result && result.data ? result.data : null;
        } catch (_) {
          try {
            const result = await runCallableWithAuthRetry(
              _getMLBAgentPrediction,
              safePayload,
              { maxRetries: 1, retryDelayMs: 250 }
            );
            return result && result.data ? result.data : null;
          } catch (_) {
            return null;
          }
        }
      },
      getLotteryAgentInsight: async function (gameType) {
        try {
          const result = await runCallableWithAuthRetry(
            _getLotteryAgentInsight,
            { gameType },
            { maxRetries: 2, retryDelayMs: 300 }
          );
          return result && result.data ? result.data : null;
        } catch (_) {
          return null;
        }
      },
      getUserPlan: async function () {
        try {
          const result = await runCallableWithAuthRetry(
            _getUserPlan,
            {},
            { maxRetries: 2, retryDelayMs: 300 }
          );
          return result.data || { planType: 'free', remaining: 5 };
        } catch (e) {
          return { planType: 'free', remaining: 5 };
        }
      },
      createProCheckoutSession: async function () {
        try {
          const result = await _createCheckoutSession({});
          return result.data || null;
        } catch (e) {
          throw new Error((e && e.message) ? e.message : 'No se pudo iniciar el checkout.');
        }
      },
      createCustomerPortalSession: async function () {
        try {
          const result = await _createCustomerPortalSession({});
          return result.data || null;
        } catch (e) {
          throw new Error((e && e.message) ? e.message : 'No se pudo abrir el portal de facturación.');
        }
      },
      saveSportsFeedback: async function (predId, sport, vote) {
        if (!userId) return;
        const docId = userId + '_' + predId;
        const voteRef = doc(db, 'sportsVotes', docId);
        try {
          await setDoc(voteRef, {
            uid: userId,
            predId,
            sport,
            vote,
            createdAt: serverTimestamp(),
            date: new Date().toISOString().slice(0, 10),
          }, { merge: false });
        } catch (e) { /* duplicate */ }
      },
      watchGlobalAccuracy: function (callback) {
        const globalRef = doc(db, 'sportsAccuracy', 'global');
        return onSnapshot(globalRef,
          (snap) => callback(snap.exists() ? snap.data() : { yes: 0, no: 0 }),
          () => callback({ yes: 0, no: 0 })
        );
      },
    };
    window.firebaseServices.getSportsOdds = window.firebaseServices.callSportsOdds;
    window._sportsUserId = userId;
    window.seedStandings = async function () {
      console.log('[seedStandings] calling Cloud Function…');
      try {
        const r = await _seedStandings({});
        console.log('[seedStandings] result:', r.data);
        return r.data;
      } catch (e) {
        console.error('[seedStandings] failed:', e.message);
        throw e;
      }
    };
    window.firebaseServices.seedStandings = window.seedStandings;

    window.firebaseServices.watchGlobalAccuracy(function (data) {
      const yes = data.yes || 0;
      const no = data.no || 0;
      const total = yes + no;
      const pct = total > 0 ? Math.round((yes / total) * 100) : null;
      if (typeof _updateAccuracyWidget === 'function') {
        _updateAccuracyWidget(pct, total);
      }
    });

    if (typeof _resolveFirebaseSportsBridge === 'function') {
      _resolveFirebaseSportsBridge(true);
    }

    setupRealtimeListeners();

    // Mostrar de inmediato el historial seed (Pick 10, Mega Millions, Take 5, Win 4) sin esperar a Firebase
    LOTTERY_IDS.forEach(lottery => {
      if (allHistoryData[lottery] && allHistoryData[lottery].length > 0) {
        renderHistory(lottery);
      }
    });
    hideLoadingSpinners();

    setTimeout(() => {
      const activeUsers = document.getElementById('activeUsers');
      if (activeUsers) activeUsers.textContent = Math.floor(Math.random() * 50) + 20;
    }, 300);

  } catch (e) {
    console.error("Firebase Error:", e);
    if (typeof _resolveFirebaseSportsBridge === 'function') {
      _resolveFirebaseSportsBridge(false);
    }
    showMessage('Modo Offline: No se pudo conectar.', 'bg-red-500 text-white');
    // Aun así mostrar historial seed cuando Firebase falla
    LOTTERY_IDS.forEach(lottery => {
      if (allHistoryData[lottery] && allHistoryData[lottery].length > 0) {
        renderHistory(lottery);
      }
    });
    hideLoadingSpinners();
  }
});

function updateStatistics() {
  const totalDrawings = LOTTERY_IDS.reduce((sum, id) => sum + (allHistoryData[id]?.length || 0), 0);
  const elDrawings = document.getElementById('totalDrawings');
  const elPredictions = document.getElementById('totalPredictions');
  const elAccuracy = document.getElementById('avgAccuracy');

  if (elDrawings) elDrawings.textContent = totalDrawings;
  if (elPredictions) elPredictions.textContent = totalPredictions;

  let calculatedAccuracy = 0;
  if (totalDrawings > 0) {
    calculatedAccuracy = Math.min(98.5, 60 + (Math.log(totalDrawings) * 8));
  }

  if (elAccuracy) {
    elAccuracy.textContent = `${calculatedAccuracy.toFixed(1)}%`;
    elAccuracy.className = calculatedAccuracy > 80 ? "text-xl font-bold text-green-400" :
      calculatedAccuracy > 70 ? "text-xl font-bold text-yellow-400" :
        "text-xl font-bold text-gray-400";
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) lastUpdate.textContent = new Date().toLocaleDateString('es-ES');
    updatePrecisionDisplay();
  }, 100);
});
