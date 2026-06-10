const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!API_KEY) {
  console.error('GEMINI_API_KEY is missing. Add it in GitHub → Settings → Secrets and variables → Actions.');
  process.exit(1);
}

const now = new Date();
const kst = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'full',
  timeStyle: 'short'
}).format(now);

const symbols = [
  { key: 'kospi', label: 'KOSPI', symbol: '^KS11' },
  { key: 'kosdaq', label: 'KOSDAQ', symbol: '^KQ11' },
  { key: 'usdkrw', label: 'USD/KRW', symbol: 'KRW=X' },
  { key: 'nasdaq', label: 'NASDAQ', symbol: '^IXIC' },
  { key: 'sox', label: 'SOX', symbol: '^SOX' },
  { key: 'dxy', label: 'DXY', symbol: 'DX-Y.NYB' },
  { key: 'samsung', label: '삼성전자', symbol: '005930.KS' },
  { key: 'skhynix', label: 'SK하이닉스', symbol: '000660.KS' },
  { key: 'nvidia', label: 'NVIDIA', symbol: 'NVDA' },
  { key: 'micron', label: 'Micron', symbol: 'MU' },
  { key: 'amd', label: 'AMD', symbol: 'AMD' },
  { key: 'tsmc', label: 'TSMC ADR', symbol: 'TSM' },
  { key: 'asml', label: 'ASML ADR', symbol: 'ASML' }
];

function fmtNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (Math.abs(n) >= 1000) return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
}

async function fetchYahooChart(item) {
  const encoded = encodeURIComponent(item.symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 market-briefing-bot'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const timestamps = result?.timestamp || [];
    const valid = closes
      .map((close, idx) => ({ close, idx }))
      .filter(x => typeof x.close === 'number' && !Number.isNaN(x.close));

    if (!valid.length) throw new Error('No close data');

    const latest = valid[valid.length - 1];
    const prev = valid.length >= 2 ? valid[valid.length - 2] : null;
    const change = prev ? latest.close - prev.close : null;
    const changePct = prev && prev.close ? (change / prev.close) * 100 : null;
    const lastTime = timestamps[latest.idx] ? new Date(timestamps[latest.idx] * 1000).toISOString() : null;

    return {
      key: item.key,
      label: item.label,
      symbol: item.symbol,
      price: latest.close,
      priceText: fmtNumber(latest.close),
      change,
      changeText: change === null ? null : fmtNumber(change),
      changePct,
      changePctText: changePct === null ? null : `${changePct.toFixed(2)}%`,
      direction: changePct === null ? '확인 필요' : changePct > 0 ? '상승' : changePct < 0 ? '하락' : '보합',
      asOf: lastTime,
      source: 'Yahoo Finance public chart endpoint'
    };
  } catch (error) {
    return {
      key: item.key,
      label: item.label,
      symbol: item.symbol,
      price: null,
      priceText: '확인 필요',
      change: null,
      changeText: null,
      changePct: null,
      changePctText: null,
      direction: '확인 필요',
      asOf: null,
      source: 'unavailable',
      error: String(error.message || error)
    };
  }
}

function snapshotToText(snapshot) {
  return snapshot.map(x => {
    const pct = x.changePctText || '확인 필요';
    const price = x.priceText || '확인 필요';
    return `- ${x.label} (${x.symbol}): ${price}, 전일대비 ${pct}, 방향 ${x.direction}, 기준시각 ${x.asOf || '확인 필요'}`;
  }).join('\n');
}

const basePrompt = `
너는 한국 주식시장 데일리 브리핑 편집자다.
목표: 특정 종목 추천이 아니라 오늘 한국 증시의 레짐, 수급, 매크로, 섹터 로테이션, 리스크를 요약한다.
삼성전자 중심으로만 쓰지 말고, 코스피/코스닥/환율/미국장/외국인·기관 수급/주도 섹터를 균형 있게 다뤄라.
포함 섹터: 반도체·AI, 전력·인프라, 2차전지, 바이오, 자동차·전장, 조선·방산, 금융·지주, 로봇·소프트웨어.
현재 시각: ${kst}

반드시 지킬 것:
- 아래 REAL_MARKET_SNAPSHOT 숫자와 방향을 우선 사용한다.
- "시뮬레이션", "가정", "실제 시장 데이터와 무관" 같은 표현은 절대 쓰지 않는다.
- 확인되지 않은 외국인·기관 수급은 "확인 필요"라고 표시한다.
- 종목 매수·매도 추천, 목표가, 수익 보장 표현을 쓰지 않는다.
- 출력은 JSON만. 마크다운 금지.

아래 스키마를 지켜라.
{
  "updatedAt": "KST 기준 업데이트 시간",
  "session": "장 전 브리핑 또는 장 마감 브리핑",
  "marketTitle": "20자 내외 제목",
  "temperature": "공격/상승 지속/중립/약화/리스크오프 중 하나",
  "riskLevel": "낮음/보통/높음",
  "oneLine": "한 문장 요약",
  "marketRegime": "시장 레짐 설명",
  "summary": ["핵심 요약 4~6개"],
  "dashboard": {
    "indices": "코스피·코스닥 해석",
    "global": "미국장·나스닥·SOX·AI 관련 해석",
    "fx": "환율·금리·달러 해석",
    "flows": "외국인·기관·프로그램 수급 해석"
  },
  "sectors": [
    {"name":"반도체·AI", "status":"강함/중립/약함/확인 필요", "view":"해석"},
    {"name":"전력·인프라", "status":"강함/중립/약함/확인 필요", "view":"해석"},
    {"name":"2차전지", "status":"강함/중립/약함/확인 필요", "view":"해석"},
    {"name":"바이오", "status":"강함/중립/약함/확인 필요", "view":"해석"},
    {"name":"자동차·전장", "status":"강함/중립/약함/확인 필요", "view":"해석"},
    {"name":"조선·방산", "status":"강함/중립/약함/확인 필요", "view":"해석"},
    {"name":"금융·지주", "status":"강함/중립/약함/확인 필요", "view":"해석"},
    {"name":"로봇·소프트웨어", "status":"강함/중립/약함/확인 필요", "view":"해석"}
  ],
  "watch": ["오늘 반드시 봐야 할 포인트 4~6개"],
  "risks": ["리스크 3~5개"],
  "actionPlan": {
    "holder":"보유자 관점",
    "newEntry":"신규 진입자 관점",
    "cash":"현금 보유자 관점"
  },
  "sources": [{"title":"출처 제목", "url":"URL"}],
  "marketSnapshot": []
}
`;

function extractText(data) {
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
}

function cleanJson(text) {
  const stripped = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```$/,'')
    .trim();

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start >= 0 && end > start) return stripped.slice(start, end + 1);
  return stripped;
}

function collectSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .map(c => c.web)
    .filter(Boolean)
    .map(w => ({ title: w.title || w.uri, url: w.uri }))
    .slice(0, 8);
}

function removeBadPhrases(report) {
  const bad = [
    /본 브리핑은.*?시뮬레이션.*?(입니다|정보입니다|입니다\.)?/g,
    /시뮬레이션 정보/g,
    /가정한 시장 상황/g,
    /실제 시장 데이터와는 무관합니다\.?/g,
    /실제 시장 데이터와 무관합니다\.?/g
  ];
  const fixString = (s) => {
    if (typeof s !== 'string') return s;
    let out = s;
    bad.forEach(re => { out = out.replace(re, '공개 시세 스냅샷 기준 브리핑입니다.'); });
    return out.trim();
  };
  const walk = (x) => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === 'object') {
      const o = {};
      for (const [k, v] of Object.entries(x)) o[k] = walk(v);
      return o;
    }
    return fixString(x);
  };
  return walk(report);
}

function fallbackReport(snapshot) {
  const get = (key) => snapshot.find(x => x.key === key) || {};
  const kospi = get('kospi');
  const kosdaq = get('kosdaq');
  const usdkrw = get('usdkrw');
  const sox = get('sox');
  const nasdaq = get('nasdaq');
  const samsung = get('samsung');
  const skhynix = get('skhynix');

  const weakGlobal = [sox, nasdaq].some(x => x.direction === '하락');
  const fxRisk = usdkrw.direction === '상승';
  const semiMixed = [samsung, skhynix, sox].some(x => x.direction === '확인 필요');

  return {
    updatedAt: kst,
    session: '자동 브리핑',
    marketTitle: '국장 레짐 점검',
    temperature: weakGlobal && fxRisk ? '약화' : semiMixed ? '중립' : '상승 지속',
    riskLevel: weakGlobal || fxRisk ? '보통' : '낮음',
    oneLine: `공개 시세 스냅샷 기준으로 KOSPI는 ${kospi.direction || '확인 필요'}, KOSDAQ은 ${kosdaq.direction || '확인 필요'}, USD/KRW는 ${usdkrw.direction || '확인 필요'} 흐름입니다.`,
    marketRegime: '수집된 공개 시세 스냅샷을 기준으로 시장 레짐을 점검했습니다. 외국인·기관 세부 수급은 별도 확인이 필요합니다.',
    summary: [
      `KOSPI: ${kospi.priceText || '-'} (${kospi.changePctText || '-'})`,
      `KOSDAQ: ${kosdaq.priceText || '-'} (${kosdaq.changePctText || '-'})`,
      `USD/KRW: ${usdkrw.priceText || '-'} (${usdkrw.changePctText || '-'})`,
      `SOX: ${sox.priceText || '-'} (${sox.changePctText || '-'})`,
      `삼성전자: ${samsung.priceText || '-'} (${samsung.changePctText || '-'})`,
      `SK하이닉스: ${skhynix.priceText || '-'} (${skhynix.changePctText || '-'})`
    ],
    dashboard: {
      indices: `KOSPI ${kospi.direction || '확인 필요'}, KOSDAQ ${kosdaq.direction || '확인 필요'}입니다.`,
      global: `NASDAQ ${nasdaq.direction || '확인 필요'}, SOX ${sox.direction || '확인 필요'}입니다.`,
      fx: `USD/KRW는 ${usdkrw.direction || '확인 필요'} 흐름입니다.`,
      flows: '외국인·기관·프로그램 수급은 공개 시세 스냅샷만으로 확정할 수 없어 확인 필요입니다.'
    },
    sectors: [
      { name: '반도체·AI', status: sox.direction === '상승' ? '확인 필요' : '중립', view: `SOX와 국내 대형 반도체 흐름을 함께 확인해야 합니다.` },
      { name: '전력·인프라', status: '확인 필요', view: '반도체·AI 흐름이 전력기기까지 확산되는지 확인해야 합니다.' },
      { name: '2차전지', status: '확인 필요', view: '코스닥 체력과 동반 확인이 필요합니다.' },
      { name: '바이오', status: '확인 필요', view: '개별 이슈보다 거래대금 확산 여부가 중요합니다.' },
      { name: '자동차·전장', status: '확인 필요', view: '환율 흐름과 대형주 수급을 함께 봐야 합니다.' },
      { name: '조선·방산', status: '확인 필요', view: '기존 주도주 피로도와 신규 수급 유입을 확인해야 합니다.' },
      { name: '금융·지주', status: '확인 필요', view: '금리와 배당 기대, 외국인 수급을 함께 봐야 합니다.' },
      { name: '로봇·소프트웨어', status: '확인 필요', view: 'AI 테마 확산 여부를 확인해야 합니다.' }
    ],
    watch: ['환율 방향', 'SOX와 나스닥 흐름', 'KOSPI·KOSDAQ 상대강도', '외국인·기관 수급', '주도 섹터 확산 여부'],
    risks: ['환율 급등', '미국 반도체 약세', '외국인 수급 이탈', '대장주 약화 후 후발주 급등'],
    actionPlan: {
      holder: '보유자는 대형주와 주도 섹터의 종가 방어 여부를 확인하는 구간입니다.',
      newEntry: '신규 진입자는 장 초반 추격보다 환율과 외국인 수급 확인이 우선입니다.',
      cash: '현금 보유자는 주도 섹터가 넓어지는지 확인하면서 분할 기준을 준비하는 구간입니다.'
    },
    sources: [{ title: 'Yahoo Finance public chart endpoint', url: 'https://finance.yahoo.com/' }],
    marketSnapshot: snapshot
  };
}

(async () => {
  const snapshot = await Promise.all(symbols.map(fetchYahooChart));
  const snapshotText = snapshotToText(snapshot);
  const promptWithData = `${basePrompt}\n\nREAL_MARKET_SNAPSHOT:\n${snapshotText}\n`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: promptWithData }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.25
    }
  };

  let report;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = cleanJson(extractText(data));
    report = JSON.parse(text);
    const groundedSources = collectSources(data);
    if (groundedSources.length) report.sources = groundedSources;
  } catch (error) {
    console.warn('Gemini briefing failed or returned invalid JSON. Writing snapshot-based fallback report.');
    console.warn(String(error.message || error));
    report = fallbackReport(snapshot);
  }

  report.updatedAt = report.updatedAt || kst;
  report.marketSnapshot = snapshot;
  report = removeBadPhrases(report);

  const out = path.join(__dirname, '..', 'data', 'today.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('Updated data/today.json');
})();
