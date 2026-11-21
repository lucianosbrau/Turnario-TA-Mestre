// Collaudi statici: leggono il codice e verificano cio' che un DOM simulato
// non puo' vedere. Nati dall'incidente CSS v0.14.0->v0.15.2 (sostituzione in
// blocco che ruppe i selettori del lenzuolo: pagina rosa/rossa).
const fs = require('fs');
const path = require('path');
const REPO = process.env.TURNARIO_REPO || path.resolve(__dirname, "..");

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

const css = fs.readFileSync(REPO + "/css/style.css", 'utf8');
const config = fs.readFileSync(REPO + "/js/config.js", 'utf8');
const sw = fs.readFileSync(REPO + "/sw.js", 'utf8');
const ui = fs.readFileSync(REPO + "/js/ui.js", 'utf8');
const html = fs.readFileSync(REPO + "/index.html", 'utf8');

// (1) SELETTORI LENZUOLO/PRESenze E SO a coppie complete (incidente v0.15):
// ogni posizione che tratta #lenzuolo deve avere la controparte #lenzuolo-so
const nLen = (css.match(/#lenzuolo[\s,:.#[]/g) || []).length;
const nSo = (css.match(/#lenzuolo-so[\s,:.#[]/g) || []).length;
ok(nSo > 0, "(1a) esistono regole CSS per #lenzuolo-so (" + nSo + ")");
ok(nLen > 0, "(1b) esistono regole CSS per #lenzuolo (" + nLen + ")");
// ogni riga con #lenzuolo (senza -so) deve contenere anche #lenzuolo-so nella stessa riga
let righeSbagliate = 0;
for (const riga of css.split("\n")) {
  if (!riga.includes("#lenzuolo")) continue;
  if (!riga.includes("#lenzuolo")) continue;
  if (!riga.includes("#lenzuolo,") && riga.includes("#lenzuolo ") && !riga.includes("#lenzuolo-so") && riga.trim().endsWith("{")) {
    righeSbagliate++;
  }
  if (/#lenzuolo[^-]/.test(riga) && /#lenzuolo\b(?!-so)/.test(riga) && !riga.includes("#lenzuolo-so")) {
    righeSbagliate++;
  }
}
ok(righeSbagliate === 0, "(1c) nessuna regola del lenzuolo senza la coppia -so (0 rotte su " + nLen + ")");

// (2) coerenza APP_VERSION (config.js) con CACHE (sw.js): sempre uguali
const vApp = (config.match(/APP_VERSION\s*=\s*"([^"]+)"/) || [])[1];
const vCache = (sw.match(/CACHE\s*=\s*"([^"]+)"/) || [])[1];
ok(!!vApp && !!vCache, "(2) versione letta: app " + vApp + ", cache " + vCache);
ok(vApp && vCache && vCache.endsWith(vApp), "(2b) CACHE del service worker contiene la APP_VERSION (convenzione di rilascio)");

// (3) ogni id usato da ui.js ($("#id")) esiste in index.html
const ids = new Set();
for (const m of ui.matchAll(/\$\("#([A-Za-z0-9-]+)"\)/g)) ids.add(m[1]);
const esistenti = (x) => html.includes(`id="${x}"`) || ui.includes(`id="${x}"`) || ui.includes(`= "${x}"`);
const mancanti = [...ids].filter(id => !esistenti(id));
ok(mancanti.length === 0, "(3) tutti gli id usati dal JS esistono nell'HTML" + (mancanti.length ? " — MANCANTI: " + mancanti.join(", ") : " (" + ids.size + " verificati)"));

// (4) la causale SO non deve comparire nel menu causali di Presenze (solo SO)
// e le causali di Sala Operativa sono SO, L, Mis
const menu = /function menuCausale[\s\S]{0,900}?(?=function )|function menuCausale[\s\S]*/.exec(ui) || ["", ""];
const corpoMenu = (menu[0] || ui);
ok(corpoMenu.includes('pagina === "so" ? ["", "SO", "L", "Mis"]'), "(4) menu Sala Operativa: SO, L e Mis");
ok(corpoMenu.includes('c !== "RP" && c !== "SO"'), "(4b) menu Presenze: RP e SO escluse dalle opzioni");

// (5) colore L acceso con bordo nero (decisione utente)
ok(/v-L\s*\{[^}]*background:\s*#3fd14f[^}]*border:\s*2px solid #101010/.test(css.replace(/\n/g, " ")),
   "(5) CSS celle L: verde #3fd14f con bordo nero 2px");

// (6) gli script moduli esistono realmente e vengono caricati dall'HTML
for (const m of html.matchAll(/src="(js\/[a-z-]+\.js)"/g)) {
  ok(fs.existsSync(REPO + "/" + m[1]), "(6) esiste " + m[1]);
}

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
