// Motore dei turni: baseline anti-regressione + invarianti strutturali.
// La baseline (2026: 183 turni; 2027: 182) e' stata convalidata al 100% contro
// il foglio Excel originale (v0.1): se cambia senza una decisione esplicita,
// questo test FALLISCE di proposito.
const { turniAnno, attivoIn } = await import(process.env.ENGINE_BUNDLE || '/tmp/engine-bundle.mjs');

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

const t26 = turniAnno(2026), t27 = turniAnno(2027);

ok(t26.length === 183, '(1) 2026: 183 turni (baseline Excel)');
ok(t27.length === 182, '(2) 2027: 182 turni (baseline)');

const attese = [
  ['2026-09-01', 'D', 'A3', 'ancora di calibrazione (fattoVerified su Excel)'],
  ['2026-01-01', 'N', 'A6', 'capodanno 2026'],
  ['2026-12-31', 'N', 'A1', 'fine 2026'],
  ['2027-02-28', 'D', 'A8', 'campione'],
  ['2027-04-25', 'D', 'A6', 'campione'],
  ['2027-04-26', 'N', 'A6', 'campione'],
  ['2027-07-14', 'D', 'A2', 'campione'],
];
for (const [d, ph, sl, note] of attese) {
  const t = t26.find(x => x.date === d) || t27.find(x => x.date === d);
  ok(!!t && t.phase === ph && t.slot === sl, `(3) ${d} = ${ph} ${sl} (${note})`);
}
ok(!t27.find(x => x.date === '2027-01-01'), "(4) 01/01/2027 non e' un turno (rispetta il ciclo 4 giorni)");
ok(!t27.find(x => x.date === '2027-12-31'), "(4b) 31/12/2027 non e' un turno");

// invarianti strutturali: date Ordinate, senza doppioni, delta%4==0/1
const ANCHOR = '2026-09-01';
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
let coerenti = true;
for (const t of [...t26, ...t27]) {
  const delta = dayDiff(ANCHOR, t.date);
  if (delta % 4 === 0 && t.phase !== 'D') coerenti = false;
  if (delta % 4 === 1 && t.phase !== 'N') coerenti = false;
  if (delta % 4 === 2 || delta % 4 === 3) coerenti = false;  // giorni di riposo del ciclo
}
ok(coerenti, '(5) ogni turno rispetta la formula delta%4 (0=D, 1=N; 2-3 non-turni)');

for (const [nome, turni] of [['2026', t26], ['2027', t27]]) {
  const dates = turni.map(t => t.date);
  ok(dates.every((d, i) => i === 0 || d > dates[i - 1]), `(6) ${nome}: turni in ordine di data`);
  ok(dates.length === new Set(dates).size, `(6b) ${nome}: nessuna data duplicata`);
}

// attivoIn: dal/al/eliminato
const p = { id: 'x', dal: null, al: null, eliminato: undefined };
ok(attivoIn(p, '2027-05-05') === true, '(7) attivo senza dal/al');
ok(attivoIn({ ...p, dal: '2027-05-06' }, '2027-05-05') === false, '(7b) non attivo prima del dal');
ok(attivoIn({ ...p, al: '2027-05-04' }, '2027-05-05') === false, "(7c) non attivo dopo l'al");
ok(attivoIn({ ...p, eliminato: true }, '2027-05-05') === false, '(7d) eliminato mai attivo');

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
