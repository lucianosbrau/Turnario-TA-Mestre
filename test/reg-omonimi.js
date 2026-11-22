// Doppi e omonimi: se reinserisco una persona USCITA dal turno, offro di
// recuperarla; se il doppio e' ATTIVO, chiedo un nome diverso; se rifiuto la
// combinazione, cambia solo il rombo del nome e l'inserimento NON avviene.
const fs = require('fs');
const path = require('path');
const REPO = process.env.TURNARIO_REPO || require("path").resolve(__dirname, "..");
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(REPO + "/index.html", 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
let failures = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures.push(m); };

const persona = (id, c, n, al) => ({ id, cognome: c, nome: n, grado: 'CS', rp: 'A1', capoTurno: 'No', dal: null, al: al || null, autista: '3°', spec: {} });
window.localStorage.setItem('turnario-ta-v1', JSON.stringify({
  personale: [
    persona('uscito1', 'ROSSI', 'MARIO', '2020-01-10'),   // uscito dal turno (storico conservato)
    persona('attivo1', 'BIANCHI', 'LUCA'),
  ],
  causali: { 2027: [{ p: 'uscito1', d: '2027-01-05', c: 'L' }] },
  soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 },
}));

let conferme = [];
let rispostePrompt = [];
window.alert = () => {};
window.confirm = (t) => { conferme.push(t); return conferme.risposta; };
window.prompt = (t, d) => { rispostePrompt.push(d || ''); return rispostePrompt.valore; };

window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;

(async () => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  await new Promise(r => setTimeout(r, 200));

  const persone = () => JSON.parse(window.localStorage.getItem('turnario-ta-v1')).personale;
  const compilaForm = (cognome, nome) => {
    doc.querySelector("[name='cognome']").value = cognome;
    doc.querySelector("[name='nome']").value = nome;
    doc.querySelector("#fp-salva").click();
  };

  // 1) reinserisco l'USCITO e accetto il RECUPERO: nessun nuovo record, torna in servizio
  doc.querySelector("#btn-nuova-persona").click();
  await new Promise(r => setTimeout(r, 100));
  conferme.risposta = true;
  compilaForm('ROSSI', 'MARIO');
  let st = persone();
  ok(st.length === 2, "(1) recupero omonimo uscito: nessun doppione creato (2 persone)");
  const rossi = st.find(p => p.cognome === 'ROSSI');
  ok(rossi && rossi.al === null, "(1b) ROSSI MARIO recuperata: di nuovo in servizio");
  ok(rossi && (st.filter(p => p.cognome === 'ROSSI' && p.nome === 'MARIO').length === 1), "(1c) una sola ROSSI MARIO in archivio");
  ok((JSON.parse(window.localStorage.getItem('turnario-ta-v1')).causali[2027] || []).some(c => c.p === 'uscito1'), "(1d) lo storico causali del recuperato resta intatto");

  // 2) reinserisco un ATTIVO: nonCanBeConverted recuperato, si chiede nome differente
  doc.querySelector("#btn-nuova-persona").click();
  await new Promise(r => setTimeout(r, 100));
  conferme.risposta = true;
  rispostePrompt.valore = 'VERDI GIANNI';
  compilaForm('BIANCHI', 'LUCA');
  st = persone();
  ok(st.some(p => p.cognome === 'VERDI' && p.nome === 'GIANNI'), '(2) doppione attivo: viene creato SOLO il nome diverso (VERDI GIANNI)');
  ok(st.filter(p => p.cognome === 'BIANCHI' && p.nome === 'LUCA').length === 1, "(2b) il BIANCHI LUCA originale non e' duplicato");
  ok(st.length === 3, "(2c) archivio a 3 persone esatte");

  // 3) rifiuto il recupero dell'uscito: si chiede nome differente, annullando non si crea nulla
  doc.querySelector("#btn-nuova-persona").click();
  await new Promise(r => setTimeout(r, 100));
  const nPrima = persone().length;
  // rimetto ROSSI uscito per la prova (come se non fosse mai stato recuperato)
  const stUscita = JSON.parse(window.localStorage.getItem('turnario-ta-v1'));
  stUscita.personale.find(p => p.cognome === 'ROSSI').al = '2020-01-10';
  window.localStorage.setItem('turnario-ta-v1', JSON.stringify(stUscita));
  conferme.risposta = false; rispostePrompt.valore = null;
  compilaForm('ROSSI', 'MARIO');
  await new Promise(r => setTimeout(r, 100));
  ok(persone().length === nPrima, "(3) rifiutato il recupero e annullata la rinomina: nessun record creato");

  console.log(failures.length ? "\nFAILED: " + failures.length : "\nALL OK");
  process.exit(failures.length ? 1 : 0);
})();
