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

(function removePublicAdminInfo(){
  $$('.nav a').forEach(a=>{ if(a.getAttribute('href')==='admin.html') a.remove(); });
  $$('main > section').forEach(section=>{
    const text=(section.textContent||'').replace(/\s+/g,' ');
    if(text.includes('이 사이트의 기준') && text.includes('자동 브리핑') && text.includes('방문자 권한')) section.remove();
  });
})();

(function addInternalChartCss(){
  const css=`
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
  .internal-chart-foot{display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:#8fa3bf;font-size:12px}.internal-chart-foot a{color:#a7f3d0;font-weight:800}
  @media(max-width:980px){.internal-chart-grid{grid-template-columns:1fr}.internal-svg{height:260px}}
  @media(max-width:620px){#chart .container{width:min(100% - 24px,1500px)}.internal-chart-card{padding:14px}.internal-svg{height:220px}}
  `;
  const style=document.createElement('style');
  style.textContent=css;
  document.head.appendChild(style);
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

function sampleSeries(base){
  const moves=[3,-2,5,4,-3,6,2,-1,7,3,-2,5,4,3,-1,4,6,-3,3,5,2,-2,4,5,3,-1,4,3,5,2];
  let v=base;
  return moves.map((m,i)=>{v+=m;return {date:String(i+1),close:Math.round(v*100)/100};});
}
function fallbackCharts(){
  return [
    {key:'kospi',title:'KOSPI',desc:'코스피 지수',last:3017,changePct:5.2,points:sampleSeries(2860)},
    {key:'kosdaq',title:'KOSDAQ',desc:'코스닥 지수',last:890,changePct:8.8,points:sampleSeries(810)},
    {key:'samsung',title:'삼성전자',desc:'005930 추세',last:77800,changePct:7.61,points:sampleSeries(72000)},
    {key:'hynix',title:'SK하이닉스',desc:'000660 추세',last:315400,changePct:10.2,points:sampleSeries(285000)}
  ];
}
function pathFor(points,w,h,pad){
  const values=points.map(p=>Number(p.close)).filter(Number.isFinite);
  const min=Math.min(...values), max=Math.max(...values), span=max-min||1;
  return points.map((p,i)=>{
    const x=pad+(i/(points.length-1||1))*(w-pad*2);
    const y=h-pad-((Number(p.close)-min)/span)*(h-pad*2);
    return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}
function svgChart(item){
  const w=720,h=280,pad=34;
  const points=(item.points||[]).filter(p=>Number.isFinite(Number(p.close)));
  if(points.length<2) return `<div class="internal-svg" style="display:grid;place-items:center;color:#94a8c7">데이터 업데이트 대기</div>`;
  const path=pathFor(points,w,h,pad);
  const values=points.map(p=>Number(p.close));
  const last=values[values.length-1], min=Math.min(...values), max=Math.max(...values), span=max-min||1;
  const lastX=w-pad;
  const lastY=h-pad-((last-min)/span)*(h-pad*2);
  const grid=[0,1,2,3].map(i=>`<line x1="${pad}" x2="${w-pad}" y1="${pad+i*((h-pad*2)/3)}" y2="${pad+i*((h-pad*2)/3)}" stroke="#172843" stroke-width="1"/>`).join('');
  return `<svg class="internal-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs><linearGradient id="g-${item.key}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(109,225,255,.45)"/><stop offset="1" stop-color="rgba(109,225,255,0)"/></linearGradient></defs>${grid}<path d="${path} L ${lastX} ${h-pad} L ${pad} ${h-pad} Z" fill="url(#g-${item.key})"/><path d="${path}" fill="none" stroke="#6de1ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lastX}" cy="${lastY}" r="6" fill="#a7f3d0"/><text x="${pad}" y="${h-10}" fill="#8fa3bf" font-size="12">최근 ${points.length}거래일 흐름</text></svg>`;
}
function renderCharts(charts,updatedAt,isLive){
  const chartSection=document.getElementById('chart'); if(!chartSection)return;
  const title=chartSection.querySelector('.section-head h2'); if(title) title.textContent='시장 차트 대시보드';
  const desc=chartSection.querySelector('.section-head p'); if(desc) desc.textContent='GitHub Actions가 갱신한 데이터를 사이트 내부 차트로 표시합니다.';
  const shell=chartSection.querySelector('.chart-shell'); if(!shell)return;
  shell.innerHTML=`<div class="internal-chart-grid">${charts.map(item=>{
    const last=Number(item.last||0);
    const change=Number(item.changePct||0);
    const cls=change>0?'up':change<0?'down':'flat';
    const lastText=last?last.toLocaleString('ko-KR'):'-';
    return `<article class="internal-chart-card"><div class="internal-chart-head"><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.desc||item.symbol||'')}</span></div><div class="internal-chart-value">${lastText}<span class="internal-chart-change ${cls}">${change>0?'+':''}${change.toFixed(2)}%</span></div></div>${svgChart(item)}<div class="internal-chart-foot"><span>${isLive?'실제 데이터 연동':'샘플 차트'}</span><span>${escapeHtml(updatedAt||'업데이트 대기')}</span></div></article>`;
  }).join('')}</div>`;
}
async function renderInternalCharts(){
  try{
    const res=await fetch('data/charts.json?ts='+Date.now());
    const data=await res.json();
    const charts=(data.charts||[]).filter(c=>(c.points||[]).length>=2);
    if(charts.length) return renderCharts(charts,data.updatedAt,true);
  }catch(e){console.warn(e);}
  renderCharts(fallbackCharts(),'자동 데이터 연동 전',false);
}
renderInternalCharts();