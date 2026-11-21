// Log degli errori di produzione: manda a Supabase (tabella turnario_log)
// solo messaggi diagnostici (versione, messaggio d'errore, pagina): mai dati
// del registro. Se l'invio fallisce viene ignorato del tutto: il log non puo'
// mai interferire con l'uso dell'app.
import { SUPABASE_URL, SUPABASE_ANON_KEY, APP_VERSION } from "./config.js";

const BUFFER_KEY = "turnario-ta-errori";
const MAX_BUFFER = 8;
const MIN_TRA_INVII_MS = 30000;   // al massimo un invio ogni 30s per tipo

let ultimoInvio = {};

export function attivaErrorLog() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    registra({ messaggio: (e.message || "errore").slice(0, 400) });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const m = e && e.reason && (e.reason.message || e.reason);
    registra({ messaggio: String(m || "promessa rifiutata").slice(0, 400) });
  });
}

function leggiBuffer() {
  try { return JSON.parse(localStorage.getItem(BUFFER_KEY) || "[]") || []; }
  catch { return []; }
}

function scriviBuffer(lista) {
  try { localStorage.setItem(BUFFER_KEY, JSON.stringify(lista.slice(-MAX_BUFFER))); }
  catch { /* storage pieno: si ignora */ }
}

export async function registra(dati = {}) {
  const entry = {
    versione: APP_VERSION,
    pagina: (typeof location !== "undefined" ? location.hash || "#home" : ""),
    messaggio: String(dati.messaggio || "").slice(0, 400),
    when: new Date().toISOString(),
  };
  // anti-ciclone: un solo invio per tipo ogni 30 secondi
  const chiave = entry.messaggio.slice(0, 80);
  if (ultimoInvio[chiave] && Date.now() - ultimoInvio[chiave] < MIN_TRA_INVII_MS) return false;
  ultimoInvio[chiave] = Date.now();

  const buffer = leggiBuffer();
  buffer.push(entry);
  scriviBuffer(buffer);

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/turnario_log`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ versione: entry.versione, messaggio: entry.messaggio, pagina: entry.pagina }),
    });
    return res.ok;
  } catch { return false; }
}

// traccia locale degli ultimi errori (utile in assistenza: F12 > localStorage)
export function ultimiErrori() {
  return leggiBuffer();
}
