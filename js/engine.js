// Motore di calcolo: calendario perenne, salto turno, RP effettivo, conteggi.
import { ANCHOR_DATE, ANCHOR_SLOT } from "./config.js";

export function isoToIt(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayIso() {
  const dt = new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

function isoAdd(iso, days) {
  const dt = new Date(Date.parse(iso + "T00:00:00Z") + days * 86400000);
  return dt.toISOString().slice(0, 10);
}

// slot (A1..A8) della coppia k-esima rispetto all'ancora (k anche negativo)
function slotForPair(k) {
  const s = ((ANCHOR_SLOT - 1 + k) % 8 + 8) % 8 + 1;
  return "A" + s;
}

// Tutti i turni di un anno, in ordine di data.
// Ogni giorno d: delta = d - ancora; delta%4==0 -> D, delta%4==1 -> N.
export function turniAnno(anno) {
  const out = [];
  let d = `${anno}-01-01`;
  const end = `${anno}-12-31`;
  while (d <= end) {
    const delta = daysBetween(ANCHOR_DATE, d);
    const mod = ((delta % 4) + 4) % 4;
    if (mod === 0) out.push({ date: d, phase: "D", slot: slotForPair(Math.floor(delta / 4)), month: d.slice(0, 7) });
    else if (mod === 1) out.push({ date: d, phase: "N", slot: slotForPair(Math.floor((delta - 1) / 4)), month: d.slice(0, 7) });
    d = isoAdd(d, 1);
  }
  return out;
}

// Persona attiva in una data? (dal/al vuoti = sempre)
export function attivoIn(p, iso) {
  if (p.eliminato) return false;
  if (p.dal && p.dal > iso) return false;
  if (p.al && p.al < iso) return false;
  return true;
}

// RP efficace di una persona in una data:
// 1) eccezione mensile (pagina Presenze), 2) storico RP con date, 3) RP base.
export function rpEffettivo(state, personId, iso) {
  const ex = (state.exceptions || []).find(e => e.p === personId && e.mese === iso.slice(0, 7));
  if (ex) return ex.rp;
  let best = null;
  for (const s of (state.rpStorico || [])) {
    if (s.p !== personId) continue;
    if (s.dal && s.dal > iso) continue;
    if (s.al && s.al < iso) continue;
    if (!best || (s.dal || "") > (best.dal || "")) best = s;
  }
  if (best) return best.rp;
  const p = (state.personale || []).find(x => x.id === personId);
  return p ? p.rp : "";
}

// chiave cella: "personaId|data"
export function cellKey(pid, date) { return pid + "|" + date; }

// valore mostrato in una cella del lenzuolo
export function valoreCella(state, person, turn, causaliMap) {
  const c = causaliMap[cellKey(person.id, turn.date)];
  if (c) return c;
  if (attivoIn(person, turn.date) && rpEffettivo(state, person.id, turn.date) === turn.slot) return "RP";
  return "";
}

// e' una presenza di turno? causali SO/R contano, RP e' riposo (non conteggiato),
// la cella vuota e' presenza solo se non e' il giorno di RP della persona
export function presente(state, person, turn, causaliMap) {
  const c = causaliMap[cellKey(person.id, turn.date)] || "";
  if (c === "SO" || c === "R") return true;
  if (c !== "") return false;
  return rpEffettivo(state, person.id, turn.date) !== turn.slot;
}

// presenza in SEDE: come sopra ma chi e' in rinforzo (R) lavora altrove
export function presenteSede(state, person, turn, causaliMap) {
  const c = causaliMap[cellKey(person.id, turn.date)] || "";
  if (c === "SO") return true;
  if (c !== "") return false;
  return rpEffettivo(state, person.id, turn.date) !== turn.slot;
}

// effettivi di sede per un turno: persone attive e presenti
export function effettiviTurno(state, persone, turn, causaliMap) {
  let n = 0;
  for (const p of persone) {
    if (!attivoIn(p, turn.date)) continue;
    if (presente(state, p, turn, causaliMap)) n++;
  }
  return n;
}
