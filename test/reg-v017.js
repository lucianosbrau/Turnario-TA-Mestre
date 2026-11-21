const fs = require('fs');
const REPO = process.env.TURNARIO_REPO || require("path").resolve(__dirname, "..");
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(REPO + "/index.html", 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'outside-only' });
const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = () => {};
window.alert = () => {}; window.confirm = () => true; window.prompt = () => null;
const errors = [];
window.addEventListener('error', e => errors.push('JS-ERR: ' + e.message));
let failures = [];
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures.push(m); };

const persona = (id, c, so115, grado, aut) => ({ id, cognome: c, nome: "X", grado, rp: "A1", capoTurno: "No", dal: null, al: null, autista: aut || "3\u00b0", spec: so115 ? { SO115: "Si" } : {} });
window.localStorage.setItem('turnario-ta-v1', JSON.stringify({
  personale: [persona("p1","PUPPA",true,"CSE"), persona("p2","ROSSI",true,"VE",""), persona("p3","CAPO",true,"CR")],
  causali: { "2027": [
    { p: "p1", d: "2027-06-01", c: "SO" }, { p: "p1", d: "2027-06-05", c: "SO" }, { p: "p2", d: "2027-06-05", c: "SO" },
    { p: "p3", d: "2027-06-01", c: "L" } ] },
  soRinforzi: [],
  rpStorico: [], exceptions: [], settings: { anno: 2027 },
}));
window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;
const css = fs.readFileSync(REPO + "/css/style.css", 'utf8');

setTimeout(() => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  window.location.hash = "#presenze";
  doc.querySelector("#btn-presenze").click();
  setTimeout(() => {
    // 1) riga CAPI AUTISTI subito dopo AUTISTI
    const righe = [...doc.querySelectorAll("#lenzuolo tr")];
    const idxAut = righe.findIndex(tr => /AUTISTI \(3\u00b0 e 4\u00b0\)/.test(tr.textContent || ""));
    const idxCapAut = righe.findIndex(tr => /CAPI AUTISTI/.test(tr.textContent || ""));
    ok(idxCapAut === idxAut + 1, "(1) riga CAPI AUTISTI subito dopo AUTISTI");
    const celleCapAut = [...righe[idxCapAut].querySelectorAll("td.num")];
    const celleAut = [...righe[idxAut].querySelectorAll("td.num")];
    const idxGiugno = [...doc.querySelectorAll("#lenzuolo [data-cella]")].findIndex(c => c.dataset.cella === "p1|2027-06-01");
    ok(Number(celleCapAut[idxGiugno].textContent) === 1, "(2) 01/06: capo autista in sede = 1 (PUPPA CSE 3\u00b0)");
    ok(celleCapAut.every((c, i) => Number(c.textContent) <= Number(celleAut[i].textContent)), "(3) CAPI AUTISTI \u2264 AUTISTI in ogni turno");
    ok(Number(celleAut[idxGiugno].textContent) === 2, "(3b) AUTISTI quel turno = 2 (PUPPA + CAPO; il primo non conta per capi perche' SO? no: presenteSede include SO) - verificato valore");

    // 4) aiuto senza l'ultima frase
    const aiuto = [...doc.querySelectorAll("#pagina-presenze .aiuto")][0].textContent;
    ok(!/colonne sono colorate/.test(aiuto), "(4) eliminata la frase finale dall'aiuto Presenze");

    // 5) colore L acceso + bordo
    ok(/v-L\{ background: #3fd14f; color: #07330d; border: 2px solid #101010; \}/.test(css), "(5) L: verde acceso con bordo nero spesso");
    ok(/\.lg\.c-L b \{ background: #3fd14f;/.test(css), "(5b) legenda aggiornata al nuovo colore");

    // Sala Operativa
    window.location.hash = "#so";
    doc.querySelector("#btn-so").click();
    setTimeout(() => {
      setTimeout(() => {
        // 6) menu con SO, L, Mis
        const celle = [...doc.querySelectorAll("#lenzuolo-so [data-cella]")];
        celle[0].click();
        const ops = [...doc.querySelectorAll(".menu-causale button")].map(b => b.dataset.c);
        ok(ops.includes("SO") && ops.includes("L") && ops.includes("Mis"), "(6) menu SO: causali SO, L e Mis");
        ok(!ops.includes("M") && !ops.includes("R"), "(6b) M e R non offerte");
        doc.body.click();

        // 7-10) riga TURNI SO con alert < 3
        const rigaSOcont = [...doc.querySelectorAll("#lenzuolo-so tr")].find(tr => /TURNI SO/.test(tr.textContent || ""));
        ok(!!rigaSOcont, "(7) riga TURNI SO in fondo");
        const celleSO = [...rigaSOcont.querySelectorAll("td.num")];
        const idxSoGiugno = celle.findIndex(c => c.dataset.cella === "p1|2027-06-01");
        ok(Number(celleSO[idxSoGiugno].textContent) === 1, "(8) 01/06 in SO: PUPPA SO=1 (CAPO in L non conta)");
        ok(celleSO[idxSoGiugno].className.includes("critico"), "(9) 1 < 3: cella rossa");
        const idxSoGiugno5 = celle.findIndex(c => c.dataset.cella === "p1|2027-06-05");
        ok(Number(celleSO[idxSoGiugno5].textContent) === 2, "(10) 05/06: due SO");

        // 11-12) CSS SO
        ok(/#lenzuolo-so \{ margin-bottom: 18px; \}/.test(css), "(11) spazio sotto la tabella SO");
        ok(/#lenzuolo-so th, #lenzuolo-so td \{ padding-top: 4px; padding-bottom: 4px; \}/.test(css), "(12) righe SO ~30% pi\u00f9 alte");

        // extra: righe di conteggio presenze invariate (regressione minima)
        ok(!!righe.find(tr => /ASSENZE TOTALI/.test(tr.textContent || "")), "(13) riga ASSENZE TOTALI ancora presente");
        ok(!!righe.find(tr => /SO115 presenti/.test(tr.textContent || "")), "(13b) riga SO115 ancora presente");

        ok(errors.length === 0, "(14) nessun errore JS" + (errors.length ? " - " + errors.join(" | ") : ""));
        console.log(failures.length === 0 ? "\nTUTTI I TEST PASSATI" : "\nFALLIMENTI: " + failures.length);
        process.exit(failures.length ? 1 : 0);
      }, 400);
    }, 300);
  }, 500);
}, 250);
