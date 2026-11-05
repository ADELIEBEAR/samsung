const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_AGE_MS, targets, parseChart, getChart, buildPayload } = require('../scripts/update-charts');
const now = new Date('2026-11-05T08:00:00.000Z');
const target = targets[0];
function fixture(closes = [100, 105], timestamps = [1793750400, 1793836800]) {
  return { chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ close: closes }] } }], error: null } };
}
function assertUnavailable(chart, reason) {
  assert.equal(chart.status, 'unavailable');
  assert.deepEqual(chart.points, []);
  assert.equal(chart.last, null);
  assert.equal(chart.changePct, null);
  assert.equal(chart.observedAt, null);
  if (reason) assert.equal(chart.reason, reason);
}

test('retains real prices and provider observation timestamps, separately from fetch time', () => {
  const chart = parseChart(target, fixture(), now);
  assert.equal(chart.status, 'available');
  assert.deepEqual(chart.points.map(point => point.close), [100, 105]);
  assert.equal(chart.last, 105);
  assert.equal(chart.changePct, 5);
  assert.equal(chart.observedAt, new Date(1793836800000).toISOString());
  assert.notEqual(chart.observedAt, chart.fetchedAt);
  assert.equal(Date.parse(chart.expiresAt) - Date.parse(chart.observedAt), MAX_AGE_MS);
  assert.equal(chart.timestampMeaning, 'provider_daily_bar');
});

test('stale and future observations are never relabeled as fresh prices', () => {
  assertUnavailable(parseChart(target, fixture(), new Date('2026-11-20T00:00:00Z')), 'stale_data');
  assertUnavailable(parseChart(target, fixture([100, 101], [1793750400, now.getTime() / 1000 + 301]), now), 'invalid_data');
});

test('rejects invalid schema, prices, timestamps and provider errors', () => {
  for (const data of [null, {}, { chart: { error: { description: 'secret upstream details' } } },
    fixture([100]), fixture([100, NaN]), fixture([100, Infinity]), fixture([100, -1]),
    fixture([100, '105']), fixture([100, 0]), fixture([100, 105], [null, 1793836800]),
    fixture([100, 105], [1793836800, 1793750400]), fixture([100, 105], [1793750400, 1793750400]),
    fixture([100, 105], [1793750400, '1793836800'])]) {
    assertUnavailable(parseChart(target, data, now));
  }
});

test('missing closes are skipped, never synthesized', () => {
  assertUnavailable(parseChart(target, fixture([100, null]), now), 'insufficient_data');
  const data = fixture([100, null, 105], [1793664000, 1793750400, 1793836800]);
  assert.deepEqual(parseChart(target, data, now).points.map(point => point.close), [100, 105]);
});

test('HTTP, network, malformed JSON and abort failures produce no data', async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 500 }),
    async () => { throw new Error('network'); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } }),
    async () => { throw new DOMException('timeout', 'AbortError'); }]) {
    const chart = await getChart(target, { fetchImpl, now });
    assertUnavailable(chart);
    assert.doesNotMatch(JSON.stringify(chart), /network|bad JSON|timeout/);
  }
});

test('successful mocked fetch preserves real output and uses a timeout', async () => {
  const fetchImpl = async (url, options) => {
    assert.match(url, /^https:\/\/query1\.finance\.yahoo\.com\//);
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => fixture() };
  };
  assert.equal((await getChart(target, { fetchImpl, now })).last, 105);
});

test('whole payload fails closed without invented prices and has explicit generation time', async () => {
  const payload = await buildPayload({ now, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal(payload.generatedAt, now.toISOString());
  assert.equal(payload.charts.length, 4);
  payload.charts.forEach(chart => assertUnavailable(chart));
});

test('freshness boundary expires and retains at most forty genuine observations', () => {
  const end = now.getTime() / 1000;
  const stamps = Array.from({ length: 50 }, (_, i) => end - (49 - i) * 86400);
  const chart = parseChart(target, fixture(stamps.map((_, i) => 100 + i), stamps), now);
  assert.equal(chart.points.length, 40);
  assert.equal(chart.points[0].close, 110);
  assertUnavailable(parseChart(target, fixture(), new Date(1793836800000 + MAX_AGE_MS)), 'stale_data');
});
