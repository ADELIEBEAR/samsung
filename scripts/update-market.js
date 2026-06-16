const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const now = new Date();
const kst = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  dateStyle: 'full',
  timeStyle: 'short'
}).format(now);

function baseReport(reason = '') {
  return {
    updatedAt: kst,
    session: '오늘 시장 브리핑',
    marketTitle: '오늘 시장 흐름 점검',
    temperature: '중립',
    riskLevel: '보통',
    oneLine: '오늘 시장은 지수, 환율, 외국인·기관 수급, 주도 섹터를 함께 확인해야 하는 구간입니다.',
    marketRegime: '시장 흐름은 확인 중입니다.',
    summary: [
      '코스피·코스닥 흐름과 거래대금 변화를 먼저 확인해야 합니다.',
      '환율과 미국 반도체주 흐름이 국내 대형주 방향에 영향을 줄 수 있습니다.',
      '외국인·기관 수급이 대형주에 이어지는지 확인이 필요합니다.',
      '반도체·AI, 전력·인프라, 2차전지, 바이오 등 주요 섹터별 온도 차이를 봐야 합니다.'
    ],
    dashboard: {
      indices: '지수 흐름은 최신 데이터 업데이트 후 확인합니다.',
      global: '미국장과 반도체 지수 흐름을 함께 확인합니다.',
      fx: '원/달러 환율과 달러 흐름을 함께 확인합니다.',
      flows: '외국인·기관 수급은 장중과 장마감 데이터를 나눠 확인합니다.'
    },
    sectors: [
      { name: '반도체·AI', status: '확인 필요', view: '대형주 수급과 장비·소부장 확산 여부를 확인합니다.' },
      { name: '전력·인프라', status: '확인 필요', view: 'AI 데이터센터와 전력기기 흐름을 확인합니다.' },
      { name: '2차전지', status: '확인 필요', view: '대형주 반등과 소재·장비 동조 여부를 확인합니다.' },
      { name: '바이오', status: '확인 필요', view: '개별 이슈인지 섹터 확산인지 구분합니다.' },
      { name: '자동차·전장', status: '확인 필요', view: '환율, 실적, 전장 부품 흐름을 확인합니다.' },
      { name: '조선·방산', status: '확인 필요', view: '수주와 정책 기대가 주가에 이어지는지 확인합니다.' },
      { name: '금융·지주', status: '확인 필요', view: '배당, 밸류업, 대형주 순환매 흐름을 확인합니다.' },
      { name: '로봇·소프트웨어', status: '확인 필요', view: '테마성 급등인지 실수급이 붙는 흐름인지 확인합니다.' }
    ],
    watch: [
      '코스피·코스닥 지수 방향',
      '외국인·기관 수급',
      '환율과 미국 반도체주 흐름',
      '주도 섹터 확산 여부'
    ],
    risks: [
      '환율 급등',
      '미국 기술주 조정',
      '특정 섹터 쏠림 후 차익매물',
      '외국인 수급 둔화'
    ],
    actionPlan: {
      holder: '보유자는 지수보다 보유 종목의 상대강도와 거래대금을 확인합니다.',
      newEntry: '신규 진입자는 급등 추격보다 눌림과 수급 확인을 우선합니다.',
      cash: '현금 보유자는 시장 방향이 확인되는 구간까지 분할 접근을 우선합니다.'
    },
    sources: [],
    note: reason
  };
}

function save(report) {
  const text = JSON.stringify(report, null, 2).replace(/레짐/g, '흐름');
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'today.json'), text, 'utf8');
  console.log('Updated data/today.json');
}

function extractText(data) {
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
}

function cleanJson(text) {
  return String(text || '').replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/,'').trim();
}

function collectSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks.map(c => c.web).filter(Boolean).map(w => ({ title: w.title || w.uri, url: w.uri })).slice(0, 8);
}

const prompt = `
너는 한국 주식시장 데일리 브리핑 편집자다.
특정 종목 추천이 아니라 오늘 한국 증시의 시장 흐름, 수급, 매크로, 섹터 로테이션, 리스크를 요약한다.
삼성전자 중심으로만 쓰지 말고 코스피, 코스닥, 환율, 미국장, 외국인·기관 수급, 주도 섹터를 균형 있게 다뤄라.
어려운 말인 레짐이라는 단어는 절대 쓰지 말고 시장 흐름이라고 써라.
현재 시각: ${kst}
출력은 JSON만. 마크다운 금지.
{
  "updatedAt": "KST 기준 업데이트 시간",
  "session": "장 전 브리핑 또는 장중 브리핑 또는 장 마감 브리핑",
  "marketTitle": "20자 내외 제목",
  "temperature": "공격/상승 지속/중립/약화/리스크오프 중 하나",
  "riskLevel": "낮음/보통/높음",
  "oneLine": "한 문장 요약",
  "marketRegime": "시장 흐름 설명",
  "summary": ["핵심 요약 4~6개"],
  "dashboard": {"indices":"코스피·코스닥 해석","global":"미국장·나스닥·SOX·AI 관련 해석","fx":"환율·금리·달러 해석","flows":"외국인·기관·프로그램 수급 해석"},
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
  "actionPlan": {"holder":"보유자 관점","newEntry":"신규 진입자 관점","cash":"현금 보유자 관점"},
  "sources": [{"title":"출처 제목", "url":"URL"}]
}
매수·매도 추천 표현 금지. 수익 보장 표현 금지.
`;

(async () => {
  try {
    if (!API_KEY) {
      save(baseReport('GEMINI_API_KEY 없음'));
      return;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.35 }
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      save(baseReport('Gemini API 오류: ' + res.status + ' ' + err.slice(0, 120)));
      return;
    }
    const data = await res.json();
    const text = cleanJson(extractText(data));
    let report;
    try {
      report = JSON.parse(text);
    } catch (e) {
      report = baseReport('JSON 파싱 실패');
      report.oneLine = text.slice(0, 220) || report.oneLine;
      report.summary = [text.slice(0, 500) || report.summary[0]];
    }
    const sources = collectSources(data);
    if (sources.length) report.sources = sources;
    report.updatedAt = report.updatedAt || kst;
    save(report);
  } catch (error) {
    save(baseReport('스크립트 오류: ' + String(error.message || error)));
  }
})();
