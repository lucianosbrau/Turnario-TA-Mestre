// Archivio dati: tutto in locale (localStorage del browser) + backup export/import.
import { SEED } from "./seed-data.js";
import { ANNO_DEFAULT, APP_VERSION } from "./config.js";
import * as sync from "./sync.js";

const KEY = "turnario-ta-v1";

let state = null;

// true se lo stato e' il seed appena caricato e l'utente non ha ancora
// modificato nulla in questa sessione: un archivio vergine non deve mai
// sovrascrivere una copia cloud con dati veri
let seedFresh = false;
export function isSeedFresh() { return seedFresh; }


export function getState() {
  if (!state) load();
  return state;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // protezione: al primo avvio di una nuova versione dell'app,
      // salva una copia intatta dell'archivio precedente prima di usarlo
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      if (parsed && parsed.__appVersion !== APP_VERSION) {
        archiviaSnapshot(raw);
      }
      if (!parsed) { state = seedInit(); seedFresh = true; } else { state = parsed; }
      migrAutista();
      state.__appVersion = APP_VERSION;
      if (!state.settings) { state.settings = { anno: ANNO_DEFAULT }; }
      state.soRinforzi = state.soRinforzi || [];
      // NON si usa save(): l'apertura dell'app non e' una modifica. Salvare qui
      // ricomponeva l'archivio locale con la data di "adesso" e lo SPEDIVA al
      // cloud: un PC con dati vecchi sovrascriveva il lavoro al solo aprirsi.
      saveLocal();
    } else {
      state = seedInit(); seedFresh = true; migrAutista();
      state.__appVersion = APP_VERSION;
      saveLocal();
    }
  } catch {
    seedFresh = true;
    state = seedInit();
    migrAutista();
    state.__appVersion = APP_VERSION;
    save();
  }
}

// migrazione: i vecchi valori "1".."4" di autista diventano "1°".."4°"
function migrAutista() {
  for (const p of state.personale || []) {
    if (p.autista === "1" || p.autista === "2" || p.autista === "3" || p.autista === "4") {
      p.autista += "°";
    }
  }
}

function seedInit() {
  const s = JSON.parse(JSON.stringify(SEED));
  s.exceptions = s.exceptions || [];
  s.settings = s.settings || { anno: ANNO_DEFAULT };
  s.soRinforzi = s.soRinforzi || [];
  return s;
}

// personale di rinforzo esterno: esiste SOLO nella pagina Sala Operativa
export function addSoRinforzo(dati) {
  seedFresh = false;
  if (!state.soRinforzi) state.soRinforzi = [];
  const p = {
    id: "soext-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
    cognome: dati.cognome, nome: dati.nome, rp: dati.rp || "",
    esterno: true,
  };
  state.soRinforzi.push(p);
  save();
  return p;
}

export function deleteSoRinforzo(id) {
  seedFresh = false;
  state.soRinforzi = (state.soRinforzi || []).filter(x => x.id !== id);
  for (const anno of Object.keys(state.causali || {})) {
    if (state.causali[anno]) state.causali[anno] = state.causali[anno].filter(x => x.p !== id);
  }
  save();
}

export function save() {
  state.__aggiornatoAl = new Date().toISOString();
  localStorage.setItem(KEY, JSON.stringify(state));
  if (!seedFresh) sync.programmaPush(saveLocal, () => JSON.parse(localStorage.getItem(KEY)));
}

// salvataggio senza far ripartire la sincronizzazione (per applicare lo stato dal cloud)
export function saveLocal() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// il sistema di sincronizzazione comunica qui il timestamp del cloud appena
// visto; distinguerlo da __aggiornatoAl (ultime MODIFICHE locali) permette di
// capire se ci sono modifiche non ancora spedite o se il cloud e' piu' fresco.
export function segnaCloudVisto(v) {
  if (!v) return;
  state.__cloudVisto = v;
  saveLocal();
}

// applica lo stato arrivato dal cloud (gia' validato come oggetto JSON)
export function applicaStatoCloud(stato) {
  seedFresh = false;
  if (!stato || !Array.isArray(stato.personale)) throw new Error("Archivio cloud non valido");
  const raw = localStorage.getItem(KEY);
  if (raw) archiviaSnapshot(raw);   // al sicuro prima di toccare
  state = stato;
  if (!state.settings) state.settings = { anno: ANNO_DEFAULT };
  state.__appVersion = APP_VERSION;
  saveLocal();
}

// icrea nuovo id per una persona
export function newId() {
  return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function addPerson(p) {
  seedFresh = false;
  p.id = newId();
  state.personale.push(p);
  save();
  return p;
}

export function updatePerson(p) {
  seedFresh = false;
  const i = state.personale.findIndex(x => x.id === p.id);
  if (i >= 0) state.personale[i] = p;
  save();
}

export function deletePerson(id) {
  seedFresh = false;
  const p = state.personale.find(x => x.id === id);
  if (!p || p.eliminato) return;
  p.eliminato = true;   // cancellazione reversibile: sparisce dalla compilazione, i dati restano
  save();
}

export function recuperaPersona(id) {
  seedFresh = false;
  const p = state.personale.find(x => x.id === id);
  if (!p || !p.eliminato) return;
  delete p.eliminato;
  if (p.al && p.al < todayIsoSafe()) p.al = null;
  save();
}

function todayIsoSafe() {
  return new Date().toISOString().slice(0, 10);
}

// causali di un anno -> mappa { "personaId|data": codice }
export function mappaCausali(anno) {
  const m = {};
  for (const c of (state.causali?.[anno] || [])) m[c.p + "|" + c.d] = c.c;
  return m;
}

export function setCausale(anno, personId, date, codice) {
  seedFresh = false;
  if (!state.causali) state.causali = {};
  if (!state.causali[anno]) state.causali[anno] = [];
  const arr = state.causali[anno];
  const i = arr.findIndex(x => x.p === personId && x.d === date);
  if (!codice) {
    if (i >= 0) arr.splice(i, 1);
  } else if (i >= 0) arr[i].c = codice;
  else arr.push({ p: personId, d: date, c: codice });
  save();
}

// cambio RP definitivo con decorrenza -> chiude il precedente e ne apre uno nuovo
export function cambioRpDefinitivo(personId, nuovoRp, dalIso) {
  seedFresh = false;
  const p = state.personale.find(x => x.id === personId);
  if (!p) return;
  // chiudo gli intervalli aperti che contengono la nuova data
  for (const s of state.rpStorico || []) {
    if (s.p === personId && (!s.al || s.al >= dalIso) && (!s.dal || s.dal <= dalIso)) {
      s.al = isoSottrai(dalIso);
    }
  }
  // il RP base (p.rp) e' quello ATTUALE: per rispettare la decorrenza si
  // archivia anche il rp VECCHIO valido fino al giorno prima, cosi' i mesi
  // precedenti continuano a seguire il vecchio salto turno
  if (p.rp && p.rp !== nuovoRp) {
    state.rpStorico.push({ p: personId, rp: p.rp, dal: null, al: isoSottrai(dalIso) });
  }
  state.rpStorico.push({ p: personId, rp: nuovoRp, dal: dalIso, al: null });
  p.rp = nuovoRp;
  save();
}

// cambio RP solo per un mese (eccezione)
export function setEccezioneMese(personId, mese, rp) {
  seedFresh = false;
  state.exceptions = state.exceptions || [];
  const i = state.exceptions.findIndex(e => e.p === personId && e.mese === mese);
  if (!rp) { if (i >= 0) state.exceptions.splice(i, 1); }
  else if (i >= 0) state.exceptions[i].rp = rp;
  else state.exceptions.push({ p: personId, mese, rp });
  save();
}

function isoSottrai(iso) {
  const dt = new Date(Date.parse(iso + "T00:00:00Z") - 86400000);
  return dt.toISOString().slice(0, 10);
}

export function setAnno(anno) {
  state.settings.anno = anno;
  save();
}

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

export function importJson(testo) {
  const s = JSON.parse(testo);
  if (!s || !Array.isArray(s.personale)) throw new Error("File non valido");
  if (!s.settings) s.settings = { anno: ANNO_DEFAULT };
  if (!s.exceptions) s.exceptions = [];
  if (!s.rpStorico) s.rpStorico = [];
  state = s;
  save();
}

// storico delle copie di sicurezza: ogni volta che l'archivio sta per essere
// sovrascritto (nuova versione dell'app o stato dal cloud) la copia precedente
// viene ARCHIVIATA con data, non cancellata, finche' c'e' spazio.
const SNAP_KEY = KEY + "-storico";
const SNAP_MAX_N = 10;
const SNAP_MAX_BYTES = 2000000;

function leggiStorico() {
  try { return JSON.parse(localStorage.getItem(SNAP_KEY) || "[]") || []; }
  catch { return []; }
}

function archiviaSnapshot(raw) {
  if (!raw) return;
  try {
    const arch = leggiStorico();
    if (arch.length && arch[arch.length - 1].raw === raw) return;
    arch.push({ t: new Date().toISOString(), raw });
    let s = JSON.stringify(arch);
    while (arch.length > 1 && (arch.length > SNAP_MAX_N || s.length > SNAP_MAX_BYTES)) {
      arch.shift();
      s = JSON.stringify(arch);
    }
    localStorage.setItem(SNAP_KEY, s);
  } catch { /* storage pieno: mantengo solo l'ultima */
    try { localStorage.setItem(KEY + "-snapshot", raw); } catch {}
  }
}

// elenco delle copie archiviate (dalla piu' vecchia alla piu' recente)
export function listaSnapshots() {
  return leggiStorico().map(s => {
    let nPers = 0;
    try { nPers = (JSON.parse(s.raw).personale || []).length; } catch {}
    return { t: s.t, nPers };
  });
}

// ripristina una copia specifica dello storico (indice come in listaSnapshots)
export function ripristinaDaSnapshot(idx) {
  const arch = leggiStorico();
  if (idx < 0 || idx >= arch.length) return false;
  state = JSON.parse(arch[idx].raw);
  state.__appVersion = APP_VERSION;
  save();
  return true;
}

// ripristina l'ultima copia di sicurezza (snapshot fatto al cambio versione)
export function ripristinaSnapshot() {
  const arch = leggiStorico();
  if (!arch.length) {
    const raw = localStorage.getItem(KEY + "-snapshot");
    if (!raw) return false;
    state = JSON.parse(raw);
    state.__appVersion = APP_VERSION;
    save();
    return true;
  }
  return ripristinaDaSnapshot(arch.length - 1);
}

export function resetToSeed() {
  state = seedInit();
  save();
}
