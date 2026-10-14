// Mezcla del historial público de un juego. Función pura (sin DOM ni Firebase) para poder probarla.
//
// Fuentes, por orden de preferencia para una misma fecha:
//   1. Documento oficial del servidor en *_drawings: su id es su propia fecha (AAAA-MM-DD).
//      Lo escribe la ingesta oficial (Cloud Function) desde 2026-10-13.
//   2. Documentos antiguos de *_drawings (id automático, los crearon los navegadores).
//   3. Semillas del código y filas ya cargadas en memoria (NY Open Data, ids «seed-» y «ny-»).
// Nunca se muestran dos filas con la misma fecha. No se inventa ni se rellena ningún sorteo.

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function esOficialDelServidor(item) {
  return !!item && !!item.data && typeof item.data.date === 'string'
    && FECHA.test(item.data.date) && item.id === item.data.date;
}

export function mezclarHistorial(firestoreItems, enMemoria = []) {
  const porFecha = new Map();
  (firestoreItems || []).forEach((item) => {
    const fecha = item && item.data && item.data.date;
    if (!fecha) return;
    const previo = porFecha.get(fecha);
    if (!previo || (esOficialDelServidor(item) && !esOficialDelServidor(previo))) {
      porFecha.set(fecha, item);
    }
  });
  (enMemoria || []).forEach((item) => {
    const fecha = item && item.data && item.data.date;
    if (!fecha || porFecha.has(fecha)) return;
    // Solo semillas y filas de NY Open Data: un documento de Firestore que ya no está
    // en la instantánea no debe quedarse pegado en pantalla.
    const id = String(item.id || '');
    if (id.startsWith('seed-') || id.startsWith('ny-')) porFecha.set(fecha, item);
  });
  return [...porFecha.values()].sort((a, b) => new Date(b.data.date) - new Date(a.data.date));
}
