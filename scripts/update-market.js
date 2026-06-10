const fs = require('fs');
const path = require('path');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
if (!API_KEY) {
  console.error('GEMINI_API_KEY is missing');
  process.exit(1);
}

const now = new Date();
const kst = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'full', timeStyle: 'short' }).format(now);

const prompt = `
너는 한국 주식시장 데일리 브리핑 편집자다.
목표: 특정 종목 추천이 아니라 오늘 한국 증시의 레짐, 수급, 매크로, 섹터 로테이션, 리스크를 요약한다.
반드시 삼성전자 중심으로만 쓰지 말고, 코스피/코스닥/환율/미국장/외국인·기관 수급/주도 섹터를 균형 있게 다뤄라.
포함 섹터: 반도체·AI, 전력·인프라, 2차전지, 바이오, 자동차·전장, 조선·방산, 금융·지주, 로봇·소프트웨어.
현재 시각: ${kst}

출력은 JSON만. 마크다운 금지. 아래 스키마를 지켜라.
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
  "sources": [{"title":"출처 제목", "url":"URL"}]
}
면책: 매수·매도 추천 표현 금지. 수익 보장 표현 금지.
`;

function extractText(data){
  return data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n') || '';
}
function cleanJson(text){
  return text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```$/,'').trim();
}
function collectSources(data){
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return chunks.map(c=>c.web).filter(Boolean).map(w=>({title:w.title||w.uri, url:w.uri})).slice(0,8);
}
(async()=>{
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const body = {
    contents:[{parts:[{text:prompt}]}],
    tools:[{google_search:{}}],
    generationConfig:{temperature:0.35,responseMimeType:'application/json'}
  };
  const res = await fetch(url, {method:'POST', headers:{'x-goog-api-key':API_KEY,'Content-Type':'application/json'}, body:JSON.stringify(body)});
  if(!res.ok){
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const text = cleanJson(extractText(data));
  let report;
  try{ report = JSON.parse(text); }catch(e){
    report = {
      updatedAt:kst, session:'자동 브리핑', marketTitle:'브리핑 파싱 확인 필요', temperature:'중립', riskLevel:'보통', oneLine:text.slice(0,220), marketRegime:'응답 파싱 확인 필요', summary:[text.slice(0,500)], dashboard:{indices:'-',global:'-',fx:'-',flows:'-'}, sectors:[], watch:[], risks:[], actionPlan:{holder:'-',newEntry:'-',cash:'-'}, sources:[]
    };
  }
  const groundedSources = collectSources(data);
  if(groundedSources.length) report.sources = groundedSources;
  report.updatedAt = report.updatedAt || kst;
  const out = path.join(__dirname,'..','data','today.json');
  fs.writeFileSync(out, JSON.stringify(report,null,2), 'utf8');
  console.log('Updated data/today.json');
})();
