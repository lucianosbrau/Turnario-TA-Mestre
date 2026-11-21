const fs = require('fs');
const REPO = process.env.TURNARIO_REPO || require("path").resolve(__dirname, "..");
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(REPO + "/index.html", 'utf8');
const dom = new JSDOM(html, { url: "https://lucianosbrau.github.io/Turnario-TA-Mestre/?k=CODICETESTCODICETEST1234", runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = (m) => console.log("ALERT:", m);
window.confirm = () => true;
window.prompt = () => null;
const errors = [];
window.addEventListener('error', e => errors.push('JS-ERR: ' + e.message));
let failures = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures.push(m); };

// fetch finto: il cloud contiene "il lavoro vero" (una persona in più e licenze 2027)
let scritture = [];
const LAVORO = {
  personale: [{ id: "p1", cognome: "LAVORO", nome: "VERO", grado: "CS", rp: "A1", capoTurno: "No", dal: null, al: null, autista: "3\u00b0", spec: {} }],
  causali: { "2027": [{ p: "p1", d: "2027-03-05", c: "L" }, { p: "p1", d: "2027-03-09", c: "L" }] },
  rpStorico: [], exceptions: [], settings: { anno: 2027 }, __appVersion: "0.17.1"
};
window.fetch = (url, opts) => {
  if (String(url).includes("turnario_leggi")) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ stato: LAVORO, aggiornato_al: "2020-01-01T00:00:00.000" }) });
  }
  if (String(url).includes("turnario_scrivi")) {
    scritture.push(JSON.parse(opts.body).p_stato);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(true) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
};

window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;
setTimeout(() => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  setTimeout(() => {
    setTimeout(() => {
      const st = JSON.parse(window.localStorage.getItem("turnario-ta-v1") || "null");
      ok(!!st && st.personale.length === 1 && st.personale[0].cognome === "LAVORO",
        "(1) archivio locale vergine: applicato il LAVORO dal cloud anche se il seed aveva data pi\u00f9 recente");
      ok(st && st.causali["2027"].length === 2, "(2) le causali del lavoro sono arrivate");
      ok(scritture.length === 0, "(3) NESSUNA scrittura verso il cloud (il seed non e' stato spinto sopra il lavoro)");
      const badge = doc.querySelector("#versione").textContent;
      console.log("badge:", badge);
      ok(errors.length === 0, "(4) nessun errore JS" + (errors.length ? " - " + errors.join(" | ") : ""));
      console.log(failures.length === 0 ? "\nTUTTI I TEST PASSATI" : "\nFALLIMENTI: " + failures.length);
      process.exit(failures.length ? 1 : 0);
    }, 1500);
  }, 400);
}, 200);
