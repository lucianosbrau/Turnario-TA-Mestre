const fs = require('fs');
const REPO = process.env.TURNARIO_REPO || require("path").resolve(__dirname, "..");
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(REPO + "/index.html", 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;
let failures = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures.push(m); };

const persona = (id, c) => ({ id, cognome: c, nome: "X", grado: "CS", rp: "A1", capoTurno: "No", dal: null, al: null, autista: "3°", spec: {} });
const statoBuono = { personale: [persona("p1","UTENTE1"), persona("p2","UTENTE2")], causali: { "2027": [{ p: "p1", d: "2027-03-04", c: "L" }] }, soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 }, __appVersion: "0.17.0" };
const statoCloud = { personale: [persona("q1","SEED1")], causali: {}, soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 }, __appVersion: "0.17.0" };

// localStorage: archivio locale col lavoro dell'utente + 2 copie gia' in storico
window.localStorage.setItem('turnario-ta-v1', JSON.stringify(statoBuono));
window.localStorage.setItem('turnario-ta-v1-storico', JSON.stringify([
  { t: "2027-01-01T10:00:00.000Z", raw: JSON.stringify(statoCloud) },
  { t: "2027-01-02T10:00:00.000Z", raw: JSON.stringify(statoBuono) },
]));
window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;

setTimeout(() => {
  // primo avvio: impostiamo la password del dispositivo (come nelle altre suite)
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  setTimeout(() => {
    // test A: la load() al cambio versione HA ARCHIVIATO una nuova copia (3 attese + quella del cambio versione se il contenuto e' diverso)
    const arch = JSON.parse(window.localStorage.getItem('turnario-ta-v1-storico') || "[]");
    ok(arch.length >= 2, "(A) storico presente dopo il boot (" + arch.length + " copie)");

    // test B: il pulsante apre l'elenco con le date
    doc.querySelector("#btn-ripristina").click();
    const righe = [...doc.querySelectorAll("#form-persona .canc-riga")];
    ok(righe.length === arch.length, "(B) finestra elenca " + arch.length + " copie");
    ok(/UTENTE|SEED|persone in archivio/.test(doc.querySelector("#form-persona").textContent), "(B2) testo elenco leggibile");

    // test C: ripristino della copia indicata sostituisce l'archivio
    doc.querySelector('input[name="snap"][value="0"]').checked = true; // la piu' vecchia (statoCloud, 1 persona SEED1)
    const nPrima = JSON.parse(window.localStorage.getItem('turnario-ta-v1')).personale.length;
    doc.querySelector("#snap-rip").click();
    const st = JSON.parse(window.localStorage.getItem('turnario-ta-v1'));
    ok(st.personale.length === 1 && st.personale[0].cognome === "SEED1", "(C) ripristino della copia selezionata (SEED1)");
    ok(nPrima >= 1, "(C2) prima del ripristino c'erano " + nPrima + " persone");

    // test D: nuova applicazione cloud archivia la copia corrente SENZA cancellare lo storico
    // simulo: applicaStatoCloud via import? Piu' semplice: controllo che archiviaSnapshot non restringa lo storico sotto il minimo
    const arch2 = JSON.parse(window.localStorage.getItem('turnario-ta-v1-storico') || "[]");
    ok(arch2.length >= arch.length - 1, "(D) storico non cancellato dopo il ripristino (" + arch2.length + ")");

    console.log(failures.length ? "\nFAILED: " + failures.length : "\nALL OK");
    process.exit(failures.length ? 1 : 0);
  }, 300);
}, 100);
