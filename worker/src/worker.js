const DEFAULT_PAYLOAD = {
  updatedAt: '업데이트 전',
  regime: '업데이트 대기',
  temperature: '대기',
  marketScore: '-',
  samsungMode: '확인 필요',
  riskLevel: '대기',
  summary: '관리자가 Gemini API로 브리핑을 생성하면 이 영역에 최신 시장 해석이 표시됩니다.',
  keyPoints: ['미국 반도체, 환율, 외국인 수급, 삼성전자 수급, 소부장 확산을 확인합니다.'],
  watch: ['SOX', '마이크론', '원달러 환율', '외국인 코스피 수급', '삼성전자 수급'],
  avoid: ['장초반 뉴스 추격', '무계획 물타기', '본전 전량 감정매도'],
  sectors: ['삼성전자', 'SK하이닉스', '반도체 장비', '소부장', '전력 인프라'],
  sources: []
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return cors(null, env, 204);
    try {
      if (url.pathname === '/latest' && request.method === 'GET') return await latest(env);
      if (url.pathname === '/health' && request.method === 'GET') return cors({ ok: true, time: new Date().toISOString() }, env);
      if (url.pathname === '/admin/publish' && request.method === 'POST') return await adminPublish(request, env);
      if (url.pathname === '/admin/generate' && request.method === 'POST') return await adminGenerate(request, env);
      return cors({ error: 'Not found' }, env, 404);
    } catch (err) {
      return cors({ error: err.message || 'Server error' }, env, err.status || 500);
    }
  }
};

async function latest(env) {
  const stored = await env.LIVE_DATA.get('latest', 'json').catch(() => null);
  return cors(stored || DEFAULT_PAYLOAD, env, 200, { 'Cache-Control': 'public, max-age=30' });
}

async function adminPublish(request, env) {
  await assertAdmin(request, env);
  const body = await request.json().catch(() => ({}));
  const payload = normalizePayload(body.payload || body);
  await env.LIVE_DATA.put('latest', JSON.stringify(payload));
  return cors({ ok: true, payload }, env);
}

async function adminGenerate(request, env) {
  await assertAdmin(request, env);
  await rateLimit(request, env);
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY secret이 설정되어 있지 않습니다.');
  const body = await request.json().catch(() => ({}));
  const prompt = buildPrompt(body.marketMemo || '', body.tone || '', body.extraInstructions || '');
  const gemini = await callGemini(prompt, env);
  const payload = normalizePayload({ ...gemini.parsed, sources: gemini.sources });
  await env.LIVE_DATA.put('latest', JSON.stringify(payload));
  return cors({ ok: true, payload, rawText: gemini.text }, env);
}

async function assertAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  if (!expected) throw new Error('ADMIN_TOKEN secret이 설정되어 있지 않습니다.');
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== expected) { const e = new Error('Unauthorized'); e.status = 401; throw e; }
}

async function rateLimit(request, env) {
  const max = Number(env.MAX_ADMIN_CALLS_PER_HOUR || 20);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const hour = new Date().toISOString().slice(0, 13);
  const key = `rate:${ip}:${hour}`;
  const current = Number(await env.LIVE_DATA.get(key) || 0);
  if (current >= max) throw new Error('관리자 호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.');
  await env.LIVE_DATA.put(key, String(current + 1), { expirationTtl: 7200 });
}

function buildPrompt(marketMemo, tone, extra) {
  return `당신은 한국 주식시장 전문 리서치 에디터입니다.\n\n목표: 삼성전자 중심 국장 통합 전략노트 사이트에 공개할 오늘의 시장 브리핑을 작성합니다.\n투자 추천이나 매수/매도 지시처럼 쓰지 말고, 시장 레짐과 확인 기준을 정리하세요.\n\n반드시 JSON만 출력하세요. 마크다운 금지.\n키는 다음만 사용하세요: updatedAt, regime, temperature, marketScore, samsungMode, riskLevel, summary, keyPoints, watch, avoid, sectors\n\nregime은 공격 가능 / 상승 지속 확인 / 중립·선별 / 약화·비중관리 / 리스크오프 중 하나로 쓰세요.\ntemperature는 매우 우호 / 우호 / 중립 / 경계 / 위험 중 하나로 쓰세요.\nriskLevel은 낮음 / 중립 / 경계 / 높음 중 하나로 쓰세요.\nsummary는 3~5문장, keyPoints/watch/avoid/sectors는 배열로 출력하세요.\n\n관리자 입력 메모:\n${marketMemo || '관리자 메모 없음'}\n\n톤:\n${tone || '전문가형이지만 초보자도 이해할 수 있게'}\n\n추가 지시:\n${extra || '없음'}\n\n최신 정보가 필요한 항목은 Google Search grounding으로 확인하되, 확인이 불명확하면 확정적으로 쓰지 마세요.`;
}

async function callGemini(prompt, env) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.25, responseMimeType: 'application/json' }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || 'Gemini API 요청 실패');
  const candidate = data.candidates?.[0] || {};
  const text = (candidate.content?.parts || []).map(p => p.text || '').join('\n').trim();
  let parsed = {};
  try { parsed = JSON.parse(stripFence(text)); } catch { parsed = { summary: text || 'Gemini 응답 파싱 실패', keyPoints: [] }; }
  const chunks = candidate.groundingMetadata?.groundingChunks || [];
  const sources = chunks.map(c => c.web).filter(Boolean).map(w => ({ title: w.title || w.uri, uri: w.uri })).slice(0, 8);
  return { text, parsed, sources };
}

function stripFence(text) { return String(text || '').replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim(); }

function normalizePayload(input) {
  const now = new Date();
  const arr = v => Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 10) : [];
  return {
    updatedAt: input.updatedAt || `${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 업데이트`,
    regime: input.regime || '중립·선별',
    temperature: input.temperature || '중립',
    marketScore: input.marketScore || '조건 확인 필요',
    samsungMode: input.samsungMode || '수급 확인 구간',
    riskLevel: input.riskLevel || '중립',
    summary: input.summary || '시장 브리핑이 업데이트되었습니다.',
    keyPoints: arr(input.keyPoints).length ? arr(input.keyPoints) : ['외국인 수급과 환율을 우선 확인합니다.'],
    watch: arr(input.watch).length ? arr(input.watch) : ['외국인 코스피 수급', '삼성전자 수급', '환율', '미국 반도체'],
    avoid: arr(input.avoid).length ? arr(input.avoid) : ['무계획 추격매수', '감정적 물타기'],
    sectors: arr(input.sectors).length ? arr(input.sectors) : ['삼성전자', '반도체', '소부장'],
    sources: Array.isArray(input.sources) ? input.sources.filter(s => s && s.uri).slice(0, 8) : []
  };
}

function cors(data, env, status = 200, extraHeaders = {}) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      ...extraHeaders
    }
  });
}
