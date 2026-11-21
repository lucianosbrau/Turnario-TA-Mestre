const sync = await import(process.env.SYNC_BUNDLE || '/tmp/sync-bundle.mjs');

globalThis.location = { search: '' };
globalThis.TURNARIO_POLL_MS = 250;   // polling velocissimo per il test
const mem = { 'turnario-ta-sync-code': 'CODICE-LINK-TEST-1234567890' };
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; },
};

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let rispostaCloud = null;
let ultimaScrittura = null;
let bannerChiamato = 0;
// archivio locale del "dispositivo" (mutabile, come js/store.js)
let archivio = {
  personale: [{ id: 'IO' }],
  causali: { 2027: [{ p: 'IO', d: '2027-05-05', c: 'L' }] },
  __aggiornatoAl: '2027-05-01T10:00:00.000Z',
  __cloudVisto: '',
};

globalThis.fetch = async (url, opts) => {
  if (url.includes('turnario_leggi')) return { ok: true, json: async () => rispostaCloud };
  if (url.includes('turnario_scrivi')) {
    ultimaScrittura = JSON.parse(opts.body).p_stato;
    rispostaCloud = { stato: JSON.parse(JSON.stringify(ultimaScrittura)), aggiornato_al: new Date().toISOString() };
    return { ok: true, json: async () => true };
  }
  return { ok: true, json: async () => ({}) };
};

let applicato = null;
const applica = (stato) => { applicato = stato; };
const statoLocale = () => archivio;

// stato iniziale: locale e cloud allineati (il cloud contiene le mie modifiche gia' spinte)
rispostaCloud = { stato: JSON.parse(JSON.stringify(archivio)), aggiornato_al: '2027-05-01T10:00:00.000Z' };

sync.onCloudVisto((v) => { archivio.__cloudVisto = v; });
sync.onRemoteChange(() => { bannerChiamato++; });
let occupato = false;
sync.onBusy(() => occupato);

await sync.avvio(applica, statoLocale, () => false);
ok(archivio.__cloudVisto.slice(0, 23) === '2027-05-01T10:00:00.000', '(0) avvio: __cloudVisto registrato');

// L1: mentre l'app e' aperta, l'altro dispositivo carica una sua modifica (cloud piu' fresco)
rispostaCloud = {
  stato: {
    personale: [{ id: 'IO' }],
    causali: { 2027: [{ p: 'IO', d: '2027-05-05', c: 'L' }, { p: 'IO', d: '2027-05-06', c: 'SO' }] },
  },
  aggiornato_al: '2027-05-02T09:00:00.000Z',
};
applicato = null;
await sleep(900);
ok(!!applicato, '(L1) le novita\' del cloud arrivano da sole, senza F5');
ok(applicato && (applicato.causali[2027] || []).some(c => c.d === '2027-05-06' && c.c === 'SO'),
  '(L1b) la causale SO dell\'altro dispositivo e\' arrivata');
ok(archivio.__cloudVisto.slice(0, 23) === '2027-05-02T09:00:00.000', '(L1c) __cloudVisto aggiornato al momento del cloud');

// L2: ho una modifica locale non ancora spedita: il polling NON mi tocca l'archivio
archivio.__aggiornatoAl = '2027-05-03T12:00:00.000Z';   // non ancora spinta (dopo il visto)
archivio.causali[2027].push({ p: 'IO', d: '2027-05-07', c: 'Mis' });
rispostaCloud = { stato: { personale: [{ id: 'IO' }], causali: {} }, aggiornato_al: '2027-05-03T13:00:00.000Z' };
applicato = null; bannerChiamato = 0;
await sleep(900);
ok(!applicato && bannerChiamato > 0, '(L2) con modifiche mie non ancora spedite il polling non applica sopra, avvisa col banner');

// L3: finestra aperta: il polling non tocca l'archivio e avvisa
occupato = true;
rispostaCloud = { stato: { personale: [{ id: 'IO' }], causali: { 2027: [{ p: 'IO', d: '2027-05-08', c: 'L' }] } }, aggiornato_al: '2027-05-04T08:00:00.000Z' };
applicato = null; bannerChiamato = 0;
await sleep(900);
ok(!applicato && bannerChiamato > 0, '(L3) con una finestra aperta il polling aspetta e avvisa');
occupato = false;

// L4: chiusa la finestra (locale pulito di nuovo), il polling applica da solo
// rimetto il locale allineato al visto e aspetto il giro successivo
archivio.__aggiornatoAl = archivio.__cloudVisto;   // niente modifiche non spedite
await sleep(900);
ok(!!applicato && (applicato.causali[2027] || []).some(c => c.d === '2027-05-08' && c.c === 'L'),
  '(L4) riaperta (finestra chiusa + niente da spedire) le novita\' si applicano da sole');

// L5: cloud REGREDITO (un PC vecchio ha pushato sopra dati vecchi con data vecchia)
archivio.__cloudVisto = '2027-06-01T10:00:00.000Z';
rispostaCloud = { stato: { personale: [{ id: 'VECCHIO' }], causali: { 2027: [{ p: 'VECCHIO', d: '2027-05-09', c: 'SO' }] } }, aggiornato_al: '2027-05-20T00:00:00.000Z' };
archivio.__aggiornatoAl = '2027-06-01T09:00:00.000Z';   // tutto gia' spedito
applicato = null; ultimaScrittura = null;
await sleep(900);
ok(!!ultimaScrittura, '(L5) cloud regredito: si rispinge lo stato unito');
ok(ultimaScrittura && ultimaScrittura.personale.some(p => p.id === 'IO'),
  '(L5b) il personale buono del locale resta');
ok(ultimaScrittura && (ultimaScrittura.causali[2027] || []).some(c => c.p === 'VECCHIO' && c.c === 'SO'),
  '(L5c) le causali del cloud vecchio vengono fuse, non perse');

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
