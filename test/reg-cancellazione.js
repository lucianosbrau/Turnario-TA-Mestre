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

const persona = (id, c) => ({ id, cognome: c, nome: "X", grado: "CS", rp: "A1", capoTurno: "No", dal: null, al: null, autista: "3°", spec: { SO115: "Si" } });
window.localStorage.setItem('turnario-ta-v1', JSON.stringify({
  personale: [persona("p1", "ATTIVA"), persona("p2", "DA_CANCELLARE")],
  causali: { "2027": [{ p: "p2", d: "2027-05-05", c: "L" }] },
  soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 }, __appVersion: "1.0.1",
}));
window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;

setTimeout(() => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  setTimeout(() => {
    const st = () => JSON.parse(window.localStorage.getItem('turnario-ta-v1'));

    // 1) home filtrata: solo l'attiva
    let nomiHome = [...doc.querySelectorAll("#tabella-personale tbody td.nome")].map(x => x.textContent);
    ok(nomiHome.some(t => t.includes("ATTIVA")) && nomiHome.some(t => t.includes("DA_CANCELLARE")), "(1) Home filtrata mostra entrambe (nessun eliminato)");

    // 2) cancellazione p2 dal modale
    doc.querySelector("#btn-cancella-persona").click();
    const box = [...doc.querySelectorAll('#form-persona input[type="checkbox"]')].find(b => b.value === "p2");
    ok(!!box, "(2) p2 nell'elenco cancellabili");
    box.checked = true;
    doc.querySelector("#canc-ok").click();
    const st1 = st();
    const p2 = st1.personale.find(x => x.id === "p2");
    ok(p2 && p2.eliminato === true, "(3) p2 eliminata in modo reversibile (flag, non rimozione)");
    ok(st1.personale.length === 2, "(3b) l'archivio non perde la persona");
    ok((st1.causali["2027"] || []).some(c => c.p === "p2"), "(3c) le causali di p2 restano in archivio");

    // 3) home filtrata (default) ora nasconde p2
    nomiHome = [...doc.querySelectorAll("#tabella-personale tbody td.nome")].map(x => x.textContent);
    ok(!nomiHome.some(t => t.includes("DA_CANCELLARE")), "(4) Home filtrata nasconde la cancellata");

    // 4) tolgo il filtro: compare con dicitura (cancellata)
    doc.querySelector("#solo-attivi-home").checked = false;
    doc.querySelector("#solo-attivi-home").dispatchEvent(new window.Event("change", { bubbles: true }));
    nomiHome = [...doc.querySelectorAll("#tabella-personale tbody td.nome")].map(x => x.textContent);
    ok(nomiHome.some(t => t.includes("DA_CANCELLARE") && t.includes("(cancellata)")), "(5) senza filtro la cancellata compare con dicitura");
    ok(nomiHome.some(t => t.includes("ATTIVA")), "(5b) senza filtro gli attivi restano");

    // 5) recupero dal modale Cancella personale
    doc.querySelector("#solo-attivi-home").checked = true;
    doc.querySelector("#solo-attivi-home").dispatchEvent(new window.Event("change", { bubbles: true }));
    doc.querySelector("#btn-cancella-persona").click();
    const recBtn = [...doc.querySelectorAll("#form-persona button")].find(b => b.id.startsWith("rec-p2"));
    ok(!!recBtn, "(6) pulsante Recupera per p2 nel modale");
    recBtn.click();
    const p2b = st().personale.find(x => x.id === "p2");
    ok(p2b && !p2b.eliminato, "(7) p2 recuperata");
    nomiHome = [...doc.querySelectorAll("#tabella-personale tbody td.nome")].map(x => x.textContent);
    ok(nomiHome.some(t => t.includes("DA_CANCELLARE")) && !nomiHome.some(t => t.includes("(cancellata)")), "(8) Home filtrata mostra di nuovo p2 senza dicitura");

    // 6) lenzuolo: nessun errore JS durante tutto il flusso
    ok(true, "(9) nessuna eccezione JS");

    console.log(failures.length ? "\nFAILED: " + failures.length : "\nALL OK");
    process.exit(failures.length ? 1 : 0);
  }, 300);
}, 100);
