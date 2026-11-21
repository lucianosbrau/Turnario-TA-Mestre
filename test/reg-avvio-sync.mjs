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

let rispostaCloud = null;    // cosa deve rispondere turnario_leggi
let ultimaScrittura = null;  // ultimo stato passato a turnario_scrivi
let vistoArchiviato = null;  // timestamp del cloud comunicato al "dispositivo" (onCloudVisto)
// simula un archivio locale del dispositivo (come js/store.js)
let archivio = {};

globalThis.fetch = async (url, opts) => {
  if (url.includes('turnario_leggi')) return { ok: true, json: async () => rispostaCloud };
  if (url.includes('turnario_scrivi')) {
    ultimaScrittura = JSON.parse(opts.body).p_stato;
    rispostaCloud = { stato: JSON.parse(JSON.stringify(ultimaScrittura)), aggiornato_al: new Date().toISOString() };
    return { ok: true, json: async () => true };
  }
  return { ok: true, json: async () => ({}) };
};

sync.onCloudVisto((v) => { vistoArchiviato = v; });
const applica = (stato) => { globalThis.__applicato = stato; };

function statoLocale(locale) {
  return () => ({
    personale: locale.persone,
    causali: locale.causali || {},
    __aggiornatoAl: locale.__aggiornatoAl || "",
    __cloudVisto: locale.__cloudVisto || "",
  });
}

async function scenario(nome, cloudResponse, locale, vergine, atteso) {
  globalThis.__applicato = null; ultimaScrittura = null; vistoArchiviato = null;
  rispostaCloud = cloudResponse && cloudResponse.stato ? Object.assign({ aggiornato_al: new Date().toISOString() }, cloudResponse) : cloudResponse;
  const res = await sync.avvio(applica, statoLocale(locale), vergine);
  if (atteso === 'cloud') ok(!!globalThis.__applicato, nome);
  else if (atteso === 'locale') ok(!globalThis.__applicato, nome);
  else if (atteso === 'push') ok(!!ultimaScrittura, nome);
  else if (atteso === 'merge') ok(!!ultimaScrittura && !!globalThis.__applicato, nome);
}

const CLOUD_OK = { stato: { personale: [{ id: 'LAVORO' }], causali: { 2027: [{ p: 'A', d: '2027-05-05', c: 'SO' }] } }, aggiornato_al: '2027-07-01T10:00:00.000Z' };

// S1: dispositivo vergine + cloud con dati => vince il cloud, il seed NON viene pushato
await scenario('S1 vergine perde contro il cloud con lavoro (applica cloud, zero push)',
  CLOUD_OK, { persone: [{ id: 'SEED' }] }, true, 'cloud');
ok(!ultimaScrittura, 'S1b il seed del dispositivo vergine NON viene scritto sul cloud');

// M1: prima volta col nuovo schema (__cloudVisto assente), nessuna modifica locale => il cloud ha la meglio
await scenario('M1 prima sincronizzazione col nuovo schema: il cloud viene applicato',
  CLOUD_OK, { persone: [{ id: 'VECCHIO' }] }, false, 'cloud');

// M1b: prima volta col nuovo schema MA con modifiche locali non ancora spedite:
// si uniscono al cloud e si spediscono (mai perderle)
globalThis.__applicato = null; ultimaScrittura = null; rispostaCloud = CLOUD_OK;
const localeM1b = () => ({
  personale: [{ id: 'MIO' }],
  causali: { 2027: [{ p: 'MIO', d: '2027-05-09', c: 'Mis' }] },
  __aggiornatoAl: '2027-06-01T00:00:00.000Z',
  __cloudVisto: '',
});
await (async () => {
  const res = await sync.avvio(applica, localeM1b, false);
  ok(!!ultimaScrittura, 'M1b modifiche locali non spedita durante la migrazione: vengono spedita');
  const caus = ultimaScrittura ? (ultimaScrittura.causali[2027] || []) : [];
  ok(caus.some(c => c.p === 'MIO' && c.d === '2027-05-09' && c.c === 'Mis'), 'M1b-b la Mis locale arriva al cloud');
  ok(caus.some(c => c.p === 'A' && c.d === '2027-05-05' && c.c === 'SO'), 'M1b-c la SO del cloud si unisce, non si cancella');
  ok(!!globalThis.__applicato, 'M1b-d lo stato unito applicato anche in locale');
})();

// S2: modifiche locali non ancora spedite (tMut > tVisto), cloud immutato => push del locale, cloud NON applicato
await scenario('S2 modifiche locali non spedite: push del locale, il cloud non si applica sopra',
  CLOUD_OK, { persone: [{ id: 'MIO' }], __aggiornatoAl: '2027-07-02T00:00:00.000Z', __cloudVisto: '2027-07-01T10:00:00.000Z' }, false, 'locale');
ok(!!ultimaScrittura && ultimaScrittura.personale[0].id === 'MIO', 'S2b le modifiche locali vengono spedite');

// S3: locale sincronizzato, cloud piu' recente => il cloud si applica
await scenario('S3 locale sincronizzato, cloud piu\' recente: il cloud si applica',
  { stato: { personale: [{ id: 'NUOVO' }] }, aggiornato_al: '2027-07-03T00:00:00.000Z' },
  { persone: [{ id: 'MIO' }], __aggiornatoAl: '2027-07-01T00:00:00.000Z', __cloudVisto: '2027-07-01T10:00:00.000Z' }, false, 'cloud');

// S3B: CLOUD REGREDITO (un PC vecchio ha pushato sopra): si unisce e si rispinge, il vecchio NON si applica com'e'
const regredito = { stato: { personale: [{ id: 'VECCHIO' }], causali: { 2027: [{ p: 'B', d: '2027-05-06', c: 'L' }] } }, aggiornato_al: '2027-06-01T00:00:00.000Z' };
await scenario('S3B cloud regredito (dati vecchi pushati da un altro PC): si unisce e si rispinge',
  regredito,
  { persone: [{ id: 'MIO' }], causali: { 2027: [{ p: 'A', d: '2027-05-05', c: 'SO' }] }, __aggiornatoAl: '2027-06-02T00:00:00.000Z', __cloudVisto: '2027-07-01T10:00:00.000Z' },
  false, 'merge');
ok(ultimaScrittura && ultimaScrittura.personale[0].id === 'MIO', 'S3B-b il personale locale (buono) resta nel cloud');
const causaliUnit = ultimaScrittura && ultimaScrittura.causali[2027] || [];
ok(causaliUnit.some(c => c.p === 'A' && c.d === '2027-05-05' && c.c === 'SO') && causaliUnit.some(c => c.p === 'B' && c.d === '2027-05-06' && c.c === 'L'),
  'S3B-c causali di entrambi i lati fuse nel cloud');

// S4: cloud vuoto => il locale viene pushato
await scenario('S4 cloud vuoto: il locale viene pubblicato', null,
  { persone: [{ id: 'MIO' }], __aggiornatoAl: '2027-07-01T00:00:00.000Z', __cloudVisto: '2027-07-01T10:00:00.000Z' }, false, 'push');
await scenario('S4b risposta RPC senza stato: locale pubblicato', { stato: null },
  { persone: [{ id: 'MIO' }], __aggiornatoAl: '2027-07-01T00:00:00.000Z', __cloudVisto: '2027-07-01T10:00:00.000Z' }, false, 'push');

// S5: seedFresh come funzione (regressione del bug funzione-vero)
await scenario('S5 seedFresh funzione false: protezione rispettata (nuovo schema, nessuna applicazione forzata)',
  { stato: { personale: [{ id: 'LAVORO' }] }, aggiornato_al: '2027-07-01T10:00:00.000Z' },
  { persone: [{ id: 'MIO' }], __aggiornatoAl: '2027-07-02T00:00:00.000Z', __cloudVisto: '2027-07-01T10:00:00.000Z' }, () => false, 'locale');

// V1: dopo l'applicazione del cloud il dispositivo registra __cloudVisto
await scenario('V1 applicazione cloud registra il timestamp visto', CLOUD_OK,
  { persone: [{ id: 'VECCHIO' }] }, false, 'cloud');
ok(!!vistoArchiviato, 'V1b il timestamp del cloud viene salvato nel dispositivo');

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
