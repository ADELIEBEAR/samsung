const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

(function loadChartFix(){
  if(!document.querySelector('link[href="assets/css/chart-force-large.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='assets/css/chart-force-large.css?v=2';
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
  const snapshot=data.marketSnapshot||data.snapshot||[];
  const rows=snapshot.map(q=>{
    const price=q.price==null?'확인 필요':Number(q.price).toLocaleString('ko-KR',{maximumFractionDigits:2});
    const pct=q.changePct==null?'확인 필요':`${q.changePct>0?'+':''}${Number(q.changePct).toFixed(2)}%`;
    return `<tr><td>${escapeHtml(q.label)}</td><td>${escapeHtml(q.symbol)}</td><td>${price}</td><td>${pct}</td><td>${escapeHtml(q.asOf||q.time||'')}</td></tr>`;
  }).join('');
  const snapshotBlock=rows?`<section class="section section-muted"><div class="container"><div class="brief-card"><h3>실제 시세 스냅샷</h3><div class="table-wrap"><table><thead><tr><th>항목</th><th>심볼</th><th>가격</th><th>전일 대비</th><th>기준시각</th></tr></thead><tbody>${rows}</tbody></table></div></div></div></section>`:'';
  root.innerHTML=`<section class="page-hero"><div class="container"><p class="eyebrow">Today Market Briefing</p><h1 class="page-title">${escapeHtml(data.marketTitle||'오늘 국장 브리핑')}</h1><p class="page-lead">${escapeHtml(data.oneLine||'')}</p><div class="live-meta"><span class="pill good">${escapeHtml(data.temperature||'-')}</span><span class="pill warn">${escapeHtml(data.riskLevel||'-')}</span><span class="pill">${escapeHtml(data.updatedAt||'-')}</span></div></div></section><section class="section"><div class="container live-preview"><article class="brief-card"><h3>핵심 요약</h3><ul>${(data.summary||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></article><article class="brief-card"><h3>오늘 봐야 할 것</h3><ul>${(data.watch||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></article></div></section>${snapshotBlock}<section class="section section-muted"><div class="container"><div class="section-head"><div><p class="eyebrow">Sector Rotation</p><h2>섹터별 흐름</h2></div></div><div class="sector-grid">${sectors}</div></div></section><section class="section"><div class="container risk-row"><div class="risk-box"><strong>리스크</strong><ul>${(data.risks||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div class="risk-box"><strong>보유자</strong><p>${escapeHtml(data.actionPlan?.holder||'')}</p></div><div class="risk-box"><strong>신규/현금</strong><p>${escapeHtml((data.actionPlan?.newEntry||'')+' '+(data.actionPlan?.cash||''))}</p></div></div></section><section class="section section-muted"><div class="container"><div class="brief-card sources"><h3>참고 출처</h3><ul>${sources||'<li>업데이트 후 출처가 표시됩니다.</li>'}</ul></div></div></section>`;
}
loadToday();

const chartButtons=$$('[data-tv-symbol]');
if(chartButtons.length){
  chartButtons.forEach(btn=>btn.addEventListener('click',()=>{
    chartButtons.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderTV(btn.dataset.tvSymbol);
  }));
  renderTV(chartButtons[0].dataset.tvSymbol);
}

function chartHeight(){
  if(matchMedia('(max-width:620px)').matches)return 520;
  if(matchMedia('(max-width:980px)').matches)return 620;
  return 780;
}
function renderTV(symbol){
  const box=$('#tvChart'); if(!box)return;
  const h=chartHeight();
  box.style.cssText=`width:100%;height:${h}px;min-height:${h}px;display:block;`;
  box.innerHTML=`<div class="tradingview-widget-container" style="width:100%;height:${h}px;min-height:${h}px;"><div class="tradingview-widget-container__widget" style="width:100%;height:${h}px;min-height:${h}px;"></div></div>`;
  const script=document.createElement('script');
  script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.async=true;
  script.innerHTML=JSON.stringify({autosize:false,width:'100%',height:h,symbol,interval:'D',timezone:'Asia/Seoul',theme:'dark',style:'1',locale:'kr',allow_symbol_change:true,calendar:false,hide_side_toolbar:false,support_host:'https://www.tradingview.com'});
  box.querySelector('.tradingview-widget-container').appendChild(script);
}
