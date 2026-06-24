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

/* ---------- 오늘 브리핑 ---------- */
async function loadToday() {
  const roots = $$('[data-live-root]');
  const detail = $('#liveDetail');
  if (!roots.length && !detail) return;
  try {
    const response = await fetch('data/today.json?ts=' + Date.now());
    const data = await response.json();
    roots.forEach(root => {
      const set = (key, value) => {
        const el = $(`[data-live-field="${key}"]`, root);
        if (el) el.textContent = value || '-';
      };
      set('regime', data.marketTitle || data.marketRegime || '-');
      set('temperature', data.temperature || '-');
      set('riskLevel', data.riskLevel || '-');
      set('updatedAt', data.updatedAt || '-');
      set('summary', data.oneLine || (data.summary || [])[0] || '-');
      const list = $('[data-live-list="keyPoints"]', root);
      if (list) list.innerHTML = (data.summary || []).slice(0, 4).map(x => `<li>${escapeHtml(x)}</li>`).join('') || '<li>업데이트 대기</li>';
    });
    if (detail) renderLiveDetail(data);
  } catch (error) {
    console.warn('today.json 로드 실패', error);
  }
}

function renderLiveDetail(data) {
  const root = $('#liveDetail');
  if (!root) return;
  const sectors = (data.sectors || []).map(s => `<div class="sector-row"><strong>${escapeHtml(s.name)}</strong><span class="pill">${escapeHtml(s.status || '확인')}</span><p>${escapeHtml(s.view || '')}</p></div>`).join('');
  const sources = (data.sources || []).map((s, i) => `<li><a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noreferrer">${escapeHtml(s.title || ('출처 ' + (i + 1)))}</a></li>`).join('');
  root.innerHTML = `
    <section class="page-hero"><div class="container"><p class="eyebrow">Today Market Briefing</p><h1 class="page-title">${escapeHtml(data.marketTitle || '오늘 국장 브리핑')}</h1><p class="page-lead">${escapeHtml(data.oneLine || '')}</p><div class="live-meta"><span class="pill good">${escapeHtml(data.temperature || '-')}</span><span class="pill warn">${escapeHtml(data.riskLevel || '-')}</span><span class="pill">${escapeHtml(data.updatedAt || '-')}</span></div></div></section>
    <section class="section"><div class="container live-preview"><article class="brief-card"><h3>핵심 요약</h3><ul>${(data.summary || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></article><article class="brief-card"><h3>오늘 봐야 할 것</h3><ul>${(data.watch || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></article></div></section>
    <section class="section section-muted"><div class="container"><div class="section-head"><div><p class="eyebrow">Sector Rotation</p><h2>섹터별 흐름</h2></div></div><div class="sector-list">${sectors}</div></div></section>
    <section class="section"><div class="container"><div class="brief-card"><h3>리스크</h3><ul>${(data.risks || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div></div></section>
    <section class="section section-muted"><div class="container live-preview"><div class="brief-card"><h3>보유자 대응</h3><p>${escapeHtml(data.actionPlan?.holder || '')}</p></div><div class="brief-card"><h3>신규·현금 전략</h3><p><b>신규 진입</b> · ${escapeHtml(data.actionPlan?.newEntry || '')}</p><p><b>현금 비중</b> · ${escapeHtml(data.actionPlan?.cash || '')}</p></div></div></section>
    <section class="section"><div class="container"><div class="brief-card sources"><h3>참고 출처</h3><ul>${sources || '<li>업데이트 후 출처가 표시됩니다.</li>'}</ul></div></div></section>`;
}
loadToday();
