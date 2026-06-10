const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!API_KEY) {
  console.error('GEMINI_API_KEY is missing');
  process.exit(1);
}

const now = new Date();
const kst = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'full',
  timeStyle: 'short'
}).format(now);

const SYMBOLS = [
  { key: 'kospi', label: 'KOSPI', symbol: '^KS11' },
  { key: 'kosdaq', label: 'KOSDAQ', symbol: '^KQ11' },
  { key: 'usdkrw', label: 'USD/KRW', symbol: 'KRW=X' },
  { key: 'nasdaq', label: 'NASDAQ', symbol: '^IXIC' },
  { key: 'sox', label: 'SOX', symbol: '^SOX' },
  { key: 'dxy', label: 'DXY', symbol: 'DX-Y.NYB' },
  { key: 'samsung', label: '삼성전자', symbol: '005930.KS' },
  { key: 'skhynix', label: 'SK하이닉스', symbol: '000660.KS' },
  { key: 'nvda', label: 'NVIDIA', symbol: 'NVDA' },
  { key: 'mu', label: 'Micron', symbol: 'MU' },
  { key: 'amd', label: 'AMD', symbol: 'AMD' },
  { key: 'tsm', label: 'TSMC ADR', symbol: 'TSM' },
  { key: 'asml', label: 'ASML ADR', symbol: 'ASML' }
];

function safeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '확인 필요';
  return Number(value).toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '확인 필요';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

async function fetchQuote(item) {
  const endpoint = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?range=5d&interval=1d`;
  try {
    const res = await fetch(endpoint, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`quote ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('empty result');
    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    const closes = (quote.close || []).filter(v => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
    const price = safeNumber(Number(meta.regularMarketPrice)) ?? (closes.length ? closes[closes.length - 1] : null);
    const previousClose = safeNumber(Number(meta.previousClose)) ?? (closes.length > 1 ? closes[closes.length - 2] : null);
    const change = price !== null && previousClose ? price - previousClose : null;
    const changePct = change !== null && previousClose ? (change / previousClose) * 100 : null;
    const time = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      : kst;

    return {
      key: item.key,
      label: item.label,
      symbol: item.symbol,
      price,
      previousClose,
      change,
      changePct,
      time,
      source: 'Yahoo Finance public chart endpoint'
    };
  } catch (error) {
    return {
      key: item.key,
      label: item.label,
      symbol: item.symbol,
      price: null,
      previousClose: null,
      change: null,
      changePct: null,
      time: kst,
      error: error.message,
      source: '확인 필요'
    };
  }
}

async function collectMarketSnapshot() {
  const settled = await Promise.all(SYMBOLS.map(fetchQuote));
  return settled;
}

function buildSnapshotText(snapshot) {
  return snapshot.map(q => {
    const priceDigits = q.key === 'usdkrw' ? 2 : q.price && q.price > 1000 ? 0 : 2;
    return `- ${q.label}(${q.symbol}): ${formatNumber(q.price, priceDigits)} / 전일 대비 ${formatPct(q.changePct)} / 기준시각 ${q.time}`;
  }).join('\n');
}

function extractText(data) {
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
}

function cleanJson(text) {
  return String(text)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/```$/,'')
    .trim();
}

function collectSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks
    .map(c => c.web)
    .filter(Boolean)
    .map(w => ({ title: w.title || w.uri, url: w.uri }))
    .slice(0, 8);
}

function sanitizeReport(value) {
  if (typeof value === 'string') {
    return value
      .replace(/본 브리핑은[^.。\n]*(시뮬레이션|가정)[^.。\n]*(무관|정보)[^.。\n]*[.。]?/g, '본 브리핑은 GitHub Actions 실행 시점에 수집된 공개 시세 스냅샷과 웹 검색 요약을 기반으로 작성되었습니다.')
      .replace(/시뮬레이션 정보/g, '공개 시세 기반 정보')
      .replace(/시뮬레이션/g, '공개 시세 기준')
      .replace(/가정한/g, '수집된')
      .replace(/가상의/g, '확인된 공개 데이터 기반의')
      .replace(/실제 시장 데이터와는 무관합니다/g, '공개 시세 스냅샷을 참고했습니다');
  }
  if (Array.isArray(value)) return value.map(sanitizeReport);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitizeReport(v)]));
  }
  return value;
}

function fallbackReport(snapshot, reason = '') {
  const byKey = Object.fromEntries(snapshot.map(x => [x.key, x]));
  const kospi = byKey.kospi;
  const kosdaq = byKey.kosdaq;
  const usdkrw = byKey.usdkrw;
  const sox = byKey.sox;
  const nasdaq = byKey.nasdaq;
  const semis = [byKey.nvda, byKey.mu, byKey.amd, byKey.tsm, byKey.asml].filter(Boolean);
  const strongSemis = semis.filter(x => (x.changePct ?? 0) > 0).length;

  let temperature = '중립';
  if ((kospi?.changePct ?? 0) > 0.5 && (kosdaq?.changePct ?? 0) > 0.5 && (usdkrw?.changePct ?? 0) <= 0.2) temperature = '상승 지속';
  if ((kospi?.changePct ?? 0) < -0.8 || (kosdaq?.changePct ?? 0) < -1.2 || (usdkrw?.changePct ?? 0) > 0.7) temperature = '약화';
  if ((kospi?.changePct ?? 0) < -1.5 && (kosdaq?.changePct ?? 0) < -1.5) temperature = '리스크오프';

  return {
    updatedAt: kst,
    session: '자동 브리핑',
    marketTitle: '공개 시세 기반 국장 점검',
    temperature,
    riskLevel: temperature === '리스크오프' || temperature === '약화' ? '높음' : '보통',
    oneLine: `공개 시세 스냅샷 기준 코스피 ${formatPct(kospi?.changePct)}, 코스닥 ${formatPct(kosdaq?.changePct)}, 원달러 ${formatNumber(usdkrw?.price, 2)}원 흐름을 먼저 확인해야 합니다.`,
    marketRegime: `실행 시점 공개 시세 기준으로 지수와 환율, 미국 반도체 흐름을 함께 점검했습니다.${reason ? ` 참고: ${reason}` : ''}`,
    summary: [
      `코스피: ${formatNumber(kospi?.price, 2)} (${formatPct(kospi?.changePct)})`,
      `코스닥: ${formatNumber(kosdaq?.price, 2)} (${formatPct(kosdaq?.changePct)})`,
      `원달러 환율: ${formatNumber(usdkrw?.price, 2)}원 (${formatPct(usdkrw?.changePct)})`,
      `미국 반도체 참고: SOX ${formatPct(sox?.changePct)}, 나스닥 ${formatPct(nasdaq?.changePct)}, 주요 반도체 ${strongSemis}/${semis.length}개 강세`
    ],
    dashboard: {
      indices: `코스피 ${formatPct(kospi?.changePct)}, 코스닥 ${formatPct(kosdaq?.changePct)} 기준으로 지수 체력을 확인합니다.`,
      global: `나스닥 ${formatPct(nasdaq?.changePct)}, SOX ${formatPct(sox?.changePct)} 기준으로 미국 성장주와 반도체 심리를 점검합니다.`,
      fx: `원달러 환율은 ${formatNumber(usdkrw?.price, 2)}원입니다. 환율 상승률이 커질수록 외국인 수급 부담을 우선 확인합니다.`,
      flows: '외국인·기관 세부 수급은 KRX 장중/마감 데이터를 별도로 확인해야 합니다. 수급 데이터가 확인되지 않으면 추격 판단을 보류합니다.'
    },
    sectors: [
      { name: '반도체·AI', status: strongSemis >= 3 ? '강함' : '확인 필요', view: `SOX ${formatPct(sox?.changePct)}, NVIDIA ${formatPct(byKey.nvda?.changePct)}, Micron ${formatPct(byKey.mu?.changePct)} 흐름을 같이 봅니다.` },
      { name: '전력·인프라', status: '확인 필요', view: 'AI 데이터센터 흐름과 국장 전력기기 수급 동조 여부를 확인합니다.' },
      { name: '2차전지', status: '확인 필요', view: '대형주 거래대금 회복과 소재·장비 동반 여부를 봅니다.' },
      { name: '바이오', status: '확인 필요', view: '개별 재료인지 업종 확산인지 구분합니다.' },
      { name: '자동차·전장', status: '확인 필요', view: '환율, 실적, 전장 모멘텀을 함께 확인합니다.' },
      { name: '조선·방산', status: '확인 필요', view: '수주 뉴스 이후 종가와 기관 수급을 확인합니다.' },
      { name: '금융·지주', status: '확인 필요', view: '밸류업, 배당, 대형주 순환매 여부를 확인합니다.' },
      { name: '로봇·소프트웨어', status: '확인 필요', view: '뉴스성 급등인지 거래대금이 붙는지 봅니다.' }
    ],
    watch: ['코스피·코스닥 종가 위치', '원달러 환율 방향', '외국인 코스피/선물 수급', 'SOX·나스닥 흐름', '주도 섹터 확산 여부'],
    risks: ['환율 급등', '외국인 현·선물 동반 매도', '미국 반도체 약세', '대장주 약화 후 후발주만 급등'],
    actionPlan: {
      holder: '보유자는 지수와 환율, 주도 섹터 확산이 동시에 꺾이는지 확인합니다.',
      newEntry: '신규 진입자는 장 초반 급등 추격보다 종가와 수급 확인을 우선합니다.',
      cash: '현금 보유자는 강한 섹터가 눌림에서 거래대금을 유지하는지 확인합니다.'
    },
    sources: [],
    dataNotice: 'GitHub Actions 실행 시점에 공개 시세 API로 수집한 스냅샷과 Gemini 검색 요약을 함께 사용합니다.',
    snapshot
  };
}

(async () => {
  const snapshot = await collectMarketSnapshot();
  const snapshotText = buildSnapshotText(snapshot);

  const promptWithData = `${prompt}\n\nREAL_MARKET_SNAPSHOT:\n${snapshotText}\n\n중요 지침:\n- 위 REAL_MARKET_SNAPSHOT은 공개 시세 API에서 수집한 실제 스냅샷이다.\n- 절대 "시뮬레이션", "가정", "실제 시장 데이터와 무관" 같은 문구를 쓰지 마라.\n- 실제로 확인되지 않은 외국인·기관 수급은 "확인 필요"라고 표시하라.\n- 환율, 지수, 미국 반도체 가격 방향은 REAL_MARKET_SNAPSHOT 수치를 우선 사용하라.\n`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: promptWithData }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.25 }
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
    try {
      report = JSON.parse(text);
    } catch (e) {
      report = fallbackReport(snapshot, 'Gemini 응답 파싱 확인 필요');
      report.rawGeminiText = text.slice(0, 2000);
    }
    const groundedSources = collectSources(data);
    if (groundedSources.length) report.sources = groundedSources;
  } catch (error) {
    report = fallbackReport(snapshot, error.message);
  }

  report = sanitizeReport(report);
  report.updatedAt = report.updatedAt || kst;
  report.dataNotice = 'GitHub Actions 실행 시점에 공개 시세 API로 수집한 스냅샷과 Gemini 검색 요약을 함께 사용합니다.';
  report.snapshot = snapshot;

  const out = path.join(__dirname, '..', 'data', 'today.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log('Updated data/today.json');
})();
