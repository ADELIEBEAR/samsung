const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

/* ---------- 모바일 메뉴 / 검색 / 인쇄 ---------- */
document.addEventListener('click', event => {
  if (event.target.matches('.menu-btn')) {
    const nav = $('.nav');
    const open = nav?.classList.toggle('open');
    event.target.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (event.target.matches('[data-print]')) window.print();
});

const search = $('#materialSearch');
if (search) {
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    $$('[data-material-card]').forEach(card => {
      const hay = (card.textContent + ' ' + (card.dataset.keywords || '')).toLowerCase();
      card.hidden = q.length > 0 && !hay.includes(q);
    });
  });
}

/* ---------- 오늘 브리핑: validated, expiring, source-linked facts only ---------- */
const briefingUnavailableTitle = '오늘 브리핑 확인 중';
const briefingUnavailableText = '최신 브리핑이 출처·게시 기준을 통과하지 못해 현재 요약을 표시하지 않습니다. 확인되지 않은 시장 설명이나 투자 대응은 제공하지 않습니다.';
function validBriefing(data) {
  return typeof BriefingSafety !== 'undefined' && BriefingSafety.validateReport(data);
}
function formatBriefingTime(value) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' KST 생성';
}
function renderBriefing(data) {
  const valid = validBriefing(data);
  $$('[data-live-root]').forEach(root => {
    const values = { regime: valid ? '검색 출처 기반 시장 요약' : briefingUnavailableTitle,
      summary: valid ? data.summary[0].text : briefingUnavailableText,
      temperature: valid ? '자동 요약 · 원문 확인' : '확인 대기', riskLevel: '투자 조언 아님',
      updatedAt: valid ? formatBriefingTime(data.generatedAt) : '게시 기준을 통과한 최신 자료 없음' };
    Object.entries(values).forEach(([key,value]) => {
      const element = $(`[data-live-field="${key}"]`, root);
      if (element) element.textContent = value;
    });
    const list = $('[data-live-list="keyPoints"]', root);
    if (list) list.innerHTML = valid ? data.summary.slice(0,4).map(x => `<li>${escapeHtml(x.text)}</li>`).join('') : '<li>게시 기준을 통과한 최신 자료 없음</li>';
  });
  renderLiveDetail(data);
}
function renderLiveDetail(data) {
  const root = $('#liveDetail');
  if (!root) return;
  if (!validBriefing(data)) {
    root.innerHTML = `<section class="page-hero"><div class="container"><p class="eyebrow">Today Market Briefing</p><h1 class="page-title">${briefingUnavailableTitle}</h1><p class="page-lead">${briefingUnavailableText}</p><p>기존 자료실은 계속 이용할 수 있습니다.</p><a class="btn btn-secondary" href="index.html#materials">자료실 보기</a></div></section>`;
    return;
  }
  const items = data.summary.map(item => `<li><p>${escapeHtml(item.text)}</p><p>${item.sourceIndexes.map(i => `<a href="${escapeHtml(data.sources[i].url)}" target="_blank" rel="noopener noreferrer">원문 ${i + 1}</a>`).join(' · ')}</p></li>`).join('');
  const sources = data.sources.map((s,i) => `<li><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">${i + 1}. ${escapeHtml(s.title)}</a></li>`).join('');
  root.innerHTML = `<section class="page-hero"><div class="container"><p class="eyebrow">Today Market Briefing</p><h1 class="page-title">검색 출처 기반 시장 요약</h1><p class="page-lead">검색 자료를 바탕으로 생성한 자동 요약입니다. 투자 판단 전 원문과 사건 날짜를 확인하세요.</p><p>${escapeHtml(formatBriefingTime(data.generatedAt))} · 실시간 시세 아님</p></div></section><section class="section"><div class="container brief-card"><h2>확인할 소식</h2><ul>${items}</ul></div></section><section class="section"><div class="container brief-card sources"><h2>참고 출처</h2><ul>${sources}</ul></div></section>`;
}
let currentBriefing = null;
async function loadToday() {
  if (!$$('[data-live-root]').length && !$('#liveDetail')) return;
  try {
    const response = await fetch('data/today.json?ts=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('briefing-unavailable');
    currentBriefing = await response.json();
  } catch { currentBriefing = null; }
  renderBriefing(currentBriefing);
}
loadToday();
// A tab left open must not retain expired investment-related content.
setInterval(() => renderBriefing(currentBriefing), 60000);
