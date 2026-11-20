// Sincronizzazione automatica dell'archivio su Supabase.
// Nessuna libreria esterna: poggia direttamente sulle API REST.
// Se SUPABASE_URL/ANON_KEY non sono impostati in config.js, la
// sincronizzazione resta spenta e l'app funziona solo in locale.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const CRED_KEY = "turnario-ta-sync-cred";      // email+password salvate nel dispositivo
const SESSION_KEY = "turnario-ta-sync-token"; // token di sessione

let session = null;    // { access_token, user_id, expires_at }
let cred = null;       // { email, password }
let timer = null;      // debounce del salvataggio
let ultimoPush = null; // iso dell'ultimo salvataggio riuscito
let inCorsa = false;
let statusCb = null;

export const attivo = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export function onStatus(cb) { statusCb = cb; }

function status(s, dettaglio = "") {
  if (statusCb) statusCb(s, dettaglio);
}

function loadCred() {
  try { cred = JSON.parse(localStorage.getItem(CRED_KEY) || "null"); } catch { cred = null; }
  if (!session) {
    try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { session = null; }
  }
  return !!cred;
}

export function credenzialiSalvate() { return attivo() && loadCred(); }

export function impostaCredenziali(email, password) {
  cred = { email, password };
  localStorage.setItem(CRED_KEY, JSON.stringify(cred));
}

export function disconnetti() {
  cred = null; session = null;
  localStorage.removeItem(CRED_KEY);
  localStorage.removeItem(SESSION_KEY);
  status("spenta");
}

let ultimoRetry401 = 0;
async function api(path, opts = {}, retry = true) {
  const headers = Object.assign(
    { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    opts.headers || {}
  );
  if (session) headers["Authorization"] = "Bearer " + session.access_token;
  const res = await fetch(SUPABASE_URL + path, { ...opts, headers });
  if (res.status === 401 && retry && Date.now() - ultimoRetry401 > 5000) {
    ultimoRetry401 = Date.now();
    const ok = await login();
    if (ok) return api(path, opts, false);
  }
  return res;
}

export async function login() {
  loadCred();
  if (!cred) { status("senza-credenziali"); return false; }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: cred.email, password: cred.password }),
    });
    if (!res.ok) {
      status("errore", "Credenziali non valide o account non confermato.");
      session = null;
      return false;
    }
    const j = await res.json();
    if (!j.access_token) { status("errore", "Risposta inattesa dal server."); return false; }
    session = { access_token: j.access_token, user_id: j.user?.id };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  } catch (e) {
    status("errore", "Connessione non riuscita: " + (e && e.message ? e.message : ""));
    return false;
  }
}

// scarica l'archivio del turno (se esiste) -> { stato, aggiornato_al } | null
export async function scarica() {
  const res = await api(`/rest/v1/turnario_archivio?select=stato,aggiornato_al&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows.length ? rows[0] : null;
}

// salva (o aggiorna) l'archivio del turno
export async function salva(statoObj) {
  if (!session) return false;
  const res = await api(
    `/rest/v1/turnario_archivio?on_conflict=user_id`,
    {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({
        user_id: session.user_id,
        stato: statoObj,
        aggiornato_al: new Date().toISOString(),
      }),
    }
  );
  if (res.ok) { ultimoPush = new Date().toISOString(); status("sincronizzato"); return true; }
  status("errore", "Salvataggio online non riuscito (provero' ancora).");
  return false;
}

// programmazione del push dopo le modifiche (debounce)
export function programmaPush(runLocalmente, leggiStato) {
  if (!attivo()) return;
  status("in-attesa");
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (inCorsa) { programmaPush(runLocalmente, leggiStato); return; }
    inCorsa = true;
    try {
      if (!session) {
        const ok = await login();
        if (!ok) { inCorsa = false; return; }
      }
      await salva(leggiStato());
    } finally { inCorsa = false; }
  }, 2500);
}

// all'avvio: scarica e, se il cloud e' piu' recente, applicalo
export async function avvio(applicaStato, statoLocale) {
  if (!attivo()) { status("spenta"); return; }
  if (!credenzialiSalvate()) { status("senza-credenziali"); return; }
  status("in-attesa");
  if (!session && !(await login())) return;
  const rem = await scarica();
  if (!rem) {
    // nessun archivio online: pubble quello locale
    await salva(statoLocale());
    return;
  }
  const locale = statoLocale();
  const tLocale = (locale && locale.__aggiornatoAl) || "";
  const tRemoto = (rem.aggiornato_al + "").slice(0, 23);
  if (!tLocale || tRemoto > tLocale.slice(0, 23)) {
    applicaStato(rem.stato);
    status("sincronizzato", "Archivio aggiornato dal cloud.");
  } else {
    status("sincronizzato");
  }
}
