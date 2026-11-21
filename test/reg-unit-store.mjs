// Unit test diretti su store + engine: RP (base/storico/eccezione), causali,
// attivita', export/import JSON. Serve il bundle /tmp/store-bundle.mjs.
const store = await import(process.env.STORE_BUNDLE || '/tmp/store-bundle.mjs');

const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

const persona = (id, rp) => ({ id, cognome: 'X' + id, nome: 'Y', grado: 'CS', rp, capoTurno: 'No', dal: null, al: null, autista: '3°', spec: {} });

mem['turnario-ta-v1'] = JSON.stringify({
  personale: [persona('p1', 'A1'), persona('p2', 'A1'), persona('p3', 'A2')],
  causali: { 2027: [{ p: 'p2', d: '2027-05-04', c: 'SO' }, { p: 'p3', d: '2027-05-04', c: 'R' }] },
  soRinforzi: [{ id: 'e1', cognome: 'EST', nome: 'Z', rp: 'A4' }],
  rpStorico: [], exceptions: [], settings: { anno: 2027 }, __appVersion: '1.4.0',
});

const G = () => store.getState();
const rpOf = (pid, iso) => {
  const st = G();
  const turn = { date: iso, slot: 'A1', phase: 'D' };
  return st.personale.find(p => p.id === pid).rp;
};
function rpEffettivoDi(pid, iso) {
  // esposto solo nel bundle engine: lo ricostruiamo dal value della cella con l'engine
  return rpEff(pid, iso);
}
let rpEff;
try { rpEff = (await import(process.env.ENGINE_BUNDLE || '/tmp/engine-bundle.mjs')).rpEffettivo; }
catch (e) { rpEff = () => null; }

// (1) RP base
ok(rpEff(G(), 'p1', '2027-05-02') === 'A1', "(1) RP base A1 per p1");
ok(rpEff(G(), 'p3', '2027-05-02') === 'A2', '(1b) RP base A2 per p3');

// (2) cambio RP definitivo con decorrenza: prima della data il vecchio, dal giorno il nuovo
store.cambioRpDefinitivo('p1', 'A5', '2027-06-10');
ok(rpEff(G(), 'p1', '2027-06-09') === 'A1', "(2) prima della decorrenza resta A1");
ok(rpEff(G(), 'p1', '2027-06-10') === 'A5', "(2b) dalla decorrenza vale A5");
ok(rpEff(G(), 'p1', '2027-08-01') === 'A5', "(2c) il cambio e' definitivo nel tempo");

// (3) eccezione mensile: vale solo per quel mese
store.setEccezioneMese('p1', '2027-07', 'A7');
ok(rpEff(G(), 'p1', '2027-07-15') === 'A7', "(3) eccezione RP del mese luglio: A7");
ok(rpEff(G(), 'p1', '2027-08-01') === 'A5', "(3b) agosto torna al RP stabilito (A5)");

// (4) causali: inserimento/cancellazione
store.setCausale(2027, 'p1', '2027-05-05', 'L');
ok(G().causali[2027].some(c => c.p === 'p1' && c.d === '2027-05-05' && c.c === 'L'), '(4) causale L scritta');
store.setCausale(2027, 'p1', '2027-05-05', '');
ok(!G().causali[2027].some(c => c.p === 'p1' && c.d === '2027-05-05'), '(4b) causale cancellata con codice vuoto');

// (5) export/import: il contenuto RESA identico (i timbri tecnici come
// __aggiornatoAl possono cambiare perche' importare e' di per se' un salvataggio)
const exportato = JSON.parse(store.exportJson());
store.importJson(JSON.stringify(exportato));
const reimportato = JSON.parse(store.exportJson());
const stessoContenuto = (a, b) => {
  const chiavi = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of chiavi) {
    if (k.startsWith("__")) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
};
ok(stessoContenuto(exportato, reimportato), '(5) export/import JSON round trip: contenuto identico');
let haLanciato = false;
try { store.importJson('{"blah": 1'); } catch { haLanciato = true; }
ok(haLanciato, "(5b) import di un file rotto lancia un errore, niente danni");

// (6) valor cella: presente/presenteSede con SO e R
const eng = await import(process.env.ENGINE_BUNDLE || '/tmp/engine-bundle.mjs');
const st = G();
const cmap = store.mappaCausali(2027);
const turno25 = { date: '2027-05-04', slot: 'A1', phase: 'D' };  // p2 ha SO, p3 ha R
ok(eng.presente(st, st.personale.find(p=>p.id==='p2'), turno25, cmap) === true, '(6) SO conta come presenza');
ok(eng.presenteSede(st, st.personale.find(p=>p.id==='p3'), turno25, cmap) === false, "(6b) R e' rinforzo: non in sede");

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
