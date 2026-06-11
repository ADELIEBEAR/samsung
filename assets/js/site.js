const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function replacePublicTerminology(root = document.body) {
  if (!root) return;
  const replacements = [
    [/국장 통합 레짐노트/g, '국장 통합 전략노트'],
    [/국장 레짐 진단표/g, '국장 흐름 진단표'],
    [/시장 레짐/g, '시장 흐름'],
    [/레짐/g, '흐름']
  ];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    let text = node.nodeValue;
    replacements.forEach(([from, to]) => { text = text.replace(from, to); });
    node.nodeValue = text;
  });
}

(function rebrand() {
  document.title = '국장 통합 전략노트 | 오늘 시장 대응 자료';
  const brand = $('.brand strong');
  const sub = $('.brand em');
  const eyebrow = $('.hero .eyebrow');
  const title = $('.hero h1');
  const lead = $('.hero .lead');
  if (brand) brand.textContent = '국장 통합 전략노트';
  if (sub) sub.textContent = '오늘 시장 대응 자료';
  if (eyebrow) eyebrow.textContent = 'K-Market Strategy Note';
  if (title) title.innerHTML = '오늘 시장,<br>무엇을 먼저 봐야 할지 정리합니다.';
  if (lead) lead.textContent = '코스피·코스닥·환율·미국장·수급·섹터 흐름을 한 화면에서 보고, 삼성전자와 주요 대형주는 시장 신호로 함께 확인하는 전략노트입니다.';
  replacePublicTerminology();
})();

(function cleanPublicPage() {
  $$('.nav a').forEach(a => {
    if (a.getAttribute('href') === 'admin.html') a.remove();
  });
  $$('main > section').forEach(section => {
    const text = (section.textContent || '').replace(/\s+/g, ' ');
    if (text.includes('이 사이트의 기준') && text.includes('자동 브리핑') && text.includes('방문자 권한')) section.remove();
  });
})();

(function addStyles() {
  const css = `
  #chart .container{width:min(1500px,calc(100% - 40px))}
  .chart-shell{padding:22px!important;overflow:hidden}
  .internal-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
  .internal-chart-card{background:linear-gradient(180deg,#0f1b2f,#0a1424);border:1px solid #2a3d5c;border-radius:22px;padding:18px;box-shadow:0 18px 44px rgba(0,0,0,.2)}
  .internal-chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
  .internal-chart-head strong{display:block;font-size:20px;color:#f4f8ff;letter-spacing:-.02em}
  .internal-chart-head span{display:block;color:#94a8c7;font-size:13px;margin-top:2px}
  .internal-chart-value{text-align:right;font-weight:900;color:#eaf6ff;font-size:18px;white-space:nowrap}
  .internal-chart-change{display:block;font-size:12px;margin-top:3px}.internal-chart-change.up{color:#fb7185}.internal-chart-change.down{color:#60a5fa}.internal-chart-change.flat{color:#cbd5e1}
  .internal-svg{width:100%;height:280px;display:block;border-radius:16px;background:#06101d;border:1px solid #1f314d}
  .internal-chart-foot{display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:#8fa3bf;font-size:12px}
  @media(max-width:980px){.internal-chart-grid{grid-template-columns:1fr}.internal-svg{height:260px}}
  @media(max-width:620px){#chart .container{width:min(100% - 24px,1500px)}.internal-chart-card{padding:14px}.internal-svg{height:220px}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

document.addEventListener('click', event => {
  if (event.target.matches('.menu-btn')) $('.nav')?.classList.toggle('open');
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
    replacePublicTerminology();
  } catch (error) {
    console.warn(error);
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
  replacePublicTerminology(root);
}
loadToday();

function sampleSeries(base) {
  const moves = [3,-2,5,4,-3,6,2,-1,7,3,-2,5,4,3,-1,4,6,-3,3,5,2,-2,4,5,3,-1,4,3,5,2];
  let value = base;
  return moves.map((move, index) => {
    value += move;
    return { date: String(index + 1), close: Math.round(value * 100) / 100 };
  });
}

function fallbackCharts() {
  return [
    { key: 'kospi', title: 'KOSPI', desc: '코스피 지수', last: 3017, changePct: 5.2, points: sampleSeries(2860) },
    { key: 'kosdaq', title: 'KOSDAQ', desc: '코스닥 지수', last: 890, changePct: 8.8, points: sampleSeries(810) },
    { key: 'samsung', title: '삼성전자', desc: '005930 추세', last: 77800, changePct: 7.61, points: sampleSeries(72000) },
    { key: 'hynix', title: 'SK하이닉스', desc: '000660 추세', last: 315400, changePct: 10.2, points: sampleSeries(285000) }
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

function svgChart(item) {
  const width = 720;
  const height = 280;
  const pad = 34;
  const points = (item.points || []).filter(p => Number.isFinite(Number(p.close)));
  if (points.length < 2) return `<div class="internal-svg" style="display:grid;place-items:center;color:#94a8c7">업데이트 대기</div>`;
  const path = pathFor(points, width, height, pad);
  const values = points.map(p => Number(p.close));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const last = values[values.length - 1];
  const span = max - min || 1;
  const lastX = width - pad;
  const lastY = height - pad - ((last - min) / span) * (height - pad * 2);
  const grid = [0,1,2,3].map(i => `<line x1="${pad}" x2="${width-pad}" y1="${pad+i*((height-pad*2)/3)}" y2="${pad+i*((height-pad*2)/3)}" stroke="#172843" stroke-width="1"/>`).join('');
  return `<svg class="internal-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><linearGradient id="g-${item.key}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(109,225,255,.45)"/><stop offset="1" stop-color="rgba(109,225,255,0)"/></linearGradient></defs>${grid}<path d="${path} L ${lastX} ${height-pad} L ${pad} ${height-pad} Z" fill="url(#g-${item.key})"/><path d="${path}" fill="none" stroke="#6de1ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lastX}" cy="${lastY}" r="6" fill="#a7f3d0"/><text x="${pad}" y="${height-10}" fill="#8fa3bf" font-size="12">최근 ${points.length}개 흐름</text></svg>`;
}

function renderCharts(charts, updatedAt, isLive) {
  const chartSection = document.getElementById('chart');
  if (!chartSection) return;
  const title = chartSection.querySelector('.section-head h2');
  const desc = chartSection.querySelector('.section-head p');
  const shell = chartSection.querySelector('.chart-shell');
  if (title) title.textContent = '시장 차트 대시보드';
  if (desc) desc.textContent = '주요 지수와 대표 대형주의 최근 흐름을 확인합니다.';
  if (!shell) return;
  shell.innerHTML = `<div class="internal-chart-grid">${charts.map(item => {
    const last = Number(item.last || 0);
    const change = Number(item.changePct || 0);
    const cls = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
    const lastText = last ? last.toLocaleString('ko-KR') : '-';
    const foot = isLive ? escapeHtml(updatedAt || '업데이트') : '업데이트 대기';
    return `<article class="internal-chart-card"><div class="internal-chart-head"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc || item.symbol || '')}</span></div><div class="internal-chart-value">${lastText}<span class="internal-chart-change ${cls}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</span></div></div>${svgChart(item)}<div class="internal-chart-foot"><span>최근 흐름</span><span>${foot}</span></div></article>`;
  }).join('')}</div>`;
}

async function renderInternalCharts() {
  try {
    const response = await fetch('data/charts.json?ts=' + Date.now());
    const data = await response.json();
    const charts = (data.charts || []).filter(chart => (chart.points || []).length >= 2);
    if (charts.length) return renderCharts(charts, data.updatedAt, true);
  } catch (error) {
    console.warn(error);
  }
  renderCharts(fallbackCharts(), '업데이트 대기', false);
}
renderInternalCharts();

setTimeout(() => replacePublicTerminology(), 50);
