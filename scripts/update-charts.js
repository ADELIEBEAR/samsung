const fs = require('fs');
const path = require('path');

const targets = [
  { key: 'kospi', title: 'KOSPI', desc: '코스피 지수', symbol: '^KS11' },
  { key: 'kosdaq', title: 'KOSDAQ', desc: '코스닥 지수', symbol: '^KQ11' },
  { key: 'samsung', title: '삼성전자', desc: '005930 추세', symbol: '005930.KS' },
  { key: 'hynix', title: 'SK하이닉스', desc: '000660 추세', symbol: '000660.KS' }
];

function kstNow() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(new Date());
}

function pct(a, b) {
  if (!a || !b) return 0;
  return ((b - a) / a) * 100;
}

function samplePoints(base) {
  const moves = [3,-2,5,4,-3,6,2,-1,7,3,-2,5,4,3,-1,4,6,-3,3,5,2,-2,4,5,3,-1,4,3,5,2];
  let value = base;
  return moves.map((move, index) => {
    value += move;
    const d = new Date();
    d.setDate(d.getDate() - (moves.length - index));
    return { date: d.toISOString().slice(0, 10), close: Math.round(value * 100) / 100 };
  });
}

function fallbackChart(target) {
  const baseMap = { kospi: 2860, kosdaq: 810, samsung: 72000, hynix: 285000 };
  const points = samplePoints(baseMap[target.key] || 1000);
  const first = points[0].close;
  const last = points[points.length - 1].close;
  return {
    ...target,
    last,
    changePct: Math.round(pct(first, last) * 100) / 100,
    points,
    status: 'fallback'
  };
}

async function getChart(target) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(target.symbol) + '?range=3mo&interval=1d';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 market-chart-bot' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const result = json.chart && json.chart.result && json.chart.result[0];
    const timestamps = result && result.timestamp ? result.timestamp : [];
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
    const closes = quote && quote.close ? quote.close : [];
    const points = closes
      .map((close, index) => ({ close, time: timestamps[index] }))
      .filter(x => typeof x.close === 'number' && Number.isFinite(x.close))
      .slice(-40)
      .map(x => ({
        date: x.time ? new Date(x.time * 1000).toISOString().slice(0, 10) : '',
        close: Math.round(x.close * 100) / 100
      }));
    if (points.length < 2) return fallbackChart(target);
    const first = points[0].close;
    const last = points[points.length - 1].close;
    return {
      ...target,
      last,
      changePct: Math.round(pct(first, last) * 100) / 100,
      points
    };
  } catch (error) {
    console.warn('chart fetch failed:', target.symbol, error.message);
    return fallbackChart(target);
  }
}

(async () => {
  try {
    const charts = await Promise.all(targets.map(getChart));
    const payload = { updatedAt: kstNow(), charts };
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'charts.json'), JSON.stringify(payload, null, 2), 'utf8');
    console.log('Updated data/charts.json');
  } catch (error) {
    const charts = targets.map(fallbackChart);
    const payload = { updatedAt: kstNow(), charts, note: String(error.message || error) };
    fs.writeFileSync(path.join(__dirname, '..', 'data', 'charts.json'), JSON.stringify(payload, null, 2), 'utf8');
    console.log('Updated data/charts.json with fallback');
  }
})();
