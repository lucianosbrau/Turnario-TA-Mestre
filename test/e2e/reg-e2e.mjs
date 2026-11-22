// COLLAUDI SU BROWSER VERO (punto 5): Chromium reale + service worker reale.
// Copre ciò che jsdom non può: registrazione/aggancio del service worker,
// aggiornamento della versione, funzionamento OFFLINE, e i COLORI COMPUTATI
// delle celle (il collaudo che avrebbe preso la "pagina rossa" del 2025).
// Due contesti = due PC che parlano con lo stesso "cloud" (intercettato a
// livello di rete: nessuna query al Supabase reale).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
const REPO = process.env.TURNARIO_REPO || path.resolve(new URL('.', import.meta.url).pathname, '../..');

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let playwright = null;
for (const candidato of ['playwright', process.env.PLAYWRIGHT_PATH || ''].filter(Boolean)) {
  try { playwright = (await import(candidato)).default; break; } catch {}
}
if (!playwright) {
  console.log('SKIP: playwright non installato (npm i -D playwright, poi npx playwright install chromium)');
  process.exit(0);
}

// ---- server statico del repo (il service worker richiede http://localhost)
const PORTA = 8123;
const server = http.createServer((req, res) => {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.join(REPO, p);
  if (!file.startsWith(REPO) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  const tipo = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORTA, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORTA}`;

// ---- il "cloud" condiviso tra i due PC (stato in memoria, qui nel collaudo)
const persona = (id, c) => ({ id, cognome: c, nome: 'X', grado: 'CS', rp: 'A1', capoTurno: 'No', dal: null, al: null, autista: '3°', spec: { SO115: 'Si' } });
let cloud = {
  stato: {
    personale: [persona('p1', 'ROSSI'), persona('p2', 'VERDI')],
    causali: { 2027: [{ p: 'p1', d: '2027-01-15', c: 'L' }] },
    soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 },
  },
  aggiornato_al: '2027-01-20T10:00:00.000Z',
};
let scrittureCloud = [];
const diagnostica = { leggi: 0, scrivi: 0, fallite: [], console: [], richieste: [] };

async function nuovoPC(nome) {
  const context = await browser.newContext();
  // seed dell'archivio di questo "PC"
  await context.addInitScript(([statoSeed]) => {
    // il PC "vergine" parte dal seed: il cloud dovra' avere la meglio
    localStorage.setItem('turnario-ta-v1', JSON.stringify(statoSeed));
    const fOriginale = window.fetch.bind(window);
    window.fetch = async (url, opts) => {
      console.log('[FETCH] ' + (opts && opts.method || 'GET') + ' ' + url + ' :: ' + (opts && opts.body ? String(opts.body).slice(0, 80) : ''));
      const r = await fOriginale(url, opts);
      const clone = r.clone();
      clone.json().then(j => console.log('[FETCH->] ' + String(url).split('/').pop() + ' :: ' + JSON.stringify(j).slice(0, 120))).catch(() => {});
      return r;
    };
  }, [{
    personale: [persona('s1', 'SEED-' + nome)],
    causali: {}, soRinforzi: [], rpStorico: [], exceptions: [], settings: { anno: 2027 },
  }]);
  // intercettazione di rete: le chiamate a Supabase non lasciano il collaudo
  await context.route('**/rpc/turnario_leggi', (route) => { diagnostica.leggi++; return route.fulfill({ json: cloud }); });
  await context.route('**/rpc/turnario_scrivi', (route) => {
    diagnostica.scrivi++;
    const p = JSON.parse(route.request().postData());
    scrittureCloud.push(p.p_stato);
    cloud = { stato: p.p_stato, aggiornato_al: new Date().toISOString() };
    return route.fulfill({ json: true });
  });
  await context.route('**/turnario_log', (route) => route.fulfill({ json: {} }));
  // NB: nessuna regola generica: le route piu' recenti hanno precedenza in
  // Playwright e una regola '**supabase.co**' OScurava quelle delle RPC.
  const page = await context.newPage();
  const errori = [];
  page.on('pageerror', (e) => errori.push(String(e)));
  page.on('requestfailed', (r) => diagnostica.fallite.push(r.url() + ' :: ' + (r.failure() || {}).errorText));
  page.on('request', (r) => { if (r.url().includes('supabase')) diagnostica.richieste.push(r.method() + ' ' + r.url()); });
  page.on('console', (m) => { if (m.text().includes('FETCH') || m.type() === 'error') diagnostica.console.push(m.text()); });
  return { context, page, errori };
}

async function sbloccaEPrendiPassword(page) {
  await page.goto(BASE + '/index.html?k=CODICE-E2E-12345678901234');
  await page.locator('#blocco-pass').fill('test1234');
  const ripeti = page.locator('#blocco-pass2');
  if (await ripeti.count()) await ripeti.fill('test1234');   // solo al primo avvio
  await page.locator('#blocco-ok').click();
  await page.locator('#pagina-home').waitFor({ state: 'visible', timeout: 15000 });
}

async function apriPresenze(page) {
  await page.locator('#btn-presenze').click();
  await page.locator('#lenzuolo tbody tr').first().waitFor({ timeout: 10000 });
}

const browser = await playwright.chromium.launch();
try {
  // ---------- E1: apertura, password, arrivo del cloud sul PC vergine
  const pcA = await nuovoPC('A');
  await sbloccaEPrendiPassword(pcA.page);
  await sleep(2000);
  const badge = await pcA.page.locator('#badge-sync').textContent();
  ok(badge.includes('Sincronizzato'), '(E1) PC-A vergine sincronizza col cloud al primo avvio: "' + badge + '"');
  const badgeTitle = await pcA.page.locator('#badge-sync').getAttribute('title');
  const locali = await pcA.page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('turnario-ta-v1'));
    return { persone: (st.personale || []).map(p => p.cognome), visto: st.__cloudVisto, mut: st.__aggiornatoAl };
  });
  console.log('   [diag] leggi=' + diagnostica.leggi + ' scrivi=' + diagnostica.scrivi + ' scritti=' + JSON.stringify(scrittureCloud.map(s => (s.personale || []).map(p => p.cognome))) + ' locali=' + JSON.stringify(locali) + ' badgeTitle="' + badgeTitle + '"');
  console.log('   [console] ' + diagnostica.console.slice(0, 12).join('\n   [console] '));
  const righeHome = await pcA.page.locator('#tabella-personale tbody tr').count();
  ok(righeHome === 2, '(E1b) il seed NON ha vinto: le 2 persone del cloud sono in Home');

  // nessun errore JS
  ok(pcA.errori.length === 0, '(E1c) nessun errore JavaScript durante il primo avvio');

  // ---------- E2: il service worker e' davvero attivo (dopo un ricaricamento)
  await pcA.page.reload();
  await sbloccaEPrendiPassword(pcA.page);
  const swAttivo = await pcA.page.evaluate(() => !!navigator.serviceWorker?.controller);
  ok(swAttivo, '(E2) il service worker controlla la pagina (browser vero, non simulato)');

  // ---------- E3: colori COMPUTATI delle celle (il collaudo della "pagina rossa")
  await apriPresenze(pcA.page);
  const cellaL = pcA.page.locator('[data-cella="p1|2027-01-15"]');
  const bg = await cellaL.evaluate((el) => getComputedStyle(el).backgroundColor);
  const bordo = await cellaL.evaluate((el) => getComputedStyle(el).borderTopWidth + ' ' + getComputedStyle(el).borderTopStyle);
  ok(bg === 'rgb(63, 209, 79)', '(E3) cella L: verde #3fd14f COMPUTATO dal browser (trovato ' + bg + ')');
  ok(bordo.startsWith('2px'), '(E3b) cella L: bordo nero 2px computato (trovato ' + bordo + ')');
  const cellaRP = pcA.page.locator('[data-cella="p2|2027-01-15"]');
  const bgRP = await cellaRP.evaluate((el) => getComputedStyle(el).backgroundColor);
  ok(bgRP !== 'rgb(255, 0, 0)' && bgRP !== 'rgb(255, 192, 203)', '(E3c) le celle normali NON sono rosa/rosse (trovato ' + bgRP + ')');

  // ---------- E4: OFFLINE vero (service worker + cache), modifica e rispedizione
  await pcA.context.setOffline(true);
  await pcA.page.reload();
  await sbloccaEPrendiPassword(pcA.page);
  const offlineOk = await pcA.page.locator('#tabella-personale tbody tr').count();
  ok(offlineOk >= 1, "(E4) OFFLINE: l'app si apre dal service worker/cache senza rete");
  // compila una causale R da offline
  await apriPresenze(pcA.page);
  await pcA.page.locator('[data-cella="p2|2027-03-04"]').first().click();
  await pcA.page.locator('.menu-causale button[data-c="R"]').first().click();
  await sleep(3200);   // il push (offline) fallira': il lavoro resta nel PC
  ok(pcA.errori.length === 0, '(E4b) offline: nessun errore JS non gestito dopo il tentativo di invio');
  await pcA.context.setOffline(false);
  await sleep(100);
  // il polling di 45s non aspettiamo: riavvio sincronizza (come un PC riaperto)
  await pcA.page.reload();
  await sbloccaEPrendiPassword(pcA.page);
  await sleep(1000);
  const inviata = scrittureCloud.some(s => (s.causali[2027] || []).some(c => c.p === 'p2' && c.d === '2027-03-04' && c.c === 'R'));
  ok(inviata, '(E4c) tornato online, la causale R compilata offline arriva al cloud');

  // ---------- E5: DUE PC insieme: A spedisce, B riceve
  const pcB = await nuovoPC('B');
  await sbloccaEPrendiPassword(pcB.page);
  const causaliB = await pcB.page.evaluate(() => JSON.parse(localStorage.getItem('turnario-ta-v1')).causali[2027] || []);
  ok(causaliB.some(c => c.d === '2027-03-04' && c.c === 'R'), '(E5) PC-B vergine riceve dal cloud anche la causale R scritta da PC-A');
  // B compila, A deve ricevere (avvio di A = come una riapertura)
  await apriPresenze(pcB.page);
  await pcB.page.locator('[data-cella="p1|2027-04-26"]').first().click();
  await pcB.page.locator('.menu-causale button[data-c="L"]').first().click();
  await sleep(4000);   // debounce del push di B
  await pcA.page.reload();
  await sbloccaEPrendiPassword(pcA.page);
  const statoA = await pcA.page.evaluate(() => JSON.parse(localStorage.getItem('turnario-ta-v1')));
  const arriva = ((statoA.causali[2027] || []).some(c => c.d === '2027-04-26'));
  ok(arriva, '(E5b) la causale compilata da PC-B arriva a PC-A');
  const nessunaPerdita = ['2027-01-15', '2027-03-04', '2027-04-26'].every(d =>
    (statoA.causali[2027] || []).some(c => c.d === d));
  ok(nessunaPerdita, '(E5c) nessuna causale persa nel giro completo a due PC');

  ok(pcA.errori.length === 0 && pcB.errori.length === 0, '(E6) nessun errore JS in NESSUN dei due browser');
} finally {
  await browser.close();
  server.close();
}
console.log(failures ? '\nFAILED: ' + failures : '\nALL OK (browser reale)');
process.exit(failures ? 1 : 0);
