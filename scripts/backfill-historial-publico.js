'use strict';
// Rellena el historial público (*_drawings) con lo que YA está en lottery_history.
//
// - Solo copia sorteos de la fuente oficial que guardó la ingesta (source = ny_open_data).
// - Idempotente: id = fecha y create(); lo que ya existe se deja como está.
// - No borra ni reescribe nada. No inventa sorteos ni rellena huecos.
// - Por defecto NO escribe (simulación). Para escribir hay que pasar --write.
//
// Uso (desde la raíz del repo, con credenciales de aplicación de gcloud:
//      gcloud auth application-default login):
//   node scripts/backfill-historial-publico.js --project game-lottery-b0e90 --dry-run
//   node scripts/backfill-historial-publico.js --project game-lottery-b0e90 --write
// Opcional: --game powerball   (un solo juego)
//
// Contra el emulador: FIRESTORE_EMULATOR_HOST=127.0.0.1:8089 y --project demo-...

const path = require('node:path');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const TIMEOUT_MS = 10 * 60 * 1000;

async function main() {
  const project = value('--project');
  const write = flag('--write');
  const dryRun = !write;
  if (flag('--write') && flag('--dry-run')) throw new Error('Usa --dry-run o --write, no los dos.');
  if (!project) throw new Error('Falta --project <id>. No se asume ningún proyecto.');
  const emulator = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (project.startsWith('demo-') && !emulator) {
    throw new Error('Un proyecto demo- solo vale con FIRESTORE_EMULATOR_HOST.');
  }

  process.env.GCLOUD_PROJECT = project;
  process.env.GOOGLE_CLOUD_PROJECT = project;

  const functionsDir = path.join(__dirname, '..', 'functions');
  const fn = require(path.join(functionsDir, 'index.js'));
  const { mirrorDrawsToPublic } = require(path.join(functionsDir, 'public-drawings.js'));
  // firebase-admin se resuelve desde functions/ (es donde está instalado).
  const requireFromFunctions = require('node:module').createRequire(path.join(functionsDir, 'package.json'));
  const { getFirestore, FieldValue } = requireFromFunctions('firebase-admin/firestore');
  const db = getFirestore();

  const onlyGame = value('--game');
  const games = fn.LOTTERY_GAME_TYPES_FOR_OPS.filter((g) => !onlyGame || g === onlyGame);
  if (!games.length) throw new Error('Juego no soportado: ' + onlyGame);

  console.log(JSON.stringify({ project, emulator: emulator || null, modo: dryRun ? 'SIMULACION (no escribe)' : 'ESCRITURA', games }));

  const totals = { enLotteryHistory: 0, descartadosPorFuente: 0, yaExistian: 0, creados: 0, porCrear: 0 };
  for (const gameType of games) {
    const draws = await fn.loadGameDrawsForOps(db, gameType, 100000);
    const result = await mirrorDrawsToPublic(db, gameType, draws, {
      dryRun,
      serverTimestamp: () => FieldValue.serverTimestamp(),
    });
    totals.enLotteryHistory += draws.length;
    totals.descartadosPorFuente += result.skipped;
    totals.yaExistian += result.existing;
    totals.creados += result.created;
    totals.porCrear += result.wouldCreate.length;
    console.log(JSON.stringify({
      gameType,
      enLotteryHistory: draws.length,
      descartadosPorFuente: result.skipped,
      candidatos: result.candidates,
      yaExistian: result.existing,
      creados: result.created,
      porCrear: result.wouldCreate.length,
      primeraPorCrear: result.wouldCreate[0] || null,
      ultimaPorCrear: result.wouldCreate[result.wouldCreate.length - 1] || null,
    }));
  }
  console.log(JSON.stringify({ total: totals, modo: dryRun ? 'SIMULACION' : 'ESCRITURA' }));
}

const timer = setTimeout(() => {
  console.error('Tiempo agotado (' + TIMEOUT_MS / 1000 + ' s).');
  process.exit(2);
}, TIMEOUT_MS);

main()
  .then(() => { clearTimeout(timer); process.exit(0); })
  .catch((err) => {
    clearTimeout(timer);
    console.error('ERROR:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
