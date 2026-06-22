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
      card.style.display = hay.includes(q) ? '' : 'none';
    });
  });
}

/* ---------- 상단 티커 ---------- */
function renderTicker(charts) {
  const track = $('#tickerTrack');
  if (!track || !charts?.length) return;
  const item = (c) => {
    const change = Number(c.changePct || 0);
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '·';
    const last = Number(c.last || 0);
    return `<span class="ticker-item"><span class="ticker-name">${escapeHtml(c.title)}</span><b>${last ? last.toLocaleString('ko-KR') : '-'}</b><span class="${cls}">${arrow} ${Math.abs(change).toFixed(2)}%</span></span>`;
  };
  const row = charts.map(item).join('');
  track.innerHTML = row + row; // 두 번 이어 붙여 무한 스크롤처럼 보이게 함
}

/* ---------- 오늘 브리핑(홈 카드) ---------- */
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
  const sectors = (data.sectors || []).map(s => `<article class="sector"><strong>${escapeHtml(s.name)}</strong><span class="pill">${escapeHtml(s.status || '확인')}</span><p>${escapeHtml(s.view || '')}</p></article>`).join('');
  const sources = (data.sources || []).map((s, i) => `<li><a href="${escapeHtml(s.url || '#')}" target="_blank" rel="noreferrer">${escapeHtml(s.title || ('출처 ' + (i + 1)))}</a></li>`).join('');
  root.innerHTML = `
    <section class="page-hero"><div class="container"><p class="eyebrow">Today Market Briefing</p><h1 class="page-title">${escapeHtml(data.marketTitle || '오늘 국장 브리핑')}</h1><p class="page-lead">${escapeHtml(data.oneLine || '')}</p><div class="live-meta"><span class="pill good">${escapeHtml(data.temperature || '-')}</span><span class="pill warn">${escapeHtml(data.riskLevel || '-')}</span><span class="pill">${escapeHtml(data.updatedAt || '-')}</span></div></div></section>
    <section class="section"><div class="container live-preview"><article class="brief-card"><h3>핵심 요약</h3><ul>${(data.summary || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></article><article class="brief-card"><h3>오늘 봐야 할 것</h3><ul>${(data.watch || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></article></div></section>
    <section class="section section-muted"><div class="container"><div class="section-head"><div><p class="eyebrow">Sector Rotation</p><h2>섹터별 흐름</h2></div></div><div class="sector-grid">${sectors}</div></div></section>
    <section class="section"><div class="container risk-row"><div class="risk-box"><strong>리스크</strong><ul>${(data.risks || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div class="risk-box"><strong>보유자</strong><p>${escapeHtml(data.actionPlan?.holder || '')}</p></div><div class="risk-box"><strong>신규/현금</strong><p>${escapeHtml((data.actionPlan?.newEntry || '') + ' ' + (data.actionPlan?.cash || ''))}</p></div></div></section>
    <section class="section section-muted"><div class="container"><div class="brief-card sources"><h3>참고 출처</h3><ul>${sources || '<li>업데이트 후 출처가 표시됩니다.</li>'}</ul></div></div></section>`;
}
loadToday();

/* ---------- 차트 대시보드 (지수·대형주 SVG 스파크라인) ---------- */
function sampleSeries(base) {
  const moves = [3, -2, 5, 4, -3, 6, 2, -1, 7, 3, -2, 5, 4, 3, -1, 4, 6, -3, 3, 5, 2, -2, 4, 5, 3, -1, 4, 3, 5, 2];
  let value = base;
  return moves.map((move, index) => {
    value += move;
    return { date: String(index + 1), close: Math.round(value * 100) / 100 };
  });
}

function fallbackCharts() {
  return [
    { key: 'kospi', title: 'KOSPI', desc: '코스피 지수', last: 0, changePct: 0, points: sampleSeries(2860) },
    { key: 'kosdaq', title: 'KOSDAQ', desc: '코스닥 지수', last: 0, changePct: 0, points: sampleSeries(810) },
    { key: 'samsung', title: '삼성전자', desc: '005930 추세', last: 0, changePct: 0, points: sampleSeries(72000) },
    { key: 'hynix', title: 'SK하이닉스', desc: '000660 추세', last: 0, changePct: 0, points: sampleSeries(285000) }
  ];
}

function pathFor(points, width, height, pad) {
  const values = points.map(p => Number(p.close)).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return points.map((p, index) => {
    const x = pad + (index / (points.length - 1 || 1)) * (width - pad * 2);
    const y = height - pad - ((Number(p.close) - min) / span) * (height - pad * 2);
    return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function svgChart(item, color) {
  const width = 720, height = 260, pad = 28;
  const points = (item.points || []).filter(p => Number.isFinite(Number(p.close)));
  if (points.length < 2) return `<div class="internal-svg" style="display:grid;place-items:center;color:var(--muted)">업데이트 대기</div>`;
  const path = pathFor(points, width, height, pad);
  const values = points.map(p => Number(p.close));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1];
  const span = max - min || 1;
  const lastX = width - pad;
  const lastY = height - pad - ((last - min) / span) * (height - pad * 2);
  const grid = [0, 1, 2, 3].map(i => `<line x1="${pad}" x2="${width - pad}" y1="${pad + i * ((height - pad * 2) / 3)}" y2="${pad + i * ((height - pad * 2) / 3)}" stroke="#16243c" stroke-width="1"/>`).join('');
  return `<svg class="internal-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="g-${item.key}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${path} L ${lastX} ${height - pad} L ${pad} ${height - pad} Z" fill="url(#g-${item.key})"/><path d="${path}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lastX}" cy="${lastY}" r="5" fill="${color}"/></svg>`;
}

function renderCharts(charts, updatedAt, isLive) {
  const shell = $('#chartGrid');
  const note = $('#chartUpdated');
  if (note) note.textContent = isLive ? updatedAt : '실시간 데이터 연결 전 (샘플 표시)';
  if (!shell) return;
  shell.innerHTML = charts.map(item => {
    const last = Number(item.last || 0);
    const change = Number(item.changePct || 0);
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const color = change > 0 ? '#fb7185' : change < 0 ? '#5b9cf6' : '#8ea0bd';
    const lastText = last ? last.toLocaleString('ko-KR') : '-';
    return `<article class="internal-chart-card"><div class="internal-chart-head"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc || item.symbol || '')}</span></div><div class="internal-chart-value">${lastText}<span class="internal-chart-change ${cls}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</span></div></div>${svgChart(item, color)}<div class="internal-chart-foot"><span>최근 추세</span><span>${escapeHtml(item.desc || '')}</span></div></article>`;
  }).join('');
}

async function renderInternalCharts() {
  try {
    const response = await fetch('data/charts.json?ts=' + Date.now());
    const data = await response.json();
    const charts = (data.charts || []).filter(chart => (chart.points || []).length >= 2);
    if (charts.length) {
      renderCharts(charts, data.updatedAt, true);
      renderTicker(charts);
      return;
    }
  } catch (error) {
    console.warn('charts.json 로드 실패', error);
  }
  const fb = fallbackCharts();
  renderCharts(fb, '', false);
  renderTicker(fb);
}
renderInternalCharts();
