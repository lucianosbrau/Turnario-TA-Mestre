const fs = require('fs');
const path = require('path');
const REPO = process.env.TURNARIO_REPO || path.resolve(__dirname, "..");
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(REPO + "/index.html", 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;
let failures = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures.push(m); };

const persona = (id, c) => ({ id, cognome: c, nome: "X", grado: "CS", rp: "A1", capoTurno: "No", dal: null, al: null, autista: "3°", spec: { SO115: "Si" } });
window.localStorage.setItem('turnario-ta-v1', JSON.stringify({
  personale: [persona("p1", "OP1"), persona("p2", "OP2"), persona("p3", "OP3")],
  causali: { "2027": [
    { p: "p1", d: "2027-02-28", c: "SO" }, { p: "p2", d: "2027-02-28", c: "SO" }, { p: "p3", d: "2027-02-28", c: "SO" },
    { p: "p1", d: "2027-03-28", c: "SO" },
    { p: "p1", d: "2027-04-26", c: "SO" }, { p: "p2", d: "2027-04-26", c: "SO" },
  ] },
  soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 },
}));
window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;

setTimeout(() => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  window.location.hash = "#so";
  doc.querySelector("#btn-so").click();
  setTimeout(() => {
    const righe = [...doc.querySelectorAll("#lenzuolo-so tr")];
    const rigaTurni = righe.find(r => /TURNI SO/.test(r.textContent));
    ok(!!rigaTurni, "(0) riga TURNI SO presente");

    // celle giorno del corpo della prima persona: [data-cella] con la data dentro il titolo
    const celleGiorno = [...doc.querySelectorAll("#lenzuolo-so tbody tr")][0]
      ? [] : [];
    const bodyRow = [...doc.querySelectorAll("#lenzuolo-so tbody tr")][0];
    ok(!!bodyRow, "(1) riga corpo presente");

    // attese per data
    const attese = { "2027-02-28": 3, "2027-04-26": 2, "2027-03-28": 1 };
    const viste = {};
    let vuote = 0, controllate = 0;
    for (const c of bodyRow.querySelectorAll("[data-cella]")) {
      const data = (c.dataset.cella || "").split("|")[1];
      // colonna assoluta = cellIndex nella riga corpo (stick incluse)
      const idxCella = c.cellIndex;
      // riga TURNI SO: children[0] copre le colonne 0..2 (colspan 3), quindi la cella
      // alla colonna assoluta C e' children[C - 2]
      const cellaAllineata = rigaTurni.children[idxCella - 2];
      const val = cellaAllineata ? cellaAllineata.textContent.trim() : "";
      if (val === "" ) vuote++;
      controllate++;
      if (attese[data] !== undefined && !(data in viste)) {
        viste[data] = true;
        ok(Number(val) === attese[data], "(2) " + data + ": riga TURNI SO mostra " + JSON.stringify(val) + " (atteso " + attese[data] + ")");
      }
    }
    ok(controllate === 182, "(3) controllate " + controllate + " colonne giorno (182 turni nel 2027)");
    ok(vuote === 0, "(4) nessuna cella TURNI SO vuota o mancante (" + vuote + " vuote)");

    console.log(failures.length ? "\nFAILED: " + failures.length : "\nALL OK");
    process.exit(failures.length ? 1 : 0);
  }, 300);
}, 100);
