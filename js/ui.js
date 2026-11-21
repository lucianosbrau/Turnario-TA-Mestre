// Interfaccia utente: pagina principale (Personale) e pagina Presenze (lenzuolo).
import { APP_VERSION, CAUSALI, SLOT, SLOT_COLOR, GRADI, GRADO_ORDER, AUTISTA, SPEC_FIELDS, MESI } from "./config.js";
import * as store from "./store.js";
import * as sync from "./sync.js";
import * as lock from "./lock.js";
import { turniAnno, attivoIn, rpEffettivo, valoreCella, presente, presenteSede, effettiviTurno, isoToIt, todayIso, cellKey } from "./engine.js";

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
  $("#btn-so").addEventListener("click", () => { location.hash = "#so"; });
  $("#btn-so-rinforzo").addEventListener("click", () => { apriSoRinforzi(); });
  $("#btn-so-elimina").addEventListener("click", () => { apriSoElimina(); });
  $("#btn-so-home").addEventListener("click", () => { location.hash = ""; mostraPagina(); });
  $("#btn-home").addEventListener("click", () => { location.hash = "#"; });
  $("#btn-export").addEventListener("click", esporta);
  $("#btn-cancella-persona").onclick = apriCancellaPersona;
  $("#btn-import").addEventListener("click", () => $("#file-import").click());
  $("#file-import").addEventListener("change", importa);
  $("#btn-cambia-pass").onclick = async () => {
    const vecchia = prompt("Password attuale:");
    if (vecchia === null) return;
    const nuova = prompt("Nuova password (minimo 4 caratteri):");
    if (nuova === null) return;
    try {
      await lock.cambiaPassword(vecchia, nuova);
      alert("Password aggiornata.");
    } catch (e) { alert(e.message); }
  };
  $("#btn-cambio-rp").onclick = apriCambioRp;
  $("#btn-ripristina").onclick = apriRipristina;
  function apriRipristina() {
    const lista = store.listaSnapshots();
    $("#form-persona").innerHTML = `
      <h3>Copie di sicurezza</h3>
      <p class="aiuto">Ogni volta che l'archivio viene aggiornato o scaricato dal cloud, la copia precedente viene messa da parte qui. Scegli quella da ripristinare: l'attuale verra' sostituita.</p>
      <div class="canc-lista">
        ${lista.length ? lista.map((s, i) => `
          <label class="canc-riga">
            <input type="radio" name="snap" value="${i}" ${i === lista.length - 1 ? "checked" : ""}>
            ${new Date(s.t).toLocaleString("it-IT")} — ${s.nPers} persone in archivio
          </label>`).join("")
          : `<p class="aiuto">Nessuna copia archiviata in questo browser.</p>`}
      </div>
      <div class="azioni-form">
        <button id="snap-rip" class="verde">Ripristina la copia selezionata</button>
        <button id="fp-annulla">Chiudi</button>
      </div>`;
    $("#modale").style.display = "flex";
    $("#fp-annulla").onclick = chiudiModale;
    const sel = () => {
      const r = $("#form-persona").querySelector('input[name="snap"]:checked');
      return r ? parseInt(r.value, 10) : -1;
    };
    $("#snap-rip").onclick = () => {
      const i = sel();
      if (i < 0) { alert("Scegli una copia dall'elenco."); return; }
      if (!confirm("Confermi il ripristino? L'archivio attuale verra' sostituito dalla copia scelta.")) return;
      if (store.ripristinaDaSnapshot(i)) {
        chiudiModale();
        alert("Copia di sicurezza ripristinata.");
        render();
      } else {
        alert("Ripristino non riuscito.");
      }
    };
  }
  sync.onStatus(mostraStatoSync);
  aggiornaPannelloSync();
  $("#chiudi-modale").addEventListener("click", chiudiModale);
  $("#modale").addEventListener("click", (e) => {
    if (e.target.id === "modale") chiudiModale();   // clic sul fondo scuro chiude la scheda
  });
  window.addEventListener("hashchange", mostraPagina);
  mostraPagina();
  sync.avvio(
    (stato) => { try { store.applicaStatoCloud(stato); render(); } catch (e) { alert("Archivio cloud non valido: uso quello locale."); } },
    () => JSON.parse(localStorage.getItem("turnario-ta-v1") || "null"),
    () => store.isSeedFresh()
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
          () => JSON.parse(localStorage.getItem("turnario-ta-v1") || "null"),
          () => store.isSeedFresh()
        );
        aggiornaPannelloSync();
        renderHome();
      } else alert("Accesso non riuscito: controlla email e password (l'account deve essere confermato su Supabase).");
    };
  }
}

function mostraPagina() {
  const pagina = location.hash;
  // gestisce l'attributo hidden (non solo lo stile), altrimenti il browser
  // continua a non mostrare la sezione
  $("#pagina-home").toggleAttribute("hidden", pagina !== "");
  $("#pagina-presenze").toggleAttribute("hidden", pagina !== "#presenze");
  $("#pagina-so").toggleAttribute("hidden", pagina !== "#so");
  if (pagina === "#presenze") renderPresenze();
  else if (pagina === "#so") renderSo();
  else renderHome();
}

function render() {
  if (location.hash === "#presenze") renderPresenze();
  else if (location.hash === "#so") renderSo();
  else renderHome();
}

/* ---------------- HOME: gestione personale ---------------- */

function renderHome() {
  $("#anno").value = anno();
  const s = store.getState();
  const oggi = todayIso();
  const persone = ordinaPersone(soloAttiviHome ? s.personale.filter(p => attivoIn(p, oggi)) : s.personale);
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
}

/* ---------------- SALA OPERATIVA: lenzuolo solo SO115 + rinforzi esterni ---------------- */

function renderSo() {
  const s = store.getState();
  const a = anno();
  const turni = turniAnno(a);
  const cmap = store.mappaCausali(a);
  $("#so-anno").textContent = a;

  const inizioAnno = `${a}-01-01`, fineAnno = `${a}-12-31`;
  const sky = s.personale.filter(p => p.spec?.SO115 === "Si" && (!p.dal || p.dal <= fineAnno) && (!p.al || p.al >= inizioAnno));
  let persone = ordinaPersone(sky);
  if ($("#so-solo-attivi")?.checked === true) persone = persone.filter(p => attivoIn(p, todayIso()));

  const mesi = [];
  for (const t of turni) {
    let g = mesi.find(m => m.mese === t.month);
    if (!g) { g = { mese: t.month, turni: [] }; mesi.push(g); }
    g.turni.push(t);
  }

  const tb = $("#lenzuolo-so");
  let html = "<thead>";
  html += `<tr><th class="stick1" rowspan="4">Persona</th><th class="stick2" rowspan="4">Grado</th><th class="stick3" rowspan="4">Aut</th>`;
  for (const g of mesi) html += `<th class="mese" colspan="${g.turni.length + 2}" data-mese="${g.mese}">${MESI[Number(g.mese.slice(5)) - 1].toUpperCase()}</th>`;
  html += `<th class="tot" colspan="1">TOT.</th></tr>`;
  html += "<tr>" + mesi.map(g => `<th class="hcell rpm">RP</th>` + g.turni.map(t => `<th class="hcell">${Number(t.date.slice(8))}</th>`).join("") + `<th class="hcell tot">Turni SO</th>`).join("") + totHead(["SO"]) + "</tr>";
  html += "<tr>" + mesi.map(g => `<th class="hcell rpm"></th>` + g.turni.map(t => `<th class="hcell fase" style="background:${SLOT_COLOR[t.slot]}">${t.phase}</th>`).join("") + `<th class="hcell tot"></th>`).join("") + `<th class="hcell tot"></th></tr>`;
  html += "<tr>" + mesi.map(g => `<th class="hcell rpm"></th>` + g.turni.map(t => `<th class="hcell slot" style="background:${SLOT_COLOR[t.slot]}">${t.slot}</th>`).join("") + `<th class="hcell tot"></th>`).join("") + `<th class="hcell tot"></th></tr>`;
  html += "</thead><tbody>";

  // righe: personale SO115 di Mestre, poi (con divisione) i rinforzi esterni
  const rigaPersona = (p, esterno, separatore) => {
    let r = `<tr class="${attivoIn(p, todayIso()) || esterno ? "" : "gray"}${separatore ? " so-separatore" : ""}">`;
    r += `<td class="stick1 nome">${esterno ? "\u25b8 " : ""}${p.cognome} ${p.nome}</td>`;
    r += `<td class="stick2">${p.grado || ""}</td>`;
    r += `<td class="stick3">${!esterno ? (p.autista || "") : ""}</td>`;
    let totSO = 0;
    for (const g of mesi) {
      const rpMese = esterno ? (p.rp || "") : rpEffettivo(s, p.id, g.mese + "-01");
      r += `<td class="rpmese">${rpMese}</td>`;
      let turniFatti = 0;
      for (const t of g.turni) {
        let v = esterno ? (cmap[cellKey(p.id, t.date)] || "") : valoreCella(s, p, t, cmap);
        if (esterno && !v && p.rp && t.slot === p.rp) v = "RP";
        r += `<td class="cella v-${v} col${t.slot} ${!esterno && !attivoIn(p, t.date) ? "gray" : ""}" data-cella="${p.id}|${t.date}" title="${t.date} ${t.phase} ${t.slot}">${v === "RP" ? "RP" : v}</td>`;
        if (v === "SO") { turniFatti++; totSO++; }
      }
      r += `<td class="tot turni-mese">${turniFatti}</td>`;
    }
    r += `<td class="tot" title="Turni SO nell'anno">${totSO}</td>`;
    return r + "</tr>";
  };

  persone.forEach(p => { html += rigaPersona(p, false, false); });
  const esterni = (s.soRinforzi || []).slice();
  esterni.forEach((p, i) => { html += rigaPersona(p, true, i === 0 && persone.length > 0); });
  // conteggio in basso: per ogni turno, quanti operatori hanno la causale SO
  const tutti = [...persone, ...esterni];
  html += `<tr class="effettivi"><td class="stick1" colspan="3">TURNI SO (operatori in sala)</td>`;
  for (const g of mesi) {
    html += `<td class="rpmese"></td>`;
    for (const t of g.turni) {
      let n = 0;
      for (const p of tutti) {
        if (!esterni.includes(p) && !attivoIn(p, t.date)) continue;
        if ((cmap[cellKey(p.id, t.date)] || "") === "SO") n++;
      }
      html += `<td class="num ${n < 3 ? "critico" : ""}">${n}</td>`;
    }
  }
  html += `<td class="tot"></td></tr>`;
  html += "</tbody>";
  tb.innerHTML = html;

  tb.querySelectorAll("[data-cella]").forEach(td => td.addEventListener("click", () => {
    const [pid, date] = td.dataset.cella.split("|");
    menuCausale(td, pid, date, "so");
  }));
  tb.querySelectorAll("th[data-mese]").forEach(th => th.addEventListener("click", () => {
    th.scrollIntoView({ behavior: "smooth", inline: "start", block: "start" });
  }));

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
      <label>Capo turno<select name="capoTurno">
        <option value="No" ${!p.capoTurno || p.capoTurno === "No" ? "selected" : ""}>No</option>
        <option value="Si" ${p.capoTurno === "Si" ? "selected" : ""}>Si</option>
      </select></label>
      <label>Dal (entratə nel turno)<input type="date" name="dal" value="${p.dal || ""}"></label>
      <label>Al (uscitə dal turno — lascia vuoto se in servizio)<input type="date" name="al" value="${p.al || ""}"></label>
    </div>
    <fieldset class="spec"><legend>Specializzazioni</legend>${specHtml}
      <label>Autista
        <select name="spec-Autista">
          <option value="" ${!p.autista ? "selected" : ""}></option>
          ${AUTISTA.map(a => `<option ${a === p.autista ? "selected" : ""}>${a}</option>`).join("")}
        </select>
      </label>
    </fieldset>
    <div class="azioni-form">
      <button id="fp-salva">Salva</button>
      <button id="fp-annulla">Annulla</button>
      ${id ? `<button id="fp-elimina" class="distruttivo">Elimina persona e sue presenze</button>` : ""}
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  $("#fp-salva").onclick = () => {
    const f = $("#form-persona");
    let cognome = f.querySelector('[name="cognome"]').value.trim();
    let nome = f.querySelector('[name="nome"]').value.trim();
    if (!cognome || !nome) { alert("Cognome e nome sono obbligatori."); return; }
    // se cognome+nome esiste gia' in archivio: se e' uscita dal turno offre di
    // recuperarla (riattivandola), altrimenti chiede di rinominare la nuova persona
    const esisteGia = (c, n) => store.getState().personale.some(p =>
      p.id !== id && (p.cognome || "").trim().toLowerCase() === c.toLowerCase() &&
      (p.nome || "").trim().toLowerCase() === n.toLowerCase());
    if (esisteGia(cognome, nome)) {
      const doppioni = store.getState().personale.filter(p =>
        p.id !== id && (p.cognome || "").trim().toLowerCase() === cognome.toLowerCase() &&
        (p.nome || "").trim().toLowerCase() === nome.toLowerCase());
      const usciti = doppioni.filter(p => !attivoIn(p, todayIso()));
      const attivi = doppioni.filter(p => attivoIn(p, todayIso()));
      if (usciti.length && !attivi.length) {
        const u = usciti[0];
        const rec = confirm(`Attenzione: in archivio c'è già ${cognome} ${nome}, uscita dal turno${u.al ? " il " + isoToIt(u.al) : ""}.
Vuoi recuperarla e renderla di nuovo in servizio? (Il suo storico di presenze resta intatto; con "Annulla" puoi invece inserirla con un nome differente.)`);
        if (rec) {
          u.al = null;
          store.save();
          chiudiModale();
          renderHome();
          alert(`${cognome} ${nome} è stata recuperata e ora è di nuovo in servizio.`);
          return;
        }
      }
      const vuoi = confirm(`Attenzione: in archivio esiste già una persona che si chiama ${cognome} ${nome}.
Se intendi inserire comunque questa persona, devi nominarla in modo differente. Vuoi continuare?`);
      if (!vuoi) return;
      let tent = prompt(`Cognome e nome differenti (cognome, spazio, poi nome):`, `${cognome} ${nome} (2)`);
      while (tent !== null) {
        const parti = tent.trim().split(/\s+/);
        if (parti.length < 2) {
          alert("Indica cognome e nome separati da uno spazio.");
          tent = prompt(`Cognome e nome differenti (cognome, spazio, poi nome):`, `${cognome} ${nome} (2)`);
          continue;
        }
        const nc = parti[0], nn = parti.slice(1).join(" ");
        if (esisteGia(nc, nn)) {
          alert(`Anche ${parti.join(" ")} esiste già in archivio: scegli un nominativo diverso.`);
          tent = prompt(`Cognome e nome differenti (cognome, spazio, poi nome):`, tent.trim());
          continue;
        }
        cognome = nc; nome = nn;
        break;
      }
      if (tent === null) return;
    }
    const dati = {
      cognome,
      nome,
      grado: f.querySelector('[name="grado"]').value,
      rp: f.querySelector('[name="rp"]').value,
      capoTurno: f.querySelector('[name="capoTurno"]').value,
      autista: f.querySelector('[name="spec-Autista"]').value,
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
    <p class="aiuto">Le persone selezionate vengono rimosse dall'archivio insieme alle loro presenze e al loro RP.
    Se invece qualcuno e' solo uscito dal turno, meglio mettergli una data di uscita (dal pulsante Modifica): le presenze restano nello storico.</p>
    <div class="canc-lista">
      ${persone.map(p => `<label class="canc-riga"><input type="checkbox" value="${p.id}"> ${p.cognome} ${p.nome} (${p.grado})</label>`).join("")}
    </div>
    <div class="azioni-form">
      <button id="canc-tutti-sel" class="aiuto-btn">Seleziona tutti</button>
      <button id="canc-ok" class="distruttivo">Cancella definitivamente i selezionati</button>
      <button id="fp-annulla">Annulla</button>
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  $("#canc-tutti-sel").onclick = () => {
    const boxes = [...$("#form-persona").querySelectorAll('.canc-lista input[type="checkbox"]')];
    const tuttiGia = boxes.every(b => b.checked);
    boxes.forEach(b => b.checked = !tuttiGia);
  };
  $("#canc-ok").onclick = () => {
    const selezionati = [...$("#form-persona").querySelectorAll('.canc-lista input[type="checkbox"]:checked')]
      .map(b => b.value);
    if (!selezionati.length) { alert("Nessuna persona selezionata: metti una spunta accanto ai nominativi da cancellare."); return; }
    const nomi = selezionati.map(id => {
      const p = s.personale.find(x => x.id === id);
      return p ? `${p.cognome} ${p.nome}` : "";
    }).filter(Boolean);
    if (confirm(`Confermi la cancellazione di ${nomi.length === 1 ? "1 persona" : nomi.length + " persone"}: ${nomi.join(", ")}? L'operazione elimina anche tutte le loro presenze e non si puo' annullare.`)) {
      for (const id of selezionati) store.deletePerson(id);
      chiudiModale();
      renderHome();
      alert(`Cancellat${nomi.length === 1 ? "a 1 persona" : "e " + nomi.length + " persone"}.`);
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
  $("#form-persona").innerHTML = `
    <h3>Esporta</h3>
    <p class="aiuto">Scegli cosa esportare in <b>Excel</b> (si apre in Excel; le righe e i riepiloghi sono
    quelli dell'anno selezionato in alto). Il backup <b>JSON</b> resta quello completo di tutto l'archivio,
    da usare per l'import.</p>
    <div class="canc-lista">
      <label class="canc-riga"><input type="checkbox" id="exp-presenze" checked> Foglio Presenze (lenzuolo e conteggi)</label>
      <label class="canc-riga"><input type="checkbox" id="exp-so" checked> Foglio Sala Operativa (operatori SO115 e rinforzi esterni)</label>
    </div>
    <div class="azioni-form">
      <button id="exp-ok" class="verde">Esporta Excel</button>
      <button id="exp-json">Esporta backup JSON</button>
      <button id="fp-annulla">Chiudi</button>
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  $("#exp-ok").onclick = () => {
    const pagine = [];
    if ($("#exp-presenze")?.checked) pagine.push("presenze");
    if ($("#exp-so")?.checked) pagine.push("so");
    if (!pagine.length) { alert("Scegli almeno un foglio (Presenze o Sala Operativa)."); return; }
    const xml = esportaExcel(pagine);
    const blob = new Blob([xml], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `turnario-${anno()}-esportazione.xml`;
    a.click();
    chiudiModale();
  };
  $("#exp-json").onclick = () => {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `turnario-ta-backup-${todayIso()}.json`;
    a.click();
    chiudiModale();
  };
}

/* ---- esportazione Excel (XML nativo di Excel, nessuna libreria) ---- */

function xmlEsc(t) {
  return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function xmlCella(v, stile) {
  if (v === "" || v === null || v === undefined) return "<Cell/>";
  const s = stile ? ` ss:StyleID="${stile}"` : "";
  const isNum = typeof v === "number";
  return `<Cell${s}><Data ss:Type="${isNum ? "Number" : "String"}">${xmlEsc(v)}</Data></Cell>`;
}

function grpcell(v) {
  const isNum = typeof v === "number";
  return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${xmlEsc(v)}</Data></Cell>`;
}

function esportaExcel(pagine) {
  const s = store.getState();
  const a = anno();
  const turni = turniAnno(a);
  const cmap = store.mappaCausali(a);
  const oggi = todayIso();
  const mesi = [];
  for (const t of turni) {
    let g = mesi.find(m => m.mese === t.month);
    if (!g) { g = { mese: t.month, turni: [] }; mesi.push(g); }
    g.turni.push(t);
  }

  const foglioRighe = [];

  if (pagine.includes("presenze")) {
    const righe = [];
    // testata: mesi
    righe.push(["Persona", "Grado", "Aut", ...mesi.flatMap(g => [g.mese, ...g.turni.map(() => "")]), "L", "L estive", "R"]);
    righe.push(["", "", "", ...mesi.flatMap(g => ["RP"].concat(g.turni.map(t => Number(t.date.slice(8))))), "", "", ""]);
    righe.push(["", "", "", ...mesi.flatMap(g => [""].concat(g.turni.map(t => t.phase))), "", "", ""]);
    righe.push(["", "", "", ...mesi.flatMap(g => [""].concat(g.turni.map(t => t.slot))), "", "", ""]);
    const inizioAnno = `${a}-01-01`, fineAnno = `${a}-12-31`;
    let personeVisibili = ordinaPersone(s.personale.filter(p => (!p.dal || p.dal <= fineAnno) && (!p.al || p.al >= inizioAnno)));
    if (soloAttivi) personeVisibili = personeVisibili.filter(p => attivoIn(p, oggi));
    for (const p of personeVisibili) {
      const riga = [`${p.cognome} ${p.nome}`, p.grado || "", p.autista || ""];
      let totL = 0, totR = 0, totLE = 0;
      const mesiEstivi = [`${a}-06`, `${a}-07`, `${a}-08`, `${a}-09`];
      for (const g of mesi) {
        riga.push(rpEffettivo(s, p.id, g.mese + "-01"));
        for (const t of g.turni) {
          const v = valoreCella(s, p, t, cmap);
          riga.push(v === "RP" ? "RP" : v);
          if (!attivoIn(p, t.date)) continue;
          const c = cmap[cellKey(p.id, t.date)] || "";
          if (c === "L") { totL++; if (mesiEstivi.includes(g.mese)) totLE++; }
          if (c === "R") totR++;
        }
      }
      riga.push(totL, totLE, totR);
      righe.push(riga);
    }
    // righe di conteggio
    const GRADI_CAPI = ["CS", "CSE", "CR", "CRE"];
    const ctr = [
      ["PERSONALE IN TURNO", (p, t) => presente(s, p, t, cmap)],
      ["PERSONALE MESTRE (senza rinforzi)", (p, t) => presente(s, p, t, cmap) && (cmap[cellKey(p.id, t.date)] || "") !== "R"],
      ["ASSENZE TOTALI (RP + L)", (p, t) => { const c = cmap[cellKey(p.id, t.date)] || ""; return c === "L" || (c === "" && rpEffettivo(s, p.id, t.date) === t.slot); }],
      ["LICENZE (L)", (p, t) => (cmap[cellKey(p.id, t.date)] || "") === "L"],
      ["RINFORZI (R)", (p, t) => (cmap[cellKey(p.id, t.date)] || "") === "R"],
      ["IN RP (riposo)", (p, t) => { const c = cmap[cellKey(p.id, t.date)] || ""; return c === "" && rpEffettivo(s, p.id, t.date) === t.slot; }],
      ["AUTISTI (3° e 4°)", (p, t) => (p.autista === "3°" || p.autista === "4°") && presenteSede(s, p, t, cmap)],
      ["CAPI", (p, t) => GRADI_CAPI.includes(p.grado) && presenteSede(s, p, t, cmap)],
      ["AS presenti", (p, t) => p.spec?.AS === "Si" && presenteSede(s, p, t, cmap)],
      ["AG presenti", (p, t) => p.spec?.AG === "Si" && presenteSede(s, p, t, cmap)],
      ["SO115 presenti", (p, t) => p.spec?.SO115 === "Si" && presenteSede(s, p, t, cmap)],
    ];
    for (const [lbl, fn] of ctr) {
      const riga = [lbl, "", ""];
      for (const g of mesi) {
        riga.push("");
        for (const t of g.turni) {
          let n = 0;
          for (const p of personeVisibili) if (attivoIn(p, t.date) && fn(p, t)) n++;
          riga.push(n);
        }
      }
      riga.push("", "", "");
      righe.push(riga);
    }
    foglioRighe.push({ nome: "Presenze", righe });
  }

  if (pagine.includes("so")) {
    const righe = [];
    righe.push(["Persona", "Grado", "Aut", "Esterno", ...mesi.flatMap(g => [g.mese, ...g.turni.map(() => "")]), "Tot SO"]);
    righe.push(["", "", "", "", ...mesi.flatMap(g => ["RP"].concat(g.turni.map(t => Number(t.date.slice(8))))), ""]);
    righe.push(["", "", "", "", ...mesi.flatMap(g => [""].concat(g.turni.map(t => t.phase))), ""]);
    righe.push(["", "", "", "", ...mesi.flatMap(g => [""].concat(g.turni.map(t => t.slot))), ""]);
    const inizioAnno = `${a}-01-01`, fineAnno = `${a}-12-31`;
    let persone = ordinaPersone(s.personale.filter(p => p.spec?.SO115 === "Si" && (!p.dal || p.dal <= fineAnno) && (!p.al || p.al >= inizioAnno)));
    if ($("#so-solo-attivi")?.checked === true) persone = persone.filter(p => attivoIn(p, oggi));
   const rigaPersona = (p, esterno) => {
      const riga = [`${p.cognome} ${p.nome}`, p.grado || "", !esterno ? (p.autista || "") : "", esterno ? "SI" : ""];
      let totSO = 0;
      for (const g of mesi) {
        riga.push(esterno ? (p.rp || "") : rpEffettivo(s, p.id, g.mese + "-01"));
        for (const t of g.turni) {
          let v = esterno ? (cmap[cellKey(p.id, t.date)] || "") : valoreCella(s, p, t, cmap);
          if (esterno && !v && p.rp && t.slot === p.rp) v = "RP";
          if (v === "SO") totSO++;
          riga.push(v === "RP" ? "RP" : v);
        }
      }
      riga.push(totSO);
      return riga;
    };
    for (const p of persone) righe.push(rigaPersona(p, false));
    righe.push(["--- Rinforzi esterni ---"]);
    for (const p of (s.soRinforzi || [])) righe.push(rigaPersona(p, true));
    foglioRighe.push({ nome: "Sala Operativa", righe });
  }

  const fogliXml = foglioRighe.map(f => {
    const righeXml = f.righe.map(r => `<Row>${r.map(v => grpcell(v)).join("")}</Row>`).join("");
    return `<Worksheet ss:Name="${xmlEsc(f.nome)}"><Table>${righeXml}</Table></Worksheet>`;
  }).join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="rp"><Font ss:Bold="1"/></Style>
 </Styles>
${fogliXml}
</Workbook>`;
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
let soloAttiviHome = true;
const evidenziati = new Set();   // righe evidenziate nel lenzuolo (per sessione)   // pagina principale: di default solo chi e' in servizio oggi

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
  html += `<th class="tot" colspan="3">TOT.</th></tr>`;

  html += "<tr>" + mesi.map(g => `<th class="hcell rpm">RP</th>` + g.turni.map(t => `<th class="hcell">${Number(t.date.slice(8))}</th>`).join("")).join("") + totHead(["L", "L estive", "R"]) + "</tr>";

  html += "<tr>" + mesi.map(g => `<th class="hcell rpm"></th>` + g.turni.map(t => `<th class="hcell fase" style="background:${SLOT_COLOR[t.slot]}">${t.phase}</th>`).join("")).join("") + `<th class="hcell tot" colspan="3"></th></tr>`;

  html += "<tr>" + mesi.map(g => `<th class="hcell rpm"></th>` + g.turni.map(t => `<th class="hcell slot" style="background:${SLOT_COLOR[t.slot]}">${t.slot}</th>`).join("")).join("") + `<th class="hcell tot" colspan="3"></th></tr>`;
  html += "</thead>";

  // corpo
  html += "<tbody>";
  for (const p of persone) {
    html += `<tr class="${attivoIn(p, todayIso()) ? "" : "gray"}${evidenziati.has(p.id) ? " evidenziata" : ""}">`;
    html += `<td class="stick1 nome" data-nome="${p.id}" title="Clicca per assegnare una causale su un periodo">${p.cognome} ${p.nome}<button class="evid-riga" data-evid="${p.id}" title="Evidenzia tutta la riga">${evidenziati.has(p.id) ? "▾" : "▸"}</button></td>`;
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
    for (const c of ["L", "R"]) {
      tot[c] = (s.causali?.[a] || []).filter(x => x.p === p.id && x.c === c).length;
    }
    const mesiEstivi = [`${a}-06`, `${a}-07`, `${a}-08`, `${a}-09`];
    tot["L estive"] = (s.causali?.[a] || []).filter(x => x.p === p.id && x.c === "L" && mesiEstivi.includes((x.d || "").slice(0, 7))).length;
    html += ["L", "L estive", "R"].map(k => {
      const cls = k === "L estive" ? (tot[k] > 8 ? " tot estive critico" : " tot estive") : " tot";
      return `<td class="${cls.trim()}">${tot[k]}</td>`;
    }).join("");
    html += "</tr>";
  }
  // righe di conteggio in basso
  html += `<tr class="effettivi"><td class="stick1" colspan="3">PERSONALE IN TURNO</td>`;
  for (const g of mesi) {
    html += `<td class="rpmese"></td>`;
    for (const t of g.turni) html += `<td class="num">${effettiviTurno(s, persone, t, cmap)}</td>`;
  }
  html += `<td class="tot" colspan="3"></td></tr>`;
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
  html += `<td class="tot" colspan="3"></td></tr>`;
  // righe di dettaglio per turno: licenze, rinforzi, riposi, autisti, capi e abilitazioni
  const GRADI_CAPI = ["CS", "CSE", "CR", "CRE"];
  const righeConteggio = [
    { etichetta: "ASSENZE TOTALI (RP + L)", classe: "assenzetot",
      filtro: (p, t) => {
        const c = cmap[cellKey(p.id, t.date)] || "";
        return c === "L" || (c === "" && rpEffettivo(s, p.id, t.date) === t.slot);
      },
      critico: (n, personeTurno) => n > Math.floor(0.27 * personeTurno),
      motivo: "assenze totali (RP+L) oltre il 27% del personale in turno" },
    { etichetta: "LICENZE (L)",
      filtro: (p, t) => (cmap[cellKey(p.id, t.date)] || "") === "L" },
    { etichetta: "RINFORZI (R)", filtro: (p, t) => (cmap[cellKey(p.id, t.date)] || "") === "R" },
    { etichetta: "IN RP (riposo)", filtro: (p, t) => {
        const c = cmap[cellKey(p.id, t.date)] || "";
        return c === "" && rpEffettivo(s, p.id, t.date) === t.slot;
      } },
    { etichetta: "AUTISTI (3° e 4°)",
      filtro: (p, t) => (p.autista === "3°" || p.autista === "4°") && presenteSede(s, p, t, cmap),
      critico: (n) => n < 5, motivo: "autisti presenti sotto 5" },
    { etichetta: "CAPI AUTISTI (3° e 4°)",
      filtro: (p, t) => (p.autista === "3°" || p.autista === "4°") && GRADI_CAPI.includes(p.grado) && presenteSede(s, p, t, cmap) },
    { etichetta: "CAPI",
      filtro: (p, t) => GRADI_CAPI.includes(p.grado) && presenteSede(s, p, t, cmap),
      critico: (n) => n < 3, motivo: "capi in turno sotto 3" },
    { etichetta: "AS presenti", filtro: (p, t) => p.spec?.AS === "Si" && presenteSede(s, p, t, cmap) },
    { etichetta: "AG presenti", filtro: (p, t) => p.spec?.AG === "Si" && presenteSede(s, p, t, cmap) },
    { etichetta: "SO115 presenti",
      filtro: (p, t) => p.spec?.SO115 === "Si" && presenteSede(s, p, t, cmap),
      critico: (n) => n < 5, motivo: "operatori SO115 presenti sotto 5" },
  ];
  const criticita = {};   // data -> [motivi]
  for (const riga of righeConteggio) {
    html += `<tr class="effettivi ${riga.classe || ""}"><td class="stick1" colspan="3">${riga.etichetta}</td>`;
    for (const g of mesi) {
      html += `<td class="rpmese"></td>`;
      for (const t of g.turni) {
        let n = 0, personeTurno = 0;
        for (const p of persone) {
          if (!attivoIn(p, t.date)) continue;
          personeTurno++;
          if (riga.filtro(p, t)) n++;
        }
        let crit = false;
        if (riga.critico && personeTurno > 0) crit = riga.critico(n, personeTurno);
        if (crit) (criticita[t.date] = criticita[t.date] || []).push(riga.motivo);
        html += `<td class="num ${crit ? "critico" : ""}">${n}</td>`;
      }
    }
    html += `<td class="tot" colspan="3"></td></tr>`;
  }
  html += "</tbody>";
  // avviso delle criticita' future (dopo oggi), chiudibile con la x
  criticitaStato = criticita;
  aggiornaAvvisoCriticita(a);
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
  tb.querySelectorAll("[data-evid]").forEach(b => b.addEventListener("click", (e) => {
    e.stopPropagation();
    const id = b.dataset.evid;
    if (evidenziati.has(id)) evidenziati.delete(id); else evidenziati.add(id);
    renderPresenze();
  }));
  tb.querySelectorAll("[data-nome]").forEach(td => td.addEventListener("click", () => {
    menuNomeCausale(td, td.dataset.nome);
  }));
  tb.querySelectorAll("th[data-mese]").forEach(th => th.addEventListener("click", () => {
    th.scrollIntoView({ behavior: "smooth", inline: "start", block: "start" });
  }));
}

let avvisoChiuso = false;          // chiuso con la x dall'utente
let avvisoDaCausale = false;       // il banner appare solo dopo l'inserimento di una causale
let criticitaStato = {};           // data -> [motivi], ricalcolato a ogni render del lenzuolo

function aggiornaAvvisoCriticita(annoSel) {
  const box = $("#avviso-criticita");
  if (!box) return;
  const nascondi = () => { box.setAttribute("hidden", ""); box.style.display = "none"; };
  if (avvisoChiuso || !avvisoDaCausale) { nascondi(); return; }
  const oggi = todayIso();
  const future = Object.keys(criticitaStato).filter(d => d > oggi).sort();
  if (!future.length) { nascondi(); return; }
  const lista = future.map(d => {
    const [aaa, mm, gg] = d.split("-");
    return `<li><b>${gg}/${mm}/${aaa}</b> — ${criticitaStato[d].join("; ")}</li>`;
  }).join("");
  box.innerHTML = `<div class="avviso-testo">
      <b>Attenzione — criticità future (${annoSel}):</b>
      <ul>${lista}</ul>
    </div>
    <button id="avviso-chiudi" title="Chiudi">×</button>`;
  box.removeAttribute("hidden");
  box.style.display = "flex";
  $("#avviso-chiudi").onclick = () => {
    avvisoChiuso = true;
    nascondi();
  };
}

function vIsRP(s, p, t, cmap) {
  const v = valoreCella(s, p, t, cmap);
  return v === "RP";
}

function totHead(labels) {
  return labels.map(l => `<th class="hcell ${l === "L estive" ? "estive" : ""}">${l}</th>`).join("");
}

// gestione del personale di rinforzo esterno (solo pagina Sala Operativa)
function apriSoRinforzi() {
  const s = store.getState();
  const esterni = s.soRinforzi || [];
  $("#form-persona").innerHTML = `
    <h3>Personale di rinforzo (Sala Operativa)</h3>
    <p class="aiuto">Queste persone non fanno parte della sede di Mestre: esistono <b>solo in questa pagina</b> e
    non compaiono da nessun'altra parte (non nel lenzuolo, non nei conteggi, non nella gestione del personale).</p>
    <div class="canc-lista">
      ${esterni.length ? esterni.map(p =>
        `<label class="canc-riga"><input type="checkbox" value="${p.id}"> ${p.cognome} ${p.nome} (RP ${p.rp || "-"})</label>`).join("")
        : `<p class="aiuto">Nessun rinforzo esterno inserito.</p>`}
    </div>
    <div class="griglia-form">
      <label>Cognome<input name="ext-cognome"></label>
      <label>Nome<input name="ext-nome"></label>
      <label>RP (salto turno)<select name="ext-rp">${SLOT.map(a => `<option ${a === "A1" ? "selected" : ""}>${a}</option>`).join("")}</select></label>
    </div>
    <div class="azioni-form">
      <button id="ext-add" class="verde">Aggiungi</button>
      <button id="fp-annulla">Chiudi</button>
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  $("#ext-add").onclick = () => {
    const f = $("#form-persona");
    const cognome = f.querySelector('[name="ext-cognome"]').value.trim();
    const nome = f.querySelector('[name="ext-nome"]').value.trim();
    if (!cognome || !nome) { alert("Cognome e nome sono obbligatori."); return; }
    store.addSoRinforzo({ cognome, nome, rp: f.querySelector('[name="ext-rp"]').value });
    chiudiModale();
    renderSo();
    alert(`Aggiunto ${cognome} ${nome} ai rinforzi della Sala Operativa.`);
  };
}

// eliminazione del personale di rinforzo esterno (Sala Operativa)
function apriSoElimina() {
  const s = store.getState();
  const esterni = s.soRinforzi || [];
  $("#form-persona").innerHTML = `
    <h3>Elimina personale di rinforzo</h3>
    <p class="aiuto">Rimuove gli esterni dalla Sala Operativa insieme a tutti i loro turni SO.
    Il personale di Mestre non si tocca da qui: per quello usare la gestione del personale della pagina principale.</p>
    <div class="canc-lista">
      ${esterni.length ? esterni.map(p =>
        `<label class="canc-riga"><input type="checkbox" value="${p.id}"> ${p.cognome} ${p.nome} (RP ${p.rp || "-"})</label>`).join("")
        : `<p class="aiuto">Nessun rinforzo esterno inserito.</p>`}
    </div>
    <div class="azioni-form">
      <button id="ext-del2" class="distruttivo">Elimina i selezionati</button>
      <button id="fp-annulla">Chiudi</button>
    </div>`;
  $("#modale").style.display = "flex";
  $("#fp-annulla").onclick = chiudiModale;
  if (esterni.length) $("#ext-del2").onclick = () => {
    const sel = [...$("#form-persona").querySelectorAll(".canc-lista input:checked")].map(b => b.value);
    if (!sel.length) { alert("Nessun rinforzo selezionato: metti una spunta accanto al nominativo da eliminare."); return; }
    const nomi = sel.map(id => { const p = esterni.find(x => x.id === id); return p ? `${p.cognome} ${p.nome}` : ""; }).filter(Boolean);
    if (confirm(`Confermi l'eliminazione di ${nomi.join(", ")}? Verranno cancellati anche tutti i loro turni SO.`)) {
      for (const id of sel) store.deleteSoRinforzo(id);
      chiudiModale();
      renderSo();
      alert(`Eliminat${sel.length === 1 ? "o 1 rinforzo esterno" : "i " + sel.length + " rinforzi esterni"}.`);
    }
  };
}

function menuCausale(anchor, pid, date, pagina) {
  chiudiMenu();
  const menu = document.createElement("div");
  menu.className = "menu-causale";
  menu.style.left = Math.min(anchor.getBoundingClientRect().left, window.innerWidth - 180) + "px";
  menu.style.top = anchor.getBoundingClientRect().bottom + window.scrollY + 2 + "px";
  // nella Sala Operativa l'unica causale ammessa e' SO
  const opzioni = pagina === "so" ? ["", "SO", "L", "Mis"] : ["", ...Object.keys(CAUSALI).filter(c => c !== "RP" && c !== "SO")];
  menu.innerHTML = opzioni.map(c =>
    `<button data-c="${c}">${c === "" ? "\u25aa vuoto (in turno)" : c + " \u2014 " + CAUSALI[c].label}</button>`).join("");
  document.body.appendChild(menu);
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    store.setCausale(anno(), pid, date, b.dataset.c);
    chiudiMenu();
    if (pagina === "so") { renderSo(); return; }
    avvisoDaCausale = true; avvisoChiuso = false;
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
  menu.style.left = Math.min(r.left, window.innerWidth - 320) + "px";
  menu.innerHTML = `<p class="menu-titolo">Causale per un periodo — ${anchor.textContent.trim()}</p>
    <label class="menu-campo">Causale
      <select id="nome-causale">
        ${Object.keys(CAUSALI).filter(c => c !== "RP" && c !== "SO").map(c =>
          `<option value="${c}">${c} — ${CAUSALI[c].label}</option>`).join("")}
        <option value="">▪ vuota (cancella le causali del periodo)</option>
      </select></label>
    <label class="menu-campo">Data di inizio (calendario)
      <input type="date" id="nome-causale-da" value="${todayIso().startsWith(anno()) ? todayIso() : anno() + "-01-01"}"></label>
    <label class="menu-campo">Turni consecutivi
      <input type="number" id="nome-causale-qta" min="1" step="1" value="1"></label>
    <button id="nome-causale-ok">Applica</button><button id="nome-causale-annulla" class="ripristina">Annulla</button>`;
  document.body.appendChild(menu);
  $("#nome-causale-annulla").onclick = chiudiMenu;
  $("#nome-causale-ok").onclick = () => {
    const codice = $("#nome-causale").value;
    const a = anno();
    const turni = turniAnno(a);
    const da = $("#nome-causale-da").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(da)) { alert("Data non valida."); return; }
    const nTurni = parseInt($("#nome-causale-qta").value, 10);
    if (!Number.isFinite(nTurni) || nTurni < 1) { alert("Il numero di turni deve essere almeno 1."); return; }
    // primo turno che cade alla data indicata o dopo
    let i0 = turni.findIndex(t => t.date >= da);
    if (i0 < 0) { chiudiMenu(); alert("Nessun turno a partire da quella data (fine anno)."); return; }
    if (i0 + nTurni > turni.length) { chiudiMenu(); alert(`Da quella data restano solo ${turni.length - i0} turni: riprova con un numero piu' basso.`); return; }
    for (let i = i0; i < i0 + nTurni; i++) store.setCausale(a, pid, turni[i].date, codice);
    chiudiMenu();
    const fino = turni[i0 + nTurni - 1];
    avvisoDaCausale = true; avvisoChiuso = false;
    alert(`Causale "${codice || "rimossa"}" su ${nTurni} turn${nTurni === 1 ? "o" : "i"}: da ${turni[i0].date} a ${fino.date}.`);
    renderPresenze();
  };
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
    if (e.target.id === "solo-attivi-home") {
      soloAttiviHome = e.target.checked;
      renderHome();
    }
    if (e.target.id === "so-solo-attivi") {
      renderSo();
    }
  });
}
