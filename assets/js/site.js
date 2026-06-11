const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

(function rebrand(){
  document.title='국장 통합 전략노트 | 오늘 시장 대응 자료';
  const bs=$('.brand strong'); if(bs) bs.textContent='국장 통합 전략노트';
  const be=$('.brand em'); if(be) be.textContent='오늘 시장 대응 자료';
  const he=$('.hero .eyebrow'); if(he) he.textContent='K-Market Strategy Note';
  const hh=$('.hero h1'); if(hh) hh.innerHTML='오늘 시장,<br>무엇을 먼저 봐야 할지 정리합니다.';
  const hl=$('.hero .lead'); if(hl) hl.textContent='코스피·코스닥·환율·미국장·수급·섹터 흐름을 한 화면에서 보고, 삼성전자와 주요 대형주는 시장 신호로 함께 확인하는 전략노트입니다.';
})();

(function loadChartCss(){
  if(!document.querySelector('link[href^="assets/css/chart-force-large.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='assets/css/chart-force-large.css?v=6';
    document.head.appendChild(link);
  }
})();

document.addEventListener('click',e=>{
  if(e.target.matches('.menu-btn')) $('.nav')?.classList.toggle('open');
  if(e.target.matches('[data-print]')) window.print();
});

const search=$('#materialSearch');
if(search){
  search.addEventListener('input',()=>{
    const q=search.value.trim().toLowerCase();
    $$('[data-material-card]').forEach(card=>{
      const hay=(card.textContent+' '+(card.dataset.keywords||'')).toLowerCase();
      card.style.display=hay.includes(q)?'':'none';
    });
  });
}

function escapeHtml(str){return String(str??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}

async function loadToday(){
  const roots=$$('[data-live-root]');
  const detail=$('#liveDetail');
  if(!roots.length&&!detail)return;
  try{
    const res=await fetch('data/today.json?ts='+Date.now());
    const data=await res.json();
    roots.forEach(root=>{
      const set=(key,val)=>{const el=$(`[data-live-field="${key}"]`,root); if(el) el.textContent=val||'-';};
      set('regime',data.marketTitle||data.marketRegime||'-');
      set('temperature',data.temperature||'-');
      set('riskLevel',data.riskLevel||'-');
      set('updatedAt',data.updatedAt||'-');
      set('summary',data.oneLine||(data.summary||[])[0]||'-');
      const list=$('[data-live-list="keyPoints"]',root);
      if(list) list.innerHTML=(data.summary||[]).slice(0,4).map(x=>`<li>${escapeHtml(x)}</li>`).join('')||'<li>업데이트 대기</li>';
    });
    if(detail) renderLiveDetail(data);
  }catch(err){console.warn(err);}
}

function renderLiveDetail(data){
  const root=$('#liveDetail'); if(!root)return;
  const sectors=(data.sectors||[]).map(s=>`<article class="sector"><strong>${escapeHtml(s.name)}</strong><span class="pill">${escapeHtml(s.status||'확인')}</span><p>${escapeHtml(s.view||'')}</p></article>`).join('');
  const sources=(data.sources||[]).map((s,i)=>`<li><a href="${escapeHtml(s.url||'#')}" target="_blank" rel="noreferrer">${escapeHtml(s.title||('출처 '+(i+1)))}</a></li>`).join('');
  root.innerHTML=`<section class="page-hero"><div class="container"><p class="eyebrow">Today Market Briefing</p><h1 class="page-title">${escapeHtml(data.marketTitle||'오늘 국장 브리핑')}</h1><p class="page-lead">${escapeHtml(data.oneLine||'')}</p><div class="live-meta"><span class="pill good">${escapeHtml(data.temperature||'-')}</span><span class="pill warn">${escapeHtml(data.riskLevel||'-')}</span><span class="pill">${escapeHtml(data.updatedAt||'-')}</span></div></div></section><section class="section"><div class="container live-preview"><article class="brief-card"><h3>핵심 요약</h3><ul>${(data.summary||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></article><article class="brief-card"><h3>오늘 봐야 할 것</h3><ul>${(data.watch||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></article></div></section><section class="section section-muted"><div class="container"><div class="section-head"><div><p class="eyebrow">Sector Rotation</p><h2>섹터별 흐름</h2></div></div><div class="sector-grid">${sectors}</div></div></section><section class="section"><div class="container risk-row"><div class="risk-box"><strong>리스크</strong><ul>${(data.risks||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div class="risk-box"><strong>보유자</strong><p>${escapeHtml(data.actionPlan?.holder||'')}</p></div><div class="risk-box"><strong>신규/현금</strong><p>${escapeHtml((data.actionPlan?.newEntry||'')+' '+(data.actionPlan?.cash||''))}</p></div></div></section><section class="section section-muted"><div class="container"><div class="brief-card sources"><h3>참고 출처</h3><ul>${sources||'<li>업데이트 후 출처가 표시됩니다.</li>'}</ul></div></div></section>`;
}
loadToday();

function renderChartCards(){
  const chartSection=document.getElementById('chart');
  if(!chartSection) return;
  const title=chartSection.querySelector('.section-head h2'); if(title) title.textContent='시장 차트 대시보드';
  const desc=chartSection.querySelector('.section-head p'); if(desc) desc.textContent='국내 지수와 삼성전자·SK하이닉스를 개별 차트로 한 번에 확인합니다.';
  const shell=chartSection.querySelector('.chart-shell'); if(!shell) return;
  const now=Date.now();
  const charts=[
    {title:'KOSPI',desc:'코스피 지수',src:'https://ssl.pstatic.net/imgfinance/chart/sise/siseMainKOSPI.png?'+now,link:'https://finance.naver.com/sise/sise_index.naver?code=KOSPI'},
    {title:'KOSDAQ',desc:'코스닥 지수',src:'https://ssl.pstatic.net/imgfinance/chart/sise/siseMainKOSDAQ.png?'+now,link:'https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ'},
    {title:'삼성전자',desc:'005930 일봉',src:'https://ssl.pstatic.net/imgfinance/chart/item/candle/day/005930.png?'+now,link:'https://finance.naver.com/item/main.naver?code=005930'},
    {title:'SK하이닉스',desc:'000660 일봉',src:'https://ssl.pstatic.net/imgfinance/chart/item/candle/day/000660.png?'+now,link:'https://finance.naver.com/item/main.naver?code=000660'}
  ];
  shell.innerHTML='<div class="chart-card-grid">'+charts.map(c=>`<article class="chart-card"><div class="chart-card-head"><div><strong>${c.title}</strong><span>${c.desc}</span></div><a href="${c.link}" target="_blank" rel="noopener noreferrer">크게 보기 →</a></div><div class="chart-img-box"><img src="${c.src}" alt="${c.title} 차트" loading="lazy"></div></article>`).join('')+'</div>';
}
renderChartCards();
