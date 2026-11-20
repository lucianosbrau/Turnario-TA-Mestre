// Interfaccia utente: pagina principale (Personale) e pagina Presenze (lenzuolo).
import { APP_VERSION, CAUSALI, SLOT, SLOT_COLOR, GRADI, GRADO_ORDER, AUTISTA, SPEC_FIELDS, MESI } from "./config.js";
import * as store from "./store.js";
import * as sync from "./sync.js";
import * as lock from "./lock.js";
import { turniAnno, attivoIn, rpEffettivo, valoreCella, presente, effettiviTurno, isoToIt, todayIso, cellKey } from "./engine.js";

const $ = (sel) => document.querySelector(sel);
const anno = () => store.getState().settings.anno;

export function init() {
  $("#versione").textContent = "v" + APP_VERSION;
  const sel = $("#anno");
  const corrente = anno();
  let opzioni = "";
  for (let a = corrente - 3; a <= corrente + 10; a++) opzioni += `<option value="${a}">${a}</option>`;
  sel.innerHTML = opzioni;
  sel.value = String(corrente);
  sel.addEventListener("change", (e) => {
    store.setAnno(Number(e.target.value));
    render();
  });
  $("#btn-presenze").addEventListener("click", () => { location.hash = "#presenze"; });
  $("#btn-home").addEventListener("click", () => { location.hash = "#"; });
  $("#btn-export").addEventListener("click", esporta);
  $("#btn-cancella-persona").onclick = apriCancellaPersona;
  $("#btn-cambio-rp").onclick = apriCambioRp;
  $("#btn-ordina").onclick = () => {
    renderHome();
    alert("Personale ordinato per grado (CSE → CR → CRE → CS → VC → VE → VF, capo turno per primo).\nL'ordine viene applicato in automatico anche dopo ogni nuovo inserimento.");
  };
  sync.onStatus(mostraStatoSync);
  aggiornaPannelloSync();
  window.addEventListener("hashchange", mostraPagina);
  mostraPagina();
  sync.avvio(
    (stato) => { try { store.applicaStatoCloud(stato); render(); } catch (e) { alert("Archivio cloud non valido: uso quello locale."); } },
    () => JSON.parse(localStorage.getItem("turnario-ta-v1") || "null")
  );
}

function mostraStatoSync(stato, dettaglio) {
  const el = $("#badge-sync");
  if (!el) return;
  const ora = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const map = {
    "spenta": ["Sync non configurata", ""],
    "senza-credenziali": ["Account del turno non inserito", ""],
    "erroe": ["Errore di sincronizzazione", ""],
    "errore": ["Errore di sincronizzazione", ""],
    "in-attesa": ["Modifiche da salvare online…", ""],
    "sincronizzato": ["Sincronizzato ✓", ""],
  };
  const [testo, cls] = map[stato] || [stato, ""];
  el.textContent = testo;
  el.className = "stato-sync " + (stato === "sincronizzato" ? "ok" : stato === "in-attesa" ? "pend" : "ko");
  el.title = dettaglio ? dettaglio + " (" + ora + ")" : ora;
}

function aggiornaPannelloSync() {
  const box = $("#pannello-sync");
  if (!box) return;
  if (!sync.attivo()) {
    box.innerHTML = `<p class="aiuto">Sincronizzazione multi-dispositivo non ancora configurata nel progetto
      (valori <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> in <code>js/config.js</code>).
      Fino ad allora l'app funziona solo in locale, con backup tramite Esporta/Importa.</p>`;
    return;
  }
  if (sync.codiceAttivo()) {
    box.innerHTML = `<p class="aiuto">Sincronizzazione attiva tramite <b>link privato</b>: ogni modifica viene
      salvata online in automatico e ritrovata da qualunque dispositivo che apre il link.
      <button id="sync-disconnetti" class="distruttivo">Disconnetti questo dispositivo</button></p>`;
    $("#sync-disconnetti").onclick = () => {
      sync.disconnetti();
      aggiornaPannelloSync();
      mostraStatoSync("spenta");
    };
    return;
  }
  if (sync.credenzialiSalvate()) {
    box.innerHTML = `<p class="aiuto">Sincronizzazione attiva: ogni modifica viene salvata online in automatico
      e ritrovata da qualunque dispositivo con le credenziali del turno.
      <button id="sync-disconnetti" class="distruttivo">Disconnetti questo dispositivo</button></p>`;
    $("#sync-disconnetti").onclick = () => {
      sync.disconnetti();
      aggiornaPannelloSync();
      mostraStatoSync("spenta");
    };
  } else {
    box.innerHTML = `
      <p class="aiuto">Due modi per attivare la sincronizzazione su questo dispositivo:
        <br><b>1) Link privato</b>, il piu' semplice: apri l'app con l'indirizzo che contiene il codice
        (quello salvato nei preferiti) e la sincronizzazione parte da sola.
        <br><b>2) Account del turno</b> qui sotto (email e password, una volta sola):</p>
      <div class="form-sync">
        <label>Email <input type="email" id="sync-email" placeholder="turnario@..."></label>
        <label>Password <input type="password" id="sync-pass"></label>
        <button id="sync-attiva">Attiva la sincronizzazione</button>
      </div>`;
    $("#sync-attiva").onclick = async () => {
      const email = $("#sync-email").value.trim();
      const password = $("#sync-pass").value;
      if (!email || !password) { alert("Inserisci email e password."); return; }
      sync.impostaCredenziali(email, password);
      const ok = await sync.login();
      if (ok) {
        await sync.avvio(
          (stato) => { try { store.applicaStatoCloud(stato); render(); } catch (e) { alert("Archivio cloud non valido: uso quello locale."); } },
          () => JSON.parse(localStorage.getItem("turnario-ta-v1") || "null")
        );
        aggiornaPannelloSync();
        renderHome();
      } else alert("Accesso non riuscito: controlla email e password (l'account deve essere confermato su Supabase).");
    };
  }
}

function mostraPagina() {
  const presenze = location.hash === "#presenze";
  // gestisce l'attributo hidden (non solo lo stile), altrimenti il browser
  // continua a non mostrare la sezione
  $("#pagina-home").toggleAttribute("hidden", presenze);
  $("#pagina-presenze").toggleAttribute("hidden", !presenze);
  if (presenze) renderPresenze(); else renderHome();
}

function render() {
  if (location.hash === "#presenze") renderPresenze();
  else renderHome();
}

/* ---------------- HOME: gestione personale ---------------- */

function renderHome() {
  $("#anno").value = anno();
  const s = store.getState();
  const oggi = todayIso();
  const persone = ordinaPersone(s.personale);
  const tb = $("#tabella-personale tbody");
  tb.innerHTML = persone.map((p) => {
    const attivo = attivoIn(p, oggi);
    const storico = (s.rpStorico || []).filter(x => x.p === p.id);
    return `<tr class="${attivo ? "" : "uscito"}">
      <td class="nome">${p.cognome} ${p.nome}</td>
      <td>${p.grado || ""}</td>
      <td class="rp">${rpEffettivo(s, p.id, oggi)}</td>
      <td class="rpbase">(${p.rp})</td>
      <td class="aut">${p.autista || ""}</td>
      <td>${Object.entries(p.spec || {}).filter(([k, v]) => v).map(([k]) => k).join(", ")}</td>
      <td>${p.dal ? isoToIt(p.dal) : ""}</td>
      <td class="${p.al ? "uscito-il" : ""}">${p.al ? isoToIt(p.al) : ""}</td>
      <td class="azioni">
        <button data-edit="${p.id}">Modifica</button>
        ${storico.length ? `<button data-stor="${p.id}">Storico RP (${storico.length})</button>` : ""}
      </td>
    </tr>`;
  }).join("");
  tb.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => apriPersona(b.dataset.edit)));
  tb.querySelectorAll("[data-stor]").forEach(b => b.addEventListener("click", () => apriStorico(b.dataset.stor)));
  $("#btn-nuova-persona").onclick = () => apriPersona(null);
  const totAtt = s.personale.filter(p => attivoIn(p, oggi)).length;
  $("#situazione").textContent =
    `Personale in turno oggi: ${totAtt} su ${s.personale.length}. Persone uscite (storico conservato): ${s.personale.length - totAtt}.`;
}

function ordinaPersone(arr) {
  return [...arr].sort((a, b) => {
    const ga = GRADO_ORDER.indexOf(a.grado), gb = GRADO_ORDER.indexOf(b.grado);
    const ia = ga === -1 ? 99 : ga, ib = gb === -1 ? 99 : gb;
    if (ia !== ib) return ia - ib;
    const ca = a.capoTurno === "Si" ? 0 : 1, cb = b.capoTurno === "Si" ? 0 : 1;
    if (ca !== cb) return ca - cb;
    return 0;
  });
}
function apriPersona(id) {
  const s = store.getState();
  const p = id ? s.personale.find(x => x.id === id) : { cognome: "", nome: "", grado: "VF", rp: "A1", capoTurno: "", dal: null, al: null, autista: "", spec: {} };
  const specHtml = SPEC_FIELDS.map(f =>
    `<label><input type="checkbox" name="spec-${f}" ${p.spec?.[f] ? "checked" : ""}>${f}</label>`).join(" ");
  $("#form-persona").innerHTML = `
    <h3>${id ? "Modifica persona" : "Nuova persona"}</h3>
    <div class="griglia-form">
      <label>Cognome<input name="cognome" value="${p.cognome}" required></label>
      <label>Nome<input name="nome" value="${p.nome}" required></label>
      <label>Grado<select name="grado">${GRADI.map(g => `<option ${g === p.grado ? "selected" : ""}>${g}</option>`).join("")}</select></label>
      <label>RP base (salto turno)<select name="rp">${SLOT.map(a => `<option ${a === p.rp ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      <label>Capo turno<input name="capoTurno" value="${p.capoTurno || ""}" placeholder="Si/No"></label>
      <label>Autista<select name="autista"><option value=""></option>${AUTISTA.map(a => `<option ${a === p.autista ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      <label>Dal (entratə nel turno)<input type="date" name="dal" value="${p.dal || ""}"></label>
      <label>Al (uscitə dal turno — lascia vuoto se in servizio)<input type="date" name="al" value="${p.al || ""}"></label>
    </div>
    <fieldset class="spec"><legend>Specializzazioni</legend>${specHtml}</fieldset>
    <div class="azioni-form">
      <button id="fp-salva">Salva</button>
      <button id="fp-annulla">Annulla</button>
      ${id ? `<button id="fp-elimina" class="distruttivo">Elimina persona e sue presenze</button>` : ""}
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  $("#fp-salva").onclick = () => {
    const f = $("#form-persona");
    const dati = {
      cognome: f.querySelector('[name="cognome"]').value.trim(),
      nome: f.querySelector('[name="nome"]').value.trim(),
      grado: f.querySelector('[name="grado"]').value,
      rp: f.querySelector('[name="rp"]').value,
      capoTurno: f.querySelector('[name="capoTurno"]').value.trim(),
      autista: f.querySelector('[name="autista"]').value,
      dal: f.querySelector('[name="dal"]').value || null,
      al: f.querySelector('[name="al"]').value || null,
      spec: Object.fromEntries(SPEC_FIELDS.map(f2 => [f2, f.querySelector(`[name="spec-${f2}"]`).checked ? "Si" : ""])),
    };
    if (id) { dati.id = id; store.updatePerson(dati); }
    else store.addPerson(dati);
    chiudiModale();
    renderHome();
  };
  if (id) $("#fp-elimina").onclick = () => {
    if (confirm("Eliminare definitivamente questa persona e tutte le sue presenze?")) {
      store.deletePerson(id);
      chiudiModale();
      renderHome();
    }
  };
}

function apriStorico(id) {
  const s = store.getState();
  const p = s.personale.find(x => x.id === id);
  const righe = (s.rpStorico || []).filter(x => x.p === id)
    .sort((a, b) => (a.dal || "").localeCompare(b.dal || ""));
  $("#form-persona").innerHTML = `
    <h3>Storico RP — ${p.cognome} ${p.nome}</h3>
    <p class="aiuto">RP base attuale: <b>${p.rp}</b>. Le vociqui sotto valgono solo nel loro periodo.</p>
    <table class="mini"><thead><tr><th>RP</th><th>Dal</th><th>Al</th><th></th></tr></thead><tbody>
    ${righe.map((r, i) => `<tr><td>${r.rp}</td><td>${isoToIt(r.dal)}</td><td>${r.al ? isoToIt(r.al) : "in corso"}</td>
      <td><button data-del="${i}" class="distruttivo">Elimina</button></td></tr>`).join("")}
    </tbody></table>
    <div class="azioni-form">
      <button id="fp-nuovo-rp">Nuovo cambio RP definitivo dal…</button>
      <button id="fp-annulla">Chiudi</button>
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  $("#fp-nuovo-rp").onclick = () => {
    const nuovo = prompt(`Nuovo RP per ${p.cognome} ${p.nome} (A1…A8):`, p.rp);
    if (!SLOT.includes(nuovo)) return;
    const dal = prompt("Decorrenza (AAAA-MM-GG), es. primo giorno del mese:", anno() + "-01-01");
    if (!dal || !/^\d{4}-\d{2}-\d{2}$/.test(dal)) return;
    store.cambioRpDefinitivo(id, nuovo, dal);
    chiudiModale();
    renderHome();
  };
  $("#form-persona").querySelectorAll("[data-del]").forEach((b, i) =>
    b.addEventListener("click", () => {
      const r = righe[i];
      const arr = store.getState().rpStorico;
      const j = arr.indexOf(r);
      if (j >= 0) arr.splice(j, 1);
      store.save();
      chiudiModale();
      renderHome();
    }));
}

function chiudiModale() { $("#modale").style.display = "none"; }

function apriCancellaPersona() {
  const s = store.getState();
  const persone = ordinaPersone(s.personale);
  $("#form-persona").innerHTML = `
    <h3>Cancella personale</h3>
    <p class="aiuto">La persona viene rimossa dall'archivio insieme alle sue presenze e al suo RP.
    Se invece e' solo uscita dal turno, meglio metterle una data di uscita (dal pulsante Modifica): le presenze restano nello storico.</p>
    <label class="campo">Persona da cancellare
      <select id="canc-pers">${persone.map(p => `<option value="${p.id}">${p.cognome} ${p.nome} (${p.grado})</option>`).join("")}</select>
    </label>
    <div class="azioni-form">
      <button id="canc-ok" class="distruttivo">Cancella definitivamente</button>
      <button id="fp-annulla">Annulla</button>
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  $("#canc-ok").onclick = () => {
    const id = $("#canc-pers").value;
    const p = s.personale.find(x => x.id === id);
    if (!p) return;
    if (confirm(`Confermi la cancellazione di ${p.cognome} ${p.nome}? L'operazione elimina anche tutte le sue presenze e non si puo' annullare.`)) {
      store.deletePerson(id);
      chiudiModale();
      renderHome();
      alert("Persona cancellata.");
    }
  };
}

function apriCambioRp() {
  const s = store.getState();
  const persone = ordinaPersone(s.personale);
  $("#form-persona").innerHTML = `
    <h3>Cambio RP (salto turno)</h3>
    <p class="aiuto">Cambio definitivo con decorrenza: da quella data la persona segue il nuovo salto turno.
    Per un cambio che vale solo per un mese, apri la pagina Presenze e clicca la colonna RP del mese.</p>
    <label class="campo">Persona
      <select id="rp-pers">${persone.map(p => `<option value="${p.id}">${p.cognome} ${p.nome} — RP attuale ${p.rp}</option>`).join("")}</select>
    </label>
    <label class="campo">Nuovo RP
      <select id="rp-nuovo">${SLOT.map(a => `<option>${a}</option>`).join("")}</select>
    </label>
    <label class="campo">Decorrenza (primo giorno col nuovo RP)
      <input type="date" id="rp-dal" value="${anno()}-01-01">
    </label>
    <label class="campo solo-lettura">RP attuale della persona selezionata: <b id="rp-attuale"></b></label>
    <div class="azioni-form">
      <button id="rp-ok">Applica cambio RP</button>
      <button id="fp-annulla">Annulla</button>
    </div>
    <details><summary>Storia dei cambi</summary><div id="rp-storia"></div></details>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  const mostra = () => {
    const id = $("#rp-pers").value;
    const p = s.personale.find(x => x.id === id);
    $("#rp-attuale").textContent = p ? rpEffettivo(s, id, todayIso()) + " (base " + p.rp + ")" : "";
    $("#rp-storia").innerHTML = (s.rpStorico || []).filter(x => x.p === id)
      .map(x => `<p class="aiuto">${x.rp} — dal ${isoToIt(x.dal)} al ${x.al ? isoToIt(x.al) : "in corso"}</p>`)
      .join("") || "<p class=\"aiuto\">Nessun cambio registrato per questa persona.</p>";
  };
  $("#rp-pers").addEventListener("change", mostra);
  mostra();
  $("#rp-ok").onclick = () => {
    const id = $("#rp-pers").value;
    const nuovo = $("#rp-nuovo").value;
    const dal = $("#rp-dal").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dal)) { alert("Decorrenza non valida."); return; }
    store.cambioRpDefinitivo(id, nuovo, dal);
    chiudiModale();
    renderHome();
    alert("RP aggiornato.");
  };
}

function esporta() {
  const blob = new Blob([store.exportJson()], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `turnario-ta-backup-${todayIso()}.json`;
  a.click();
}

function importa(e) {
  const file = e.target.files[0];
  if (!file) return;
  file.text().then(t => {
    try {
      store.importJson(t);
      alert("Dati importati correttamente.");
      render();
    } catch (err) {
      alert("Import fallito: " + err.message);
    }
  });
  e.target.value = "";
}

/* ---------------- PRESENZE: il lenzuolo ---------------- */

let soloAttivi = true;

function renderPresenze() {
  const s = store.getState();
  const a = anno();
  const turni = turniAnno(a);
  const cmap = store.mappaCausali(a);
  $("#presenze-anno").textContent = a;

  // persone da mostrare: tutte quelle che hanno avuto a che fare con l'anno,
  // oppure "solo attivi" (default) per la compilazione corrente
  const inizioAnno = `${a}-01-01`, fineAnno = `${a}-12-31`;
  let persone = ordinaPersone(s.personale.filter(p => {
    const maiAttivo = (!p.dal || p.dal <= fineAnno) && (!p.al || p.al >= inizioAnno);
    const attivoOra = attivoIn(p, todayIso());
    return soloAttivi ? (maiAttivo && attivoOra) : maiAttivo;
  }));

  // gruppi mensili
  const mesi = [];
  for (const t of turni) {
    let g = mesi.find(m => m.mese === t.month);
    if (!g) { g = { mese: t.month, turni: [] }; mesi.push(g); }
    g.turni.push(t);
  }

  // intestazione: 4 righe di testa (mese | RP+giorni | fase | slot)
  const tb = $("#lenzuolo");
  let html = "<thead>";
  html += `<tr><th class="stick1" rowspan="4">Persona</th><th class="stick2" rowspan="4">Grado</th><th class="stick3" rowspan="4">Aut</th>`;
  for (const g of mesi) html += `<th class="mese" colspan="${g.turni.length + 1}" data-mese="${g.mese}">${MESI[Number(g.mese.slice(5)) - 1].toUpperCase()}</th>`;
  html += `<th class="tot" colspan="7">TOT.</th></tr>`;

  html += "<tr>" + mesi.map(g => `<th class="hcell rpm">RP</th>` + g.turni.map(t => `<th class="hcell">${Number(t.date.slice(8))}</th>`).join("")).join("") + totHead(["Turni", "RP", "L", "Mis", "M", "SO", "R"]) + "</tr>";

  html += "<tr>" + mesi.map(g => `<th class="hcell rpm"></th>` + g.turni.map(t => `<th class="hcell fase" style="background:${SLOT_COLOR[t.slot]}">${t.phase}</th>`).join("")).join("") + `<th class="hcell tot" colspan="7"></th></tr>`;

  html += "<tr>" + mesi.map(g => `<th class="hcell rpm"></th>` + g.turni.map(t => `<th class="hcell slot" style="background:${SLOT_COLOR[t.slot]}">${t.slot}</th>`).join("")).join("") + `<th class="hcell tot" colspan="7"></th></tr>`;
  html += "</thead>";

  // corpo
  html += "<tbody>";
  for (const p of persone) {
    html += `<tr class="${attivoIn(p, todayIso()) ? "" : "gray"}">`;
    html += `<td class="stick1 nome" data-nome="${p.id}" title="Clicca per assegnare una causale su un periodo">${p.cognome} ${p.nome}</td>`;
    html += `<td class="stick2">${p.grado || ""}</td>`;
    html += `<td class="stick3">${p.autista || ""}</td>`;
    for (const g of mesi) {
      const rpMese = rpEffettivo(s, p.id, g.mese + "-01");
      const ex = (s.exceptions || []).find(e => e.p === p.id && e.mese === g.mese);
      html += `<td class="rpmese ${ex ? "eccezione" : ""}" data-eccez="${p.id}|${g.mese}" title="RP del mese — clicca per cambiarlo solo per questo mese">${rpMese}</td>`;
      for (const t of g.turni) {
        const v = valoreCella(s, p, t, cmap);
        html += `<td class="cella v-${v} col${t.slot} ${attivoIn(p, t.date) ? "" : "gray"}" data-cella="${p.id}|${t.date}" title="${t.date} ${t.phase} ${t.slot}">${v === "RP" ? "RP" : v}</td>`;
      }
    }
    const tot = {};
    for (const c of ["L", "Mis", "M", "SO", "R"]) {
      tot[c] = (s.causali?.[a] || []).filter(x => x.p === p.id && x.c === c).length;
    }
    tot.RP = mesi.reduce((n, g) => n + g.turni.filter(t => vIsRP(s, p, t, cmap) && attivoIn(p, t.date)).length, 0);
    tot.Turni = 0;
    for (const g of mesi) for (const t of g.turni) {
      if (!attivoIn(p, t.date)) continue;
      if (presente(s, p, t, cmap)) tot.Turni++;
    }
    html += ["Turni", "RP", "L", "Mis", "M", "SO", "R"].map(k => `<td class="tot">${tot[k]}</td>`).join("");
    html += "</tr>";
  }
  // righe di conteggio in basso
  html += `<tr class="effettivi"><td class="stick1" colspan="3">PERSONALE IN TURNO</td>`;
  for (const g of mesi) {
    html += `<td class="rpmese"></td>`;
    for (const t of g.turni) html += `<td class="num">${effettiviTurno(s, persone, t, cmap)}</td>`;
  }
  html += `<td class="tot" colspan="7"></td></tr>`;
  html += `<tr class="effettivi mstre"><td class="stick1" colspan="3">PERSONALE MESTRE (senza rinforzi)</td>`;
  for (const g of mesi) {
    html += `<td class="rpmese"></td>`;
    for (const t of g.turni) {
      let n = 0;
      for (const p of persone) {
        if (!attivoIn(p, t.date)) continue;
        if (!presente(s, p, t, cmap)) continue;
        if ((cmap[cellKey(p.id, t.date)] || "") === "R") continue;
        n++;
      }
      html += `<td class="num">${n}</td>`;
    }
  }
  html += `<td class="tot" colspan="7"></td></tr>`;
  html += "</tbody>";
  tb.innerHTML = html;

  // interazione celle
  tb.querySelectorAll("[data-cella]").forEach(td => td.addEventListener("click", () => {
    const [pid, date] = td.dataset.cella.split("|");
    menuCausale(td, pid, date);
  }));
  tb.querySelectorAll("[data-eccez]").forEach(td => td.addEventListener("click", () => {
    const [pid, mese] = td.dataset.eccez.split("|");
    menuEccezioneRp(td, pid, mese);
  }));
  tb.querySelectorAll("[data-nome]").forEach(td => td.addEventListener("click", () => {
    menuNomeCausale(td, td.dataset.nome);
  }));
  tb.querySelectorAll("th[data-mese]").forEach(th => th.addEventListener("click", () => {
    th.scrollIntoView({ behavior: "smooth", inline: "start", block: "start" });
  }));
}

function vIsRP(s, p, t, cmap) {
  const v = valoreCella(s, p, t, cmap);
  return v === "RP";
}

function totHead(labels) {
  return labels.map(l => `<th class="hcell">${l}</th>`).join("");
}

function menuCausale(anchor, pid, date) {
  chiudiMenu();
  const menu = document.createElement("div");
  menu.className = "menu-causale";
  menu.style.left = Math.min(anchor.getBoundingClientRect().left, window.innerWidth - 180) + "px";
  menu.style.top = anchor.getBoundingClientRect().bottom + window.scrollY + 2 + "px";
  const opzioni = ["", ...Object.keys(CAUSALI).filter(c => c !== "RP")];
  menu.innerHTML = opzioni.map(c =>
    `<button data-c="${c}">${c === "" ? "▪ vuoto (in turno)" : c + " — " + CAUSALI[c].label}</button>`).join("");
  document.body.appendChild(menu);
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    store.setCausale(anno(), pid, date, b.dataset.c);
    chiudiMenu();
    renderPresenze();
  });
}

function menuEccezioneRp(anchor, pid, mese) {
  chiudiMenu();
  const menu = document.createElement("div");
  menu.className = "menu-causale";
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.min(r.left, window.innerWidth - 200) + "px";
  menu.style.top = (r.bottom + window.scrollY + 2) + "px";
  menu.innerHTML = `<p class="menu-titolo">RP di ${MESI[Number(mese.slice(5)) - 1]} — solo per questo mese</p>` +
    SLOT.map(a => `<button data-rp="${a}">${a}</button>`).join("") +
    `<button data-rp="" class="ripristina">Rimuovi eccezione (torna all'RP definitivo)</button>`;
  document.body.appendChild(menu);
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rp]");
    if (!b) return;
    store.setEccezioneMese(pid, mese, b.dataset.rp || null);
    chiudiMenu();
    renderPresenze();
  });
}

// assegna una causale su un periodo, dal menu sulla cella del nome
function menuNomeCausale(anchor, pid) {
  chiudiMenu();
  const menu = document.createElement("div");
  menu.className = "menu-causale";
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.min(r.left, window.innerWidth - 260) + "px";
  menu.style.top = (r.bottom + window.scrollY + 2) + "px";
  menu.innerHTML = `<p class="menu-titolo">Causale per un periodo — ${anchor.textContent.trim()}</p>` +
    Object.keys(CAUSALI).filter(c => c !== "RP").map(c =>
      `<button data-c="${c}">${c} — ${CAUSALI[c].label}</button>`).join("") +
    `<button data-c="" class="ripristina">▪ vuoto (cancella le causali del periodo)</button>`;
  document.body.appendChild(menu);
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-c]");
    if (!b) return;
    const codice = b.dataset.c;
    const a = anno();
    const da = prompt(`Dal (AAAA-MM-GG) — vuoto per inizio anno ${a}:`, `${a}-01-01`);
    if (da === null) return;
    const al = prompt(`Al (AAAA-MM-GG) — vuoto per fine anno ${a}:`, `${a}-12-31`);
    if (al === null) return;
    const daIso = da || `${a}-01-01`, alIso = al || `${a}-12-31`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(daIso) || !/^\d{4}-\d{2}-\d{2}$/.test(alIso)) { alert("Date non valide (formato AAAA-MM-GG)."); return; }
    let n = 0;
    for (const t of turniAnno(a)) {
      if (t.date < daIso || t.date > alIso) continue;
      store.setCausale(a, pid, t.date, codice);
      n++;
    }
    chiudiMenu();
    alert(n ? `Causale "${codice || "rimossa"}" applicata a ${n} turni (dal ${daIso} al ${alIso}).` : "Nessun turno in quel periodo.");
    renderPresenze();
  });
}

function chiudiMenu() {
  document.querySelectorAll(".menu-causale").forEach(m => m.remove());
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-causale") && !e.target.closest("[data-cella]") &&
      !e.target.closest("[data-eccez]") && !e.target.closest("[data-nome]")) chiudiMenu();
});

// toggle "solo attivi"
export function bindPresenze() {
  document.addEventListener("change", (e) => {
    if (e.target.id === "solo-attivi") {
      soloAttivi = e.target.checked;
      renderPresenze();
    }
  });
}
