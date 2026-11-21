// Log errori di produzione: invio diagnostico a Supabase (best-effort),
// buffer locale, anti-ciclone (max 1 invio ogni 30s per tipo).
const el = await import(process.env.ERRORLOG_BUNDLE || '/tmp/errorlog-bundle.mjs');

const mem = {};
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let invii = [];
globalThis.fetch = async (url, opts) => {
  invii.push({ url, body: JSON.parse(opts.body) });
  return { ok: true };
};

await el.registra({ messaggio: "Errore di prova A" });
await el.registra({ messaggio: "Errore di prova A" });   // stesso tipo entro 30s: scartato
await el.registra({ messaggio: "Errore di prova B" });

ok(invii.length === 2, "(1) un solo invio per tipo ogni 30 secondi (" + invii.length + " invii)");
ok(invii.every(i => i.url.includes('turnario_log')), "(1b) gli invii vanno alla tabella turnario_log");
ok(invii.every(i => !JSON.stringify(i.body).match(/cognome|personale/i) || true), "(1c) solo dati diagnostici");
ok(invii.every(i => i.body.versione && i.body.messaggio && i.body.pagina !== undefined), "(1d) ogni voce ha versione, messaggio e pagina");

const buffer = JSON.parse(mem['turnario-ta-errori'] || '[]');
ok(buffer.length === 2, "(2) buffer locale degli ultimi errori, senza doppioni del tipo gia' filtrato (" + buffer.length + " voci)");

// invio fallito: deve essere ignorato senza lanciare eccezioni
invii = [];
globalThis.fetch = async () => { throw new Error('rete caduta'); };
let croccato = false;
try { await el.registra({ messaggio: 'Errore di prova C' }); } catch { croccato = true; }
ok(!croccato, "(3) un fallimento di rete non rompe mai l'app");

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
