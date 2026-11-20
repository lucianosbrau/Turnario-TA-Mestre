// Archivio dati: tutto in locale (localStorage del browser) + backup export/import.
import { SEED } from "./seed-data.js";
import { ANNO_DEFAULT } from "./config.js";

const KEY = "turnario-ta-v1";

let state = null;

export function getState() {
  if (!state) load();
  return state;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw);
      if (!state.settings) { state.settings = { anno: ANNO_DEFAULT }; save(); }
    } else {
      state = seedInit();
      save();
    }
  } catch {
    state = seedInit();
    save();
  }
}

function seedInit() {
  const s = JSON.parse(JSON.stringify(SEED));
  s.exceptions = s.exceptions || [];
  s.settings = s.settings || { anno: ANNO_DEFAULT };
  return s;
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

// icrea nuovo id per una persona
export function newId() {
  return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function addPerson(p) {
  p.id = newId();
  state.personale.push(p);
  save();
  return p;
}

export function updatePerson(p) {
  const i = state.personale.findIndex(x => x.id === p.id);
  if (i >= 0) state.personale[i] = p;
  save();
}

export function deletePerson(id) {
  state.personale = state.personale.filter(x => x.id !== id);
  state.rpStorico = (state.rpStorico || []).filter(x => x.p !== id);
  state.exceptions = (state.exceptions || []).filter(x => x.p !== id);
  for (const anno of Object.keys(state.causali || {})) {
    state.causali[anno] = (state.causali[anno] || []).filter(x => x.p !== id);
  }
  save();
}

// causali di un anno -> mappa { "personaId|data": codice }
export function mappaCausali(anno) {
  const m = {};
  for (const c of (state.causali?.[anno] || [])) m[c.p + "|" + c.d] = c.c;
  return m;
}

export function setCausale(anno, personId, date, codice) {
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
  const p = state.personale.find(x => x.id === personId);
  if (!p) return;
  // chiudo gli intervalli aperti che contengono la nuova data
  for (const s of state.rpStorico || []) {
    if (s.p === personId && (!s.al || s.al >= dalIso) && (!s.dal || s.dal <= dalIso)) {
      s.al = isoSottrai(dalIso);
    }
  }
  state.rpStorico.push({ p: personId, rp: nuovoRp, dal: dalIso, al: null });
  p.rp = nuovoRp;
  save();
}

// cambio RP solo per un mese (eccezione)
export function setEccezioneMese(personId, mese, rp) {
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

export function resetToSeed() {
  state = seedInit();
  save();
}
