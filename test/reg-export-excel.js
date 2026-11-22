// Esporta Excel (SpreadsheetML) e backup JSON: struttura del file generato.
const fs = require('fs');
const path = require('path');
const REPO = process.env.TURNARIO_REPO || require("path").resolve(__dirname, "..");
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(REPO + "/index.html", 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;
let failures = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures.push(m); };

// cattura il download: URL.createObjectURL e i click dei link diano intercettati
let blobCatturato = null;
window.URL.createObjectURL = (b) => { blobCatturato = b; return 'blob:finto'; };
window.HTMLAnchorElement.prototype.click = function () { /* niente navigazione */ };

const persona = (id, c, so) => ({ id, cognome: c, nome: 'X', grado: 'CS', rp: 'A1', capoTurno: 'No', dal: null, al: null, autista: '3°', spec: so ? { SO115: 'Si' } : {} });
window.localStorage.setItem('turnario-ta-v1', JSON.stringify({
  personale: [persona('p1', 'ROSSI', true), persona('p2', 'VERDI', true)],
  causali: { 2027: [{ p: 'p1', d: '2027-06-01', c: 'L' }] },
  soRinforzi: [{ id: 'e1', cognome: 'ESTERNO', nome: 'Z', rp: 'A4', esterno: true }],
  rpStorico: [], exceptions: [], settings: { anno: 2027 },
}));
window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;

(async () => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  await new Promise(r => setTimeout(r, 200));

  // 1) apre la finestra di esportazione
  doc.querySelector("#btn-export").click();
  ok(!!doc.querySelector("#exp-presenze"), "(1) finestra export con checkbox Foglio Presenze");
  ok(!!doc.querySelector("#exp-so"), "(1b) checkbox Foglio Sala Operativa");
  ok(doc.querySelector("#exp-presenze").checked && doc.querySelector("#exp-so").checked, "(1c) entrambi i fogli spuntati di default");

  // 2) esporta ENTRAMBI i fogli e verifica il contenuto XML
  doc.querySelector("#exp-ok").click();
  await new Promise(r => setTimeout(r, 200));
  ok(!!blobCatturato, "(2) file generato (Blob catturato)");
  const testo = await blobCatturato.text();
  ok(testo.startsWith('<?xml') && testo.includes('<Workbook'), "(2b) intestazione SpreadsheetML valida (apribile da Excel)");
  ok(testo.includes('Presenze'), "(2c) foglio Presenze presente");
  ok(testo.includes('Sala Operativa'), "(2d) foglio Sala Operativa presente");
  ok(testo.includes('ROSSI') && testo.includes('VERDI'), "(2e) i nominativi ci sono");
  ok(/L<\/Cell>/.test(testo) || /&quot;L&quot;|>L</.test(testo), "(2f) la causale L del 01/06 e nel file");
  ok(testo.includes('PERSONALE IN TURNO'), "(2g) le righe di conteggio sono esportate");
  ok(testo.includes('ESTERNO'), "(2h) i rinforzi esterni SO sono nel foglio Sala Operativa");

  // 3) solo foglio presenze
  blobCatturato = null;
  doc.querySelector("#btn-export").click();
  doc.querySelector("#exp-so").checked = false;
  doc.querySelector("#exp-ok").click();
  await new Promise(r => setTimeout(r, 200));
  const soloPres = await blobCatturato.text();
  ok(soloPres.includes('ROSSI') && !soloPres.includes('ESTERNO'), "(3) deselezionando Sala Operativa gli esterni NON sono esportati");

  // 4) backup JSON
  blobCatturato = null;
  doc.querySelector("#btn-export").click();
  doc.querySelector("#exp-json").click();
  await new Promise(r => setTimeout(r, 200));
  const json = JSON.parse(await blobCatturato.text());
  ok(Array.isArray(json.personale) && json.personale.length === 2, "(4) backup JSON valido con 2 persone");
  ok(JSON.stringify(json.causali[2027][0]).includes('L'), "(4b) le causali sono nel backup");

  console.log(failures.length ? "\nFAILED: " + failures.length : "\nALL OK");
  process.exit(failures.length ? 1 : 0);
})();
