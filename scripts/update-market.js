'use strict';
const fs = require('node:fs');
const path = require('node:path');
const safety = require('../assets/js/briefing-safety.js');
const OUTPUT = path.join(__dirname, '..', 'data', 'today.json');

function assert(condition, code) { if (!condition) throw new Error(code); }
function groundingUrl(value) {
  try {
    const u = new URL(value);
    if (safety.safeSourceUrl(value)) return u.href;
    if (u.protocol === 'https:' && u.hostname === 'vertexaisearch.cloud.google.com' && u.pathname.startsWith('/grounding-api-redirect/') && !u.username && !u.password && !u.port && !u.hash) return u.href;
  } catch {}
  return null;
}
async function verifySource(web, fetchFn = fetch, now = new Date()) {
  assert(web && typeof web.title === 'string' && web.title.trim().length >= 2 && web.title.length <= 300 && !/가상|출처\s*\d|placeholder|example/i.test(web.title), 'invalid-source-title');
  let url = groundingUrl(web.uri);
  assert(url, 'untrusted-source-host');
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetchFn(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'MarketBriefingSourceCheck/1.0', 'Accept': 'text/html' } });
    if ([301,302,303,307,308].includes(response.status)) {
      const next = new URL(response.headers.get('location') || '', url).href;
      await response.body?.cancel();
      assert(next !== url && groundingUrl(next), 'unsafe-source-redirect');
      url = next;
      continue;
    }
    await response.body?.cancel();
    assert(response.status === 200 && safety.safeSourceUrl(url), 'source-unavailable');
    assert((response.headers.get('content-type') || '').toLowerCase().includes('text/html'), 'source-not-article');
    return { title: web.title.trim(), url, checkedAt: now.toISOString() };
  }
  throw new Error('source-redirect-limit');
}
function parseCandidate(data) {
  assert(data && !data.promptFeedback?.blockReason, 'blocked-response');
  const candidate = data.candidates?.[0];
  assert(candidate && candidate.finishReason === 'STOP', 'incomplete-response');
  const parts = candidate.content?.parts;
  // Grounding offsets refer to an individual part, not a concatenated response.
  assert(Array.isArray(parts) && parts.length === 1 && parts.every(p => typeof p.text === 'string' && !p.thought), 'invalid-response-parts');
  const raw = parts.map(p => p.text).join('');
  assert(raw.length > 0 && raw.length <= 24000, 'invalid-response-size');
  // Do not repair malformed/markdown JSON or publish the model's raw output.
  const parsed = JSON.parse(raw);
  assert(parsed && !Array.isArray(parsed) && Object.keys(parsed).length === 1 && Array.isArray(parsed.summary) && parsed.summary.length >= 3 && parsed.summary.length <= 6, 'invalid-schema');
  assert(parsed.summary.every(t => typeof t === 'string' && t.trim().length >= 15 && t.length <= 600), 'invalid-summary');
  assert(new Set(parsed.summary).size === parsed.summary.length, 'duplicate-summary');
  const chunks = candidate.groundingMetadata?.groundingChunks;
  const supports = candidate.groundingMetadata?.groundingSupports;
  assert(Array.isArray(chunks) && chunks.length > 0 && chunks.length <= 40 && Array.isArray(supports) && supports.length > 0 && supports.length <= 100, 'missing-grounding');
  const validSupports = supports.map(s => {
    assert(s && s.segment && typeof s.segment.text === 'string' && s.segment.text.length > 0, 'invalid-grounding-segment');
    const { text, startIndex = 0, endIndex, partIndex = 0 } = s.segment;
    assert(partIndex === 0, 'invalid-grounding-part');
    assert(Number.isInteger(startIndex) && Number.isInteger(endIndex) && startIndex >= 0 && endIndex > startIndex, 'invalid-grounding-offset');
    // API offsets can be UTF-8 byte offsets; require an exact match in either representation.
    const segment = raw.slice(startIndex, endIndex);
    const utf8Segment = Buffer.from(raw, 'utf8').subarray(startIndex, endIndex).toString('utf8');
    assert((endIndex <= raw.length && segment === text) || (endIndex <= Buffer.byteLength(raw, 'utf8') && utf8Segment === text), 'grounding-text-mismatch');
    assert(Array.isArray(s.groundingChunkIndices) && s.groundingChunkIndices.length > 0 && s.groundingChunkIndices.every(i => Number.isInteger(i) && i >= 0 && i < chunks.length && chunks[i]?.web), 'invalid-grounding-indices');
    return s;
  });
  const claims = parsed.summary.map(text => {
    // Require each whole displayed claim to be inside a supported raw-output segment.
    const encoded = JSON.stringify(text).slice(1,-1);
    const matches = validSupports.filter(s => s.segment.text.includes(encoded));
    assert(matches.length > 0, 'unsupported-claim');
    return { text: text.trim(), chunkIndexes: [...new Set(matches.flatMap(s => s.groundingChunkIndices))] };
  });
  return { claims, chunks };
}
async function buildReport(data, options = {}) {
  const now = options.now || new Date();
  const { claims, chunks } = parseCandidate(data);
  assert(claims.every(c => safety.safeSummary(c.text, now.getTime())), 'unsafe-or-stale-summary');
  const used = [...new Set(claims.flatMap(c => c.chunkIndexes))];
  assert(used.length >= 2 && used.length <= 8, 'insufficient-sources');
  const sources = [];
  const indexes = new Map();
  for (const i of used) {
    const source = await verifySource(chunks[i].web, options.fetchFn || fetch, now);
    let index = sources.findIndex(s => s.url === source.url);
    if (index < 0) { index = sources.length; sources.push(source); }
    indexes.set(i, index);
  }
  const report = { schemaVersion: 2, status: 'ready', generatedAt: now.toISOString(), expiresAt: new Date(now.getTime() + safety.MAX_AGE_MS).toISOString(),
    summary: claims.map(c => ({ text: c.text, grounded: true, sourceIndexes: [...new Set(c.chunkIndexes.map(i => indexes.get(i)))] })), sources };
  assert(safety.validateReport(report, now.getTime()), 'publication-validation-failed');
  return report;
}
function save(report, output = OUTPUT) {
  const temporary = output + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n', 'utf8');
  fs.renameSync(temporary, output);
}
async function generate(options = {}) {
  const now = options.now || new Date();
  const fetchFn = options.fetchFn || fetch;
  let report = safety.unavailable(now), reason = 'unavailable';
  try {
    const key = options.apiKey ?? process.env.GEMINI_API_KEY;
    assert(key, 'missing-api-key');
    const prompt = `한국 시장의 최근 뉴스 중 원문으로 확인되는 사실 3~6개만 한국어로 요약하라. 현재 UTC ${now.toISOString()}. 검색으로 확인할 수 없는 숫자, 시장 마감·방향, 미래 예측을 만들지 말라. 기사와 사건의 실제 날짜를 YYYY-MM-DD 형식으로 각 문장에 명시하라. 한국 시간 오늘 또는 어제 발생한 사실만 포함하라. 최근 36시간 내 확인할 사실이 부족하면 summary를 빈 배열로 반환하라. 휴장일과 장 진행 중에는 마감했다고 표현하지 말라. 보유·매수·매도·현금비중 조언이나 추천, 시장 온도 등급을 만들지 말라. 각 문장은 검색 출처로 전부 뒷받침되어야 한다. JSON만 출력: {"summary":["날짜를 포함한 확인된 사실 문장", "..."]}. sources 등 다른 키, 가상 출처, URL 또는 마크다운을 출력하지 말라.`;
    const response = await fetchFn('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }], generationConfig: { temperature: 0.1 } })
    });
    assert(response.ok, 'generation-http-error');
    report = await buildReport(await response.json(), { now, fetchFn });
    reason = 'ready';
  } catch (error) {
    // Fixed codes only: never leak API response text, credentials, or raw model content.
    reason = /^[a-z-]+$/.test(error.message || '') ? error.message : 'validation-error';
    console.warn('Briefing withheld:', reason);
  }
  save(report, options.output || OUTPUT);
  // Diagnostic failures must not prevent publishing the already-saved safe state.
  try {
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Market briefing\nPublication state: **${report.status}**. Check: ${reason}.\n`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `status=${report.status}\n`);
  } catch { console.warn('Unable to write workflow diagnostics'); }
  return report;
}
if (require.main === module) generate().catch(() => { console.error('Unable to persist safe briefing state'); process.exitCode = 1; });
module.exports = { groundingUrl, verifySource, parseCandidate, buildReport, save, generate };
