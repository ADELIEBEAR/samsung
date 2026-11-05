'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../assets/js/fix-public.js'), 'utf8');
const now = Date.now();
const iso = offset => new Date(now + offset).toISOString();
function fixture() {
  const observation = iso(-86400000);
  return { schemaVersion: 2, generatedAt: iso(0), charts: [{
    title: 'KOSPI', desc: 'Daily chart', status: 'available', timestampMeaning: 'provider_daily_bar',
    last: 105, changePct: 5, fetchedAt: iso(0), observedAt: observation, expiresAt: iso(86400000),
    points: [{ date: iso(-172800000).slice(0, 10), close: 100, observedAt: iso(-172800000) },
      { date: observation.slice(0, 10), close: 105, observedAt: observation }]
  }] };
}
async function render(data, fail, status = true) {
  const shell = { innerHTML: '' }, intervals = [];
  const chart = { querySelector: selector => selector === '.chart-shell' ? shell : {} };
  const document = { body: null, title: '', head: { appendChild() {} },
    createElement: () => ({}), querySelector: () => null, querySelectorAll: () => [],
    getElementById: id => id === 'chart' ? chart : null };
  const context = vm.createContext({ document, console, AbortSignal,
    fetch: async () => { if (fail === true) throw new Error('offline'); return { ok: status, json: async () => { if (fail === 'json') throw new SyntaxError('bad JSON'); return data; } }; },
    setTimeout() {}, setInterval(callback) { intervals.push(callback); } });
  vm.runInContext(code, context);
  await new Promise(resolve => setImmediate(resolve));
  return { shell, intervals };
}
function unavailable(result) {
  assert.match(result.shell.innerHTML, /차트 데이터 확인 중/);
  assert.doesNotMatch(result.shell.innerHTML, /<svg|internal-chart-value|2860|72000/);
}

test('valid real data renders actual observations separately from fetch time', async () => {
  const data = fixture();
  const result = await render(data);
  assert.match(result.shell.innerHTML, /<svg/);
  assert.match(result.shell.innerHTML, /105/);
  assert.ok(result.shell.innerHTML.includes(data.charts[0].observedAt));
  assert.ok(result.shell.innerHTML.includes(data.charts[0].fetchedAt));
  assert.match(result.shell.innerHTML, /제공자 일별 가격 기준/);
});

test('network and HTTP errors display unavailable without fabricated points', async () => {
  unavailable(await render(null, true));
  unavailable(await render(null, 'json'));
  unavailable(await render(fixture(), false, false));
});

test('legacy, malformed and unavailable payloads are withheld', async () => {
  for (const data of [null, {}, { charts: fixture().charts }, { ...fixture(), charts: [null] },
    { ...fixture(), charts: [] }, { ...fixture(), schemaVersion: 1 }]) unavailable(await render(data));
  const data = fixture(); data.charts[0].status = 'unavailable'; unavailable(await render(data));
});

test('stale, future, malformed observations and price mismatches are withheld', async () => {
  const mutations = [d => d.generatedAt = iso(86400000), d => d.charts[0].expiresAt = iso(-1),
    d => d.charts[0].fetchedAt = iso(86400000), d => d.charts[0].observedAt = 'not-a-date',
    d => d.charts[0].points[0].close = '100', d => d.charts[0].points[0].close = -1,
    d => d.charts[0].points[0].close = Infinity, d => d.charts[0].points[0] = null,
    d => d.charts[0].last = 106, d => d.charts[0].changePct = 20,
    d => d.charts[0].points[0].observedAt = d.charts[0].observedAt,
    d => d.charts[0].points[0].date = 'fake', d => d.charts[0].timestampMeaning = 'live'];
  for (const mutate of mutations) { const data = fixture(); mutate(data); unavailable(await render(data)); }
});

test('open tab revalidates expiry and removes chart', async () => {
  const data = fixture();
  const result = await render(data);
  assert.match(result.shell.innerHTML, /<svg/);
  data.charts[0].expiresAt = iso(-1);
  result.intervals[0]();
  unavailable(result);
});

test('titles and descriptions are escaped', async () => {
  const data = fixture(); data.charts[0].title = '<img src=x onerror=alert(1)>';
  const result = await render(data);
  assert.doesNotMatch(result.shell.innerHTML, /<img/);
  assert.match(result.shell.innerHTML, /&lt;img/);
});
