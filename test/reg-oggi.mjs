// todayIso deve usare la DATA LOCALE (Europe/Rome), non UTC:
// tra mezzanotte e l'1/2 di notte ora italiana la data UTC e' ancora "ieri".
// Questo collaudo va eseguito con TZ=Europe/Rome (run.sh lo imposta).
const { todayIso } = await import(process.env.ENGINE_BUNDLE || '/tmp/engine-bundle.mjs');

const RealDate = Date;
class DataFinta extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(2027, 4, 5, 0, 30);   // 05/05/2027 00:30 ORA LOCALE
    else super(...args);
  }
  static now() { return new RealDate(2027, 4, 5, 0, 30).getTime(); }
}

let failures = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) failures++; };

globalThis.Date = DataFinta;
const utcDate = new RealDate(new DataFinta().getTime()).toISOString().slice(0, 10);
const oggi = todayIso();
globalThis.Date = RealDate;

ok(oggi === '2027-05-05', '(1) todayIso alle 00:30 locali restituisce il giorno LOCALE (' + oggi + '), corretto');
ok(utcDate === '2027-05-04', "(2) controllo dell'ambiente: la data UTC alle 00:30 di Roma e' ancora ieri (" + utcDate + ")");
ok(oggi !== utcDate, "(3) la data UTC e quella locale differiscono in questa fascia (altrimenti il test non e' significativo)");

console.log(failures ? '\nFAILED: ' + failures : '\nALL OK');
process.exit(failures ? 1 : 0);
