// Gemeinsame Mini-Testumgebung (ohne Abhängigkeiten).
'use strict';
const results = [];
function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); }
function report(title) {
  console.log(`\n── ${title} ──`);
  for (const r of results) console.log(`${r.ok ? '  ✔' : '  ✘'} ${r.name}${r.detail ? `\n      → ${r.detail}` : ''}`);
  const failed = results.filter(r => !r.ok).length;
  console.log(`  ${results.length - failed}/${results.length} bestanden`);
  return failed;
}
module.exports = { check, report, results };
