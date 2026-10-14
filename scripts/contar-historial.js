'use strict';
// Solo lectura. Cuenta los documentos del historial por colección:
//   - *_drawings (total, oficiales con id = fecha, otros)
//   - lottery_history/<juego>_<año>/draws
//   - archived_browser_drawings
// Uso: node scripts/contar-historial.js --project game-lottery-b0e90
// (credenciales: ver scripts/lib/firestore-cli.js)

const path = require('node:path');
const { openFirestore, functionsDir } = require('./lib/firestore-cli.js');

const TIMEOUT_MS = 5 * 60 * 1000;
const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

async function main() {
  const project = value('--project');
  if (!project) throw new Error('Falta --project <id>.');
  process.env.GCLOUD_PROJECT = project;
  const { publicDrawingsPath, isOfficialPublicDoc } = require(path.join(functionsDir, 'public-drawings.js'));
  const { GAMES } = require('./lib/juegos.js');
  const { db } = openFirestore(project);

  const out = { project, drawings: {}, lotteryHistory: {}, archivo: 0 };
  for (const g of GAMES) {
    const snap = await db.collection(publicDrawingsPath(g)).get();
    let oficiales = 0;
    snap.forEach((d) => { if (isOfficialPublicDoc(d.id, d.data())) oficiales += 1; });
    out.drawings[g] = { total: snap.size, oficiales, otros: snap.size - oficiales };
  }
  const years = await db.collection('lottery_history').listDocuments();
  for (const ref of years) {
    const c = await ref.collection('draws').count().get();
    const g = ref.id.replace(/_\d{4}$/, '');
    out.lotteryHistory[g] = (out.lotteryHistory[g] || 0) + c.data().count;
  }
  out.archivo = (await db.collection('archived_browser_drawings').count().get()).data().count;
  console.log(JSON.stringify(out, null, 2));
}

const timer = setTimeout(() => { console.error('Tiempo agotado.'); process.exit(2); }, TIMEOUT_MS);
main()
  .then(() => { clearTimeout(timer); process.exit(0); })
  .catch((err) => { clearTimeout(timer); console.error('ERROR:', err.message || String(err)); process.exit(1); });
