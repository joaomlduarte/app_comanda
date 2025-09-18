// src/utils/events.js
const subs = new Set();

/** Inscreve um listener para o evento "comanda fechada". */
export function onComandaFechada(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

/** Emite o evento "comanda fechada". (payload opcional) */
export function emitComandaFechada(payload) {
  subs.forEach((cb) => {
    try { cb(payload); } catch (e) {}
  });
}
