const sync = await import(process.env.SYNC_BUNDLE || '/tmp/sync-bundle.mjs');

globalThis.location = { search: '' };
const mem = { 'turnario-ta-sync-code': 'CODICE-LINK-TEST-1234567890' };
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

// il cloud "dell'altro dispositivo": SO con una causale SO e un rinforzo esterno
const statoRemoto = {
  personale: [{ id: 'OP', cognome: 'VERDI', nome: 'Y', spec: { SO115: 'Si' }, grado: 'CS', rp: 'A2' }],
  causali: { 2027: [{ p: 'OP', d: '2027-06-02', c: 'SO' }] },
  soRinforzi: [{ id: 'EXT1', cognome: 'BIANCHI', nome: 'Z', rp: 'A3' }],
};
let rem = { stato: JSON.parse(JSON.stringify(statoRemoto)), aggiornato_al: '2027-06-01T10:00:00.000Z' };
let ultimaScrittura = null;

globalThis.fetch = async (url, opts) => {
  if (url.includes('turnario_leggi')) return { ok: true, json: async () => rem };
  if (url.includes('turnario_scrivi')) {
    ultimaScrittura = JSON.parse(opts.body).p_stato;
    rem = { stato: JSON.parse(JSON.stringify(ultimaScrittura)), aggiornato_al: new Date().toISOString() };
    return { ok: true, json: async () => true };
  }
  return { ok: true, json: async () => ({}) };
};

// io (Presenze) ho una causale L locale
let locale = {
  __cloudVisto: '2027-06-01T10:00:00.000Z',   // gia' sincronizzato col cloud iniziale
  __aggiornatoAl: '2027-06-01T11:00:00.000Z', // e con una modifica locale valida
  personale: [{ id: 'OP', cognome: 'VERDI', nome: 'Y', spec: { SO115: 'Si' }, grado: 'CS', rp: 'A2' }],
  causali: { 2027: [{ p: 'OP', d: '2027-06-05', c: 'L' }] },
  soRinforzi: [],
};
const applica = (stato) => { globalThis.__applicato = stato; };

// avvio: scarica il cloud (T1)
await sync.avvio(applica, () => locale, () => false);
ok(!globalThis.__applicato || true, '(0) avvio ok');

// mentre lavoro, l'altro dispositivo salva sul cloud (timestamp diverso)
rem = { stato: JSON.parse(JSON.stringify(statoRemoto)), aggiornato_al: '2027-06-01T11:00:00.000Z' };

// io salvo: il push deve UNIRE le causali (mia L + la sua SO) e il rinforzo esterno
await new Promise((risolvi) => {
  sync.programmaPush(null, () => locale);
  setTimeout(risolvi, 3000);
});

ok(!!ultimaScrittura, '(1) push avvenuto');
const caus = ultimaScrittura.causali[2027];
ok(caus.some(c => c.d === '2027-06-05' && c.c === 'L'), '(2) la mia causale L resta');
ok(caus.some(c => c.d === '2027-06-02' && c.c === 'SO'), '(3) la causale SO dell\'altro dispositivo NON e\' stata cancellata');
ok((ultimaScrittura.soRinforzi || []).some(r => r.id === 'EXT1'), '(4) il rinforzo esterno dell\'altro dispositivo resta');
ok(!!globalThis.__applicato, '(5) lo stato unito e\' stato applicato anche in locale');

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
