const fs = require('fs');
const path = require('path');

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const targets = [
  { key: 'kospi', title: 'KOSPI', desc: '코스피 지수', symbol: '^KS11' },
  { key: 'kosdaq', title: 'KOSDAQ', desc: '코스닥 지수', symbol: '^KQ11' },
  { key: 'samsung', title: '삼성전자', desc: '005930 추세', symbol: '005930.KS' },
  { key: 'hynix', title: 'SK하이닉스', desc: '000660 추세', symbol: '000660.KS' }
];

function kstNow(now = new Date()) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', dateStyle: 'full', timeStyle: 'short'
  }).format(now);
}

function unavailableChart(target, reason = 'fetch_failed', now = new Date()) {
  return {
    ...target, status: 'unavailable', last: null, changePct: null, points: [],
    fetchedAt: now.toISOString(), observedAt: null, expiresAt: null,
    timestampMeaning: 'provider_daily_bar', reason
  };
}

function parseChart(target, json, now = new Date()) {
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const closes = result?.indicators?.quote?.[0]?.close;
  if (json?.chart?.error || !Array.isArray(timestamps) || !Array.isArray(closes) ||
      timestamps.length !== closes.length) {
    return unavailableChart(target, 'invalid_data', now);
  }
  const points = [];
  let previousTime = 0;
  for (let index = 0; index < timestamps.length; index++) {
    const close = closes[index];
    const seconds = timestamps[index];
    // A null close denotes an absent provider observation, not a zero price.
    if (close === null) continue;
    const time = seconds * 1000;
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0 ||
        typeof seconds !== 'number' || !Number.isFinite(time) || time <= previousTime ||
        time > now.getTime() + MAX_FUTURE_SKEW_MS || !Number.isFinite(new Date(time).getTime())) {
      return unavailableChart(target, 'invalid_data', now);
    }
    previousTime = time;
    const observedAt = new Date(time).toISOString();
    points.push({ date: observedAt.slice(0, 10), close: Math.round(close * 100) / 100, observedAt });
  }
  if (points.length < 2) return unavailableChart(target, 'insufficient_data', now);
  const selected = points.slice(-40);
  const observedAt = selected[selected.length - 1].observedAt;
  const expiresAt = new Date(Date.parse(observedAt) + MAX_AGE_MS).toISOString();
  if (now.getTime() >= Date.parse(expiresAt)) return unavailableChart(target, 'stale_data', now);
  const first = selected[0].close;
  const last = selected[selected.length - 1].close;
  const changePct = Math.round(((last - first) / first) * 10000) / 100;
  if (first <= 0 || !Number.isFinite(changePct)) return unavailableChart(target, 'invalid_data', now);
  return {
    ...target, status: 'available', last, changePct, points: selected,
    fetchedAt: now.toISOString(), observedAt, expiresAt,
    timestampMeaning: 'provider_daily_bar', source: 'Yahoo Finance',
    sourceUrl: 'https://finance.yahoo.com/quote/' + encodeURIComponent(target.symbol) + '/history/'
  };
}

async function getChart(target, { fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(target.symbol) + '?range=3mo&interval=1d';
  try {
    const res = await fetchImpl(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 market-chart-bot' },
      signal: AbortSignal.timeout(20000)
    });
    if (!res.ok) return unavailableChart(target, 'http_error', now);
    return parseChart(target, await res.json(), now);
  } catch {
    return unavailableChart(target, 'fetch_failed', now);
  }
}

async function buildPayload(options = {}) {
  const now = options.now || new Date();
  const charts = await Promise.all(targets.map(target => getChart(target, { ...options, now })));
  return {
    schemaVersion: 2, generatedAt: now.toISOString(), updatedAt: kstNow(now),
    note: '조회 시각과 제공자의 일별 가격 기준 시각은 다릅니다. 실시간 시세가 아닙니다.',
    charts
  };
}

async function main() {
  const payload = await buildPayload();
  const destination = path.join(__dirname, '..', 'data', 'charts.json');
  const temporary = destination + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(temporary, destination);
  console.log('Updated data/charts.json; available charts:', payload.charts.filter(chart => chart.status === 'available').length);
}

module.exports = { MAX_AGE_MS, targets, unavailableChart, parseChart, getChart, buildPayload };
if (require.main === module) main().catch(error => {
  console.error('Could not publish chart data:', error.message);
  process.exitCode = 1;
});
