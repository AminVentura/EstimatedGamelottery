const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

// Limpieza automática cada domingo a las 4:00 AM
exports.cleanPredictionLogs = onSchedule("0 4 * * 0", async (event) => {
  const db = admin.firestore();
  const limiteCorte = new Date();
  limiteCorte.setDate(limiteCorte.getDate() - 15); // En lotería, 15 días es suficiente para histórico de logs

  try {
    const snapshot = await db.collection("prediction_history")
      .where("createdAt", "<", limiteCorte)
      .get();

    if (snapshot.empty) return null;

    // Firestore batch permite máximo 500 operaciones por commit
    const BATCH_SIZE = 500;
    const docs = snapshot.docs;
    let totalEliminados = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      chunk.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      totalEliminados += chunk.length;
    }

    console.log(`PrediccionLoteria: Se eliminaron ${totalEliminados} predicciones antiguas.`);
    return totalEliminados;
  } catch (error) {
    console.error("Error en limpieza PrediccionLoteria:", error);
    throw error;
  }
});
