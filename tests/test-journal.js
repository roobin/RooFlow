// Node tests for scripts/journal.js. Pure functions, no files are written.
// Run: node tests/test-journal.js
const j = require('../scripts/journal');
let fel = 0;
const ok = (v, t) => { console.log((v ? 'OK   ' : 'FAIL ') + t); if (!v) fel++; };

const svar = 'Done.\n\nRAPPORT project-a 2026-10-21\nGjort:      page type, a1b2c3d\nOwner:      B4\nPrövat:     build green\n';
const logg = [
  '{"type":"system","session_id":"x"}',
  '{"type":"assistant","message":{"content":[]}}',
  JSON.stringify({ type: 'result', result: svar, total_cost_usd: 1 }),
  '',
].join('\n');

ok(j.sistaResultat(logg) === svar, 'the last result line is read');
ok(j.plockaRapport(svar).startsWith('RAPPORT project-a 2026-10-21') && j.plockaRapport(svar).endsWith('Prövat:     build green'), 'the report is picked from the RAPPORT line');
ok(j.projektUrNamn('2026-10-21-alpha-homepage') === 'alpha', 'project from the prompt name');
const rad = j.journalRad(logg, '2026-10-21-alpha-homepage', new Date(2026, 9, 21, 18, 5));
ok(rad.time === '2026-10-21 18:05' && rad.project === 'alpha' && rad.report.startsWith('RAPPORT') && !('tid' in rad), 'journal line with report');
ok(j.journalRad('{"type":"result","result":"I am done."}\n', '2026-10-21-in-x', new Date()).report === 'unreported', 'without RAPPORT = unreported');
ok(j.journalRad('', '2026-10-21-in-x', new Date()).report === 'unreported', 'empty log (aborted run) = unreported');
const lang = 'RAPPORT x\n' + Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n');
ok(j.plockaRapport(lang).split('\n').length === 20, 'at most 20 lines');
ok(j.plockaRapport('Done.\n\nREPORT project-a 2026-11-24\nDone:  a\n').startsWith('REPORT project-a'), 'REPORT in English is picked too');

// fields from the report in different forms
ok(rad.owner === 'B4' && rad.blocked === '', 'the journal line carries owner and blocked (empty when the field is missing)');
ok(!('owner' in j.journalRad('', 'a-b-c-d', new Date())), 'an unreported line has no fields');
const f1 = j.faltUrRapport('RAPPORT x\nOwner:      B7; restart\nBlockerat:  the service needs a restart');
ok(f1.owner === 'B7; restart' && f1.blockerat === 'the service needs a restart', 'fields: plain form');
const f2 = j.faltUrRapport('REPORT x\n**Owner:** B7\n- **Blocked:** servern\n');
ok(f2.owner === 'B7' && f2.blockerat === 'servern', 'fields: **bold** and English');
const f3 = j.faltUrRapport('RAPPORT x\n- **Owner:** B1\n- Blockerat: inget\nOwner: B2');
ok(f3.owner === 'B1' && f3.blockerat === '', 'fields: bullet list, first hit wins, "inget" becomes empty');
const f4 = j.faltUrRapport('RAPPORT x\nOwner:      inget\nBlockerat:  –\n');
ok(f4.owner === '' && f4.blockerat === '', 'fields: none and dash become empty');

// a session in the tree: the final answer as plain text (--text)
const fritt = j.journalRad(svar, '2026-11-25-alpha-tree', new Date(2026, 10, 25, 9, 0), true);
ok(fritt.report.startsWith('RAPPORT project-a') && fritt.owner === 'B4', 'plain text: the report is picked from the answer itself');
ok(j.journalRad('I am done.', 'a-b-c-d', new Date(), true).report === 'unreported', 'plain text without REPORT = unreported');

console.log(fel ? 'FAIL: ' + fel : 'All OK');
process.exit(fel ? 1 : 0);
