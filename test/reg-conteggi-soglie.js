// Conteggi in basso del lenzuolo e soglie di criticita' (colorazione + banner).
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

// 5 persone: 4 con RP A1 e una con RP A2; tutte SO115; un turno A1 futuro
// (2027-03-04 e' slot A1? si verifica a runtime: si cerca un turno con slot A1)
const persona = (id, rp, extra) => ({ id, cognome: 'P' + id, nome: 'X', grado: 'CS', rp, capoTurno: 'No', dal: null, al: null, autista: '3°', spec: Object.assign({ SO115: 'Si' }, extra || {}) });
window.localStorage.setItem('turnario-ta-v1', JSON.stringify({
  personale: [persona('q1','A1'), persona('q2','A1'), persona('q3','A1'), persona('q4','A1'), persona('q5','A2',{AS:'Si'})],
  causali: { 2027: [{ p: 'q1', d: '2027-03-04', c: 'L' }] },
  soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 },
}));
window.eval(fs.readFileSync(process.env.APP_BUNDLE || '/tmp/app-bundle.js', 'utf8'));
const doc = window.document;

setTimeout(() => {
  doc.querySelector("#blocco-pass").value = "test1234";
  doc.querySelector("#blocco-pass2").value = "test1234";
  doc.querySelector("#blocco-ok").click();
  window.location.hash = "#presenze";
  doc.querySelector("#btn-presenze").click();
  setTimeout(() => {
    const righe = [...doc.querySelectorAll("#lenzuolo tr")];
    const riga = (nome) => righe.find(r => r.textContent.includes(nome));
    // trova la colonna del turno 04/03/2027 (slot A1: previsto dal motore)
    const celleData = [...doc.querySelectorAll("#lenzuolo [data-cella]")].filter(c => c.dataset.cella.endsWith('|2027-03-04'));
    const idxCol = celleData.find(c => c.dataset.cella.startsWith('q1')) ? celleData.find(c => c.dataset.cella.startsWith('q1')).cellIndex : -1;
    ok(idxCol >= 0, "(0) trovata la colonna del turno 04/03/2027");

    const valoreInData = (nomeRiga, colAssoluta) => {
      const r = riga(nomeRiga);
      if (!r) return null;
      // le righe di conteggio hanno children[0] con colspan=3 (Persona/Grado/Aut):
      // la cella alla colonna assoluta C e' children[C - 2]
      const td = r.children[colAssoluta - 2];
      return td ? { txt: td.textContent.trim(), cls: td.className } : null;
    };

    // ASSENZE TOTALI (RP+L): quel turno gli RP A1 sono 3 (con L) + q5 e' A2: attesi 3+1? q5 A2 non e' RP in A1:
    // presenti quel turno: q2,q3,q4 (RP-A1) + q1 in L = 5 personer in turno meno? PERSONALE IN TURNO = 5 (L conta? no: L e' assenza).
    // in turno: q2, q3, q4, q5. RP+L: q2,q3,q4 (RP) + q1 (L) = 4 su 5 persone; 4/5 = 80% > 27% -> critico.
    const ass = valoreInData("ASSENZE TOTALI", idxCol);
    ok(ass && Number(ass.txt) === 4, "(1) ASSENZE TOTALI 04/03 = 4 (3 RP + 1 L), trovato " + (ass && ass.txt));
    const rigaAss = riga("ASSENZE TOTALI");
    ok(rigaAss && rigaAss.className.includes("assenzetot"), "(1b) riga assenze colorata (classe assenzetot)");
    // 4 assenze su 5 persone = 80% > 27%: la cella ASSENZE deve essere critica
    ok(ass && ass.cls.includes("critico"), "(1c) ASSENZE TOTALI > 27% del personale: cella ROSSA (critico)");

    // PERSONALE IN TURNO: q2,q3,q4,q5 (q1 in L non e' in turno) = 4
    // in quel turno: q1 in L (assente), q2-q4 in RP, q5 (A2) in turno -> 1
    const pt = valoreInData("PERSONALE IN TURNO", idxCol);
    ok(pt && Number(pt.txt) === 1, "(2) PERSONALE IN TURNO 04/03 = 1 (solo chi non e' in RP/L), trovato " + (pt && pt.txt));

    const mst = valoreInData("PERSONALE MESTRE", idxCol);
    ok(mst && Number(mst.txt) === 1, "(3) PERSONALE MESTRE 04/03 = 1 (nessun R quel giorno), trovato " + (mst && mst.txt));

    // LICENZE = 1 (q1)
    const lic = valoreInData("LICENZE", idxCol);
    ok(lic && Number(lic.txt) === 1, "(4) LICENZE 04/03 = 1, trovato " + (lic && lic.txt));

    // IN RP = 3
    const inRp = valoreInData("IN RP", idxCol);
    ok(inRp && Number(inRp.txt) === 3, "(5) IN RP 04/03 = 3, trovato " + (inRp && inRp.txt));

    // AUTISTI 3°/4°: tutti 3° e in sede salvo L: 4 (q2,q3,q4,q5? q5 e' in turno)
    const aut = valoreInData("AUTISTI (3", idxCol);
    ok(aut && Number(aut.txt) === 1, "(6) AUTISTI 3/4 in sede 04/03 = 1 (solo q5), trovato " + (aut && aut.txt));

    // SO115 presenti: solo q5 -> 1 -> sotto 5 -> critico (rosso)
    const so = valoreInData("SO115", idxCol);
    ok(so && Number(so.txt) === 1, "(7) SO115 presenti 04/03 = 1, trovato " + (so && so.txt));
    ok(so && so.cls.includes("critico"), "(7b) SO115 < 5: cella ROSSA (critico)");

    // il banner appare SOLO se l'utente inserisce una causale (spec v0.6):
    // si simula l'inserimento reale: clic sulla cella -> menu -> bottone L
    const cellaDaCliccare = [...doc.querySelectorAll("#lenzuolo [data-cella]")].find(c => c.dataset.cella === 'q2|2027-03-04');
    cellaDaCliccare.click();
    const bottoneL = [...doc.querySelectorAll(".menu-causale button")].find(b => b.dataset.c === 'L');
    ok(!!bottoneL, "(7c) menu causale con opzione L");
    if (bottoneL) bottoneL.click();
    const banner = doc.querySelector("#avviso-criticita");
    ok(banner && banner.style.display === "flex", "(8) banner criticita' visibile dopo l'inserimento della causale");
    ok(banner && banner.textContent.includes("operatori SO115 presenti sotto 5"), "(8b) il banner indica la criticita' SO115");
    ok(banner && banner.textContent.includes("04/03/2027"), "(8c) il banner indica la data");
    // unico banner (non uno per criticita')
    ok(doc.querySelectorAll("#avviso-criticita").length === 1, "(8d) un solo banner (elenco unico)");

    console.log(failures.length ? "\nFAILED: " + failures.length : "\nALL OK");
    process.exit(failures.length ? 1 : 0);
  }, 300);
}, 100);
