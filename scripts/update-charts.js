const fs = require('fs');
const path = require('path');

const targets = [
  { key: 'kospi', title: 'KOSPI', desc: '코스피 지수', symbol: '^KS11' },
  { key: 'kosdaq', title: 'KOSDAQ', desc: '코스닥 지수', symbol: '^KQ11' },
  { key: 'samsung', title: '삼성전자', desc: '005930 추세', symbol: '005930.KS' },
  { key: 'hynix', title: 'SK하이닉스', desc: '000660 추세', symbol: '000660.KS' }
];

function pct(a, b) {
  if (!a || !b) return 0;
  return ((b - a) / a) * 100;
}

async function getChart(target) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(target.symbol) + '?range=3mo&interval=1d';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'market-chart-bot' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const result = json.chart && json.chart.result && json.chart.result[0];
    const timestamps = result && result.timestamp ? result.timestamp : [];
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
    const closes = quote && quote.close ? quote.close : [];
    const points = closes
      .map((close, i) => ({ close, time: timestamps[i] }))
      .filter(x => typeof x.close === 'number' && Number.isFinite(x.close))
      .slice(-40)
      .map(x => ({
        date: x.time ? new Date(x.time * 1000).toISOString().slice(0, 10) : '',
        close: Math.round(x.close * 100) / 100
      }));

    const first = points[0] && points[0].close ? points[0].close : 0;
    const last = points[points.length - 1] && points[points.length - 1].close ? points[points.length - 1].close : 0;
    return {
      ...target,
      last,
      changePct: Math.round(pct(first, last) * 100) / 100,
      points,
      source: 'Yahoo Finance chart endpoint'
    };
  } catch (error) {
    console.warn('chart fetch failed:', target.symbol, error.message);
    return { ...target, last: 0, changePct: 0, points: [], error: String(error.message || error) };
  }
}

(async () => {
  const charts = await Promise.all(targets.map(getChart));
  const payload = {
    updatedAt: new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'full',
      timeStyle: 'short'
    }).format(new Date()),
    charts
  };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'charts.json'), JSON.stringify(payload, null, 2), 'utf8');
  console.log('Updated data/charts.json');
})();
