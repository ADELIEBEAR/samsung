const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

(function rebrand(){
  document.title='국장 돈의 지도 | 오늘 시장과 자금 흐름';
  const brandStrong=$('.brand strong'); if(brandStrong) brandStrong.textContent='국장 돈의 지도';
  const brandSub=$('.brand em'); if(brandSub) brandSub.textContent='오늘 시장과 자금 흐름';
  const mark=$('.brand-mark'); if(mark) mark.textContent='M';
  const heroEyebrow=$('.hero .eyebrow'); if(heroEyebrow) heroEyebrow.textContent='K-Market Money Map';
  const heroTitle=$('.hero h1'); if(heroTitle) heroTitle.innerHTML='오늘 국장,<br>돈이 어디로 움직이는지 봅니다.';
  const heroLead=$('.hero .lead'); if(heroLead) heroLead.textContent='코스피·코스닥·환율·미국장·수급·섹터 로테이션을 한 화면에서 보고, 삼성전자와 주요 대형주는 시장 신호로 함께 확인하는 자료 사이트입니다.';
})();

(function loadChartFix(){
  if(!document.querySelector('link[href="assets/css/chart-force-large.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='assets/css/chart-force-large.css?v=3';
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

function renderKoreaChartDashboard(){
  const chartSection=document.getElementById('chart');
  if(!chartSection) return;
  const head=chartSection.querySelector('.section-head h2'); if(head) head.textContent='국장 차트 대시보드';
  const desc=chartSection.querySelector('.section-head p'); if(desc) desc.textContent='국내 지수와 삼성전자·SK하이닉스는 네이버금융 차트로 안정적으로 확인합니다.';
  const shell=chartSection.querySelector('.chart-shell'); if(!shell) return;
  const charts={
    kospi:{label:'KOSPI',title:'코스피 지수',src:'https://ssl.pstatic.net/imgfinance/chart/sise/siseMainKOSPI.png',link:'https://finance.naver.com/sise/sise_index.naver?code=KOSPI'},
    kosdaq:{label:'KOSDAQ',title:'코스닥 지수',src:'https://ssl.pstatic.net/imgfinance/chart/sise/siseMainKOSDAQ.png',link:'https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ'},
    samsung:{label:'삼성전자',title:'삼성전자 005930',src:'https://ssl.pstatic.net/imgfinance/chart/item/candle/day/005930.png',link:'https://finance.naver.com/item/main.naver?code=005930'},
    hynix:{label:'SK하이닉스',title:'SK하이닉스 000660',src:'https://ssl.pstatic.net/imgfinance/chart/item/candle/day/000660.png',link:'https://finance.naver.com/item/main.naver?code=000660'}
  };
  shell.innerHTML=`<div class="chart-tabs" id="koreaChartTabs"></div><div class="korea-chart-panel"><div class="korea-chart-title"><strong id="koreaChartTitle"></strong><a id="koreaChartLink" target="_blank" rel="noopener noreferrer">네이버금융에서 크게 보기 →</a></div><div class="korea-chart-image-wrap"><img id="koreaChartImage" alt="국장 차트"></div><p class="korea-chart-help">차트가 늦게 보이면 새로고침하거나 네이버금융에서 크게 보기를 눌러 확인하세요.</p></div>`;
  const tabs=document.getElementById('koreaChartTabs');
  Object.entries(charts).forEach(([key,item],idx)=>{
    const btn=document.createElement('button');
    btn.className='chart-tab'+(idx===0?' active':'');
    btn.type='button';
    btn.textContent=item.label;
    btn.addEventListener('click',()=>setChart(key));
    tabs.appendChild(btn);
  });
  function setChart(key){
    const item=charts[key]||charts.kospi;
    $$('#koreaChartTabs .chart-tab').forEach(b=>b.classList.toggle('active',b.textContent===item.label));
    document.getElementById('koreaChartTitle').textContent=item.title;
    document.getElementById('koreaChartLink').href=item.link;
    const img=document.getElementById('koreaChartImage');
    img.src=item.src+'?ts='+Date.now();
    img.alt=item.title+' 차트';
  }
  setChart('kospi');
}
renderKoreaChartDashboard();
