// Sincronizzazione automatica dell'archivio su Supabase.
// Nessuna libreria esterna: poggia direttamente sulle API REST.
// Se SUPABASE_URL/ANON_KEY non sono impostati in config.js, la
// sincronizzazione resta spenta e l'app funziona solo in locale.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const CRED_KEY = "turnario-ta-sync-cred";      // email+password salvate nel dispositivo
const SESSION_KEY = "turnario-ta-sync-token"; // token di sessione
const CODE_KEY = "turnario-ta-sync-code";     // codice del link privato (?k=...)

let codiceLink = null;

let session = null;    // { access_token, user_id, expires_at }
let cred = null;       // { email, password }
let timer = null;      // debounce del salvataggio
let ultimoPush = null; // iso dell'ultimo salvataggio riuscito
let inCorsa = false;
let statusCb = null;
let remoteChangeCb = null;  // avviso: il cloud e' cambiato mentre l'app e' aperta
let vistoCb = null;          // per salvare nel proprio archivio il timestamp del cloud visto
let ultimoCloudVisto = null; // aggiornato_al del cloud come l'abbiamo visto l'ultima volta
let applicaStatoCb = null;  // per applicare lo stato unito dopo il push
let statoLocaleCb = null;   // per leggere l'archivio locale dal polling
let busyCb = null;          // l'interfaccia dice se una finestra e' aperta (non toccare allora)
let pollTimer = null;

export const attivo = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

export function onStatus(cb) { statusCb = cb; }
export function onRemoteChange(cb) { remoteChangeCb = cb; }
export function onCloudVisto(cb) { vistoCb = cb; }
export function onBusy(cb) { busyCb = cb; }

// registra il momento del cloud che abbiamo appena visto (in sessione e nell'archivio locale)
function visto(v) {
  if (!v) return;
  ultimoCloudVisto = v;
  try { if (vistoCb) vistoCb(v); } catch {}
}

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
  localStorage.removeItem(CODE_KEY);
  codiceLink = null;
  status("spenta");
}

// modalita' LINK: legge il codice dall'indirizzo (?k=...) e lo memorizza nel dispositivo
export function leggiCodiceDaUrl() {
  if (typeof location === "undefined") return !!localStorage.getItem(CODE_KEY);
  const p = new URLSearchParams(location.search).get("k");
  if (p && p.trim().length >= 20) {
    localStorage.setItem(CODE_KEY, p.trim());
  }
  codiceLink = localStorage.getItem(CODE_KEY);
  return !!codiceLink;
}

export function codiceAttivo() { return !!codiceLink; }

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
  if (codiceLink) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/turnario_leggi`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_codice: codiceLink }),
    });
    if (!res.ok) { status("errore", "Lettura online non riuscita (codice o script SQL?)."); return null; }
    const j = await res.json();
    return j && j.stato ? j : null;
  }
  const res = await api(`/rest/v1/turnario_archivio?select=stato,aggiornato_al&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows && rows.length ? rows[0] : null;
}

// salva (o aggiorna) l'archivio del turno
export async function salva(statoObj) {
  if (codiceLink) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/turnario_scrivi`, {
      method: "POST",
      headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_codice: codiceLink, p_stato: statoObj }),
    });
    const j = await res.json().catch(() => null);
    if (res.ok && j === true) {
      ultimoPush = new Date().toISOString();
      const proprio = await scarica().catch(() => null);
      if (proprio && proprio.aggiornato_al) visto(proprio.aggiornato_al);
      status("sincronizzato");
      return true;
    }
    status("errore", "Salvataggio online non riuscito (codice non valido o script SQL da eseguire).");
    return false;
  }
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
  if (res.ok) {
    ultimoPush = new Date().toISOString();
    const proprio = await scarica().catch(() => null);
    if (proprio && proprio.aggiornato_al) visto(proprio.aggiornato_al);
    status("sincronizzato");
    return true;
  }
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
      if (!codiceLink && !session) {
        const ok = await login();
        if (!ok) { inCorsa = false; timer = null; return; }
      }
      // se il cloud e' cambiato mentre lavoravamo (altro dispositivo):
      // uniamo le modifiche invece di sovrascriverle
      try {
        const rem = await scarica();
        const tRem = (rem && rem.aggiornato_al + "" || "").slice(0, 23);
        const statoLoc = leggiStato();
        const tVisto = (statoLoc && statoLoc.__cloudVisto + "" || "").slice(0, 23);
        if (rem && rem.stato && Array.isArray(rem.stato.personale) && rem.stato.personale.length > 0
            && tVisto && tRem !== tVisto) {
          const unito = unisciStato(statoLoc, rem.stato);
          await salva(unito);
          if (applicaStatoCb) { try { applicaStatoCb(unito); } catch {} }
          status("sincronizzato", "Unite automaticamente le modifiche fatte da un altro dispositivo mentre eri collegato.");
          return;
        }
      } catch { /* lettura non riuscita: prosegue il push normale */ }
      await salva(leggiStato());
    } finally { inCorsa = false; timer = null; }   // timer azzerato: il polling live puo' continuare
  }, 2500);
}

// unione degli stati: causali e rinforzi SO si fondono (le modifiche locali
// vincono sulle stesse celle); anagrafica e impostazioni restano le locali.
function unisciStato(locale, rem) {
  const unito = JSON.parse(JSON.stringify(locale));
  const anni = new Set([...Object.keys(locale.causali || {}), ...Object.keys(rem.causali || {})]);
  for (const anno of anni) {
    const mappa = {};
    for (const c of (rem.causali?.[anno] || [])) mappa[c.p + "|" + c.d] = c;
    for (const c of (locale.causali?.[anno] || [])) mappa[c.p + "|" + c.d] = c;
    unito.causali[anno] = Object.values(mappa);
  }
  const ext = {};
  for (const r of (rem.soRinforzi || [])) ext[r.id] = r;
  for (const r of (locale.soRinforzi || [])) ext[r.id] = r;
  unito.soRinforzi = Object.values(ext);
  return unito;
}

// controllo periodico: il cloud e' cambiato mentre l'app e' aperta?
function avviaPolling() {
  if (pollTimer) return;
  const intervallo = Number((typeof globalThis !== "undefined" && globalThis.TURNARIO_POLL_MS)) || 45000;
  pollTimer = setInterval(controlloLive, intervallo);
}

// sincronizzazione "viva": finche' l'app e' aperta, scarica le novita' del cloud
// senza bisogno di ricaricare la pagina. Se e' libera di applicarle (nessuna
// finestra aperta, nessuna modifica non ancora spedita) lo fa subito; se il
// cloud e' REGREDITO (un PC vecchio ha pushato) lo cura unendo e rispingendo.
async function controlloLive() {
  if (!attivo() || inCorsa || timer) return;   // niente controlli se ci sono salvataggi in coda
  if (typeof document !== "undefined" && document.hidden) return;
  if (!codiceLink) {
    if (!(await credenzialiSalvate())) return;
  }
  try {
    const rem = await scarica();
    if (!rem || !rem.stato || !Array.isArray(rem.stato.personale) || rem.stato.personale.length === 0) return;
    const tRem = (rem.aggiornato_al + "").slice(0, 23);
    const locale = statoLocaleCb ? statoLocaleCb() : null;
    if (!locale) return;
    const tVisto = ((locale && locale.__cloudVisto) + "" || "").slice(0, 23);
    const tMut = ((locale && locale.__aggiornatoAl) + "" || "").slice(0, 23);
    if (tRem === tVisto) return;                 // nessuna novita'
    if (!tVisto) { visto(rem.aggiornato_al); return; }  // avvio non ancora completato
    const occupato = busyCb ? busyCb() : false;
    if (tMut > tVisto) {
      // modifiche locali non ancora arrivate sul cloud (invio fallito o
      // avvenuto offline): appena possibile si rispediscono, unendosi a
      // eventuali novita' del cloud. Con la finestra aperta si aspetta.
      if (!occupato) { programmaPush(null, () => statoLocaleCb()); return; }
      if (remoteChangeCb) remoteChangeCb();
      return;
    }
    if (occupato) {
      if (remoteChangeCb) remoteChangeCb();
      return;
    }
    if (tRem > tVisto) {
      // il cloud e' piu' fresco: si applica subito
      if (applicaStatoCb) { try { applicaStatoCb(rem.stato); } catch {} }
      visto(rem.aggiornato_al);
      status("sincronizzato", "Aggiornato dal cloud mentre l'app era aperta.");
      return;
    }
    // cloud REGREDITO: qualcuno ha pushato dati vecchi sopra quello buono.
    // Si uniscono le causali/rinforzi e si rispinge lo stato unito.
    const unito = unisciStato(locale, rem.stato);
    await salva(unito);
    if (applicaStatoCb) { try { applicaStatoCb(unito); } catch {} }
    status("sincronizzato", "Il cloud conteneva dati piu' vecchi: uniti e corretti.");
  } catch { /* offline: si riprovera' al prossimo giro */ }
}

// all'avvio: scarica e, se il cloud e' piu' recente, applicalo
export async function avvio(applicaStato, statoLocale, seedVergine) {
  if (!attivo()) { status("spenta"); return; }
  const vergine = typeof seedVergine === "function" ? seedVergine() : seedVergine;
  if (!codiceLink) leggiCodiceDaUrl();
  applicaStatoCb = applicaStato;
  statoLocaleCb = statoLocale;
  avviaPolling();
  if (codiceLink) {
    status("in-attesa");
    const rem = await scarica();
    // archivio locale vergine (seed non ancora modificato): se il cloud ha
    // dati veri vince SEMPRE il cloud; un seed non puo' sovrascrivere il lavoro
    if (rem && rem.stato && Array.isArray(rem.stato.personale) && rem.stato.personale.length > 0 && vergine) {
      applicaStato(rem.stato);
      visto(rem.aggiornato_al);
      status("sincronizzato", "Archivio recuperato dal cloud.");
      return;
    }
    if (!rem || !rem.stato || !rem.stato.personale) { await salva(statoLocale()); return; }
    return sincronizza(rem, applicaStato, statoLocale);
  }
  if (!credenzialiSalvate()) { status("senza-credenziali"); return; }
  status("in-attesa");
  if (!session && !(await login())) return;
  const rem = await scarica();
  if (!rem || !rem.stato || !rem.stato.personale) {
    // nessun archivio online (o riga ancora vuota): pubblica quello locale
    await salva(statoLocale());
    return;
  }
  return sincronizza(rem, applicaStato, statoLocale);
}

// regole di sincronizzazione all'avvio:
// - __cloudVisto = momento del cloud che questo dispositivo conosce
// - __aggiornatoAl = ultime vere MODIFICHE locali
// 1) modifiche locali non ancora spedite -> si pushano (unendosi al cloud)
// 2) cloud piu' recente di quello che conoscevamo -> si scarica
// 3) cloud REGREDITO (qualcuno ha pushato dati vecchi) -> si uniscono causali/rinforzi e si rispinge
// 4) prima volta con questo schema (__cloudVisto assente) -> il cloud ha la meglio,
//    l'archivio precedente resta nello storico delle copie di sicurezza
async function sincronizza(rem, applicaStato, statoLocale) {
  const locale = statoLocale();
  const tVisto = ((locale && locale.__cloudVisto) + "" || "").slice(0, 23);
  const tMut = ((locale && locale.__aggiornatoAl) + "" || "").slice(0, 23);
  const tRem = (rem.aggiornato_al + "").slice(0, 23);
  if (!tVisto) {
    applicaStato(rem.stato);
    visto(rem.aggiornato_al);
    status("sincronizzato", "Archivio aggiornato dal cloud.");
    return;
  }
  if (tMut > tVisto) {
    // modifiche locali non ancora spedite
    if (tRem !== tVisto) {
      const unito = unisciStato(statoLocale(), rem.stato);
      await salva(unito);
      if (applicaStatoCb) { try { applicaStatoCb(unito); } catch {} }
      status("sincronizzato", "Spedite le modifiche fatte senza connessione, unite a quelle del cloud.");
    } else {
      await salva(statoLocale());
    }
    return;
  }
  if (tRem !== tVisto) {
    if (tRem > tVisto) {
      applicaStato(rem.stato);
      visto(rem.aggiornato_al);
      status("sincronizzato", "Archivio aggiornato dal cloud.");
    } else {
      // il cloud contiene dati PIU' VECCHI di quelli che questo dispositivo ha
      // gia' visto (un PC con un archivio vecchio ha pushato): si fondono le
      // causali/rinforzi del cloud e si rispinge lo stato unito
      const unito = unisciStato(statoLocale(), rem.stato);
      await salva(unito);
      if (applicaStatoCb) { try { applicaStatoCb(unito); } catch {} }
      status("sincronizzato", "Il cloud conteneva dati piu' vecchi: uniti e corretti.");
    }
    return;
  }
  status("sincronizzato");
}
