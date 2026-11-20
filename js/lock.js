// Password di accesso all'app (blocco locale al dispositivo).
// Nota onesta: e' un lucchetto di cortesia lato browser: protegge da
// sguardi curiosi sul dispositivo, non e' cifratura dei dati.
const KEY = "turnario-ta-lock";

export function haPassword() {
  return !!localStorage.getItem(KEY);
}

async function hash(testo) {
  const dati = new TextEncoder().encode("turnario-ta:" + testo);
  if (crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", dati);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // riserva per ambienti senza crypto.subtle
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const b of dati) { h1 = ((h1 ^ b) * 16777619) >>> 0; h2 = ((h2 + b) * 31 + 7) >>> 0; }
  return "f" + h1.toString(16) + h2.toString(16);
}

export async function impostaPassword(password, sostituisci = false) {
  if (sostituisci && haPassword()) throw new Error("Password gia' impostata");
  if (!password || password.length < 4) throw new Error("Password troppo corta (minimo 4 caratteri)");
  localStorage.setItem(KEY, await hash(password));
}

export async function verificaPassword(password) {
  const salvato = localStorage.getItem(KEY);
  if (!salvato) return true;
  return (await hash(password)) === salvato;
}

export async function cambiaPassword(vecchia, nuova) {
  if (!(await verificaPassword(vecchia))) throw new Error("Password attuale errata");
  localStorage.removeItem(KEY);
  await impostaPassword(nuova);
}

export function rimuoviPassword() {
  localStorage.removeItem(KEY);
}
