const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('/workspace/github__lucianosbrau__Turnario-TA-Mestre/index.html', 'utf8');
const dom = new JSDOM(html, { url: "https://lucianosbrau.github.io/Turnario-TA-Mestre/?k=CODICETESTCODICETEST1234", runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = (m) => console.log("ALERT:", m);
window.confirm = () => true; window.prompt = () => null;
window.addEventListener('error', e => console.log("JS-ERR:", e.message));
let failures = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures.push(m); };

let scritture = [];
window.fetch = (url, opts) => {
  if (String(url).includes("turnario_scrivi")) {
    scritture.push(JSON.parse(opts.body).p_stato);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(true) });
  }
  // nessun archivio cloud
  return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
};
// archivio locale DI NOME NON seed (seedFresh false fin da subito)
window.localStorage.setItem('turnario-ta-v1', JSON.stringify({
  personale: [{ id: "p1", cognome: "VECCHIO", nome: "DATO", grado: "CS", rp: "A1", capoTurno: "No", dal: null, al: null, autista: "3\u00b0", spec: {} }],
  causali: { "2027": [] }, soRinforzi: [], rpStorico: [], exceptions: [],
  settings: { anno: 2027 }, __appVersion: "0.17.1", __aggiornatoAl: "2000-01-01T00:00:00.000Z"
}));
window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;
setTimeout(() => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  setTimeout(() => {
    setTimeout(() => {
      // archivio esistente: perde solo se cloud pi\u00f9 recente; qui cloud vuoto -> push consentito
      ok(scritture.length >= 1, "(1) archivio locale con dati: push verso il cloud CONSENTITO e avvenuto (" + scritture.length + " scritture)");
      // ora una modifica: deve riprogrammare il push
      const prima = scritture.length;
      const st = JSON.parse(window.localStorage.getItem('turnario-ta-v1'));
      // aggiungi una persona via UI
      doc.querySelector("#btn-nuova-persona").click();
      const f = doc.querySelector("#form-persona");
      f.querySelector('[name="cognome"]').value = "NUOVA";
      f.querySelector('[name="nome"]').value = "PERSONA";
      doc.querySelector("#fp-salva").click();
      setTimeout(() => {
        ok(scritture.length > prima, "(2) modifica dell'utente: push verso il cloud riavvenuto");
        const st2 = JSON.parse(window.localStorage.getItem('turnario-ta-v1'));
        ok(st2.personale.some(p => p.cognome === "NUOVA"), "(3) la modifica resta in locale");
        const ultimaScrittura = scritture[scritture.length - 1];
        ok(ultimaScrittura.personale.some(p => p.cognome === "NUOVA"), "(4) l'ultima scrittura cloud contiene la modifica");
        console.log(failures.length === 0 ? "\nTUTTI I TEST PASSATI" : "\nFALLIMENTI: " + failures.length);
        process.exit(failures.length ? 1 : 0);
      }, 4000);
    }, 1500);
  }, 400);
}, 200);
