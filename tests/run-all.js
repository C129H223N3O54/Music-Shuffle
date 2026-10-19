// Führt alle Testsuiten nacheinander aus. Start: node tests/run-all.js
// UI-Tests werden übersprungen, wenn Playwright nicht installiert ist.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

let hasPlaywright = true;
try { require.resolve('playwright'); } catch { try { require.resolve('/opt/npm-tools/node_modules/playwright'); } catch { hasPlaywright = false; } }

const suites = ['logic.test.js', 'sync-server.test.js', ...(hasPlaywright ? ['ui.test.js'] : [])];
let failed = 0;
for (const s of suites) {
  const r = spawnSync(process.execPath, [path.join(__dirname, s)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
if (!hasPlaywright) console.log('\n(UI-Tests übersprungen — Playwright nicht installiert: cd tests && npm install && npx playwright install chromium)');
console.log(failed ? `\n✘ ${failed} Testsuite(n) fehlgeschlagen` : '\n✔ Alle Testsuiten bestanden');
process.exit(failed ? 1 : 0);
