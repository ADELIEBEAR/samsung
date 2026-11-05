// Optional legacy cleanup and validated chart renderer. Not enabled by current pages.
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function replaceTerms(root=document.body){
    if(!root)return;
    const rules=[[/국장 통합 레짐노트/g,'국장 통합 전략노트'],[/국장 레짐 진단표/g,'국장 흐름 진단표'],[/시장 레짐/g,'시장 흐름'],[/레짐/g,'흐름']];
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){const p=n.parentElement;if(!p||['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{let t=n.nodeValue;rules.forEach(([a,b])=>t=t.replace(a,b));n.nodeValue=t;});
  }
  function clean(){
    document.title='국장 통합 전략노트 | 오늘 시장 대응 자료';
    const brand=$('.brand strong'); if(brand) brand.textContent='국장 통합 전략노트';
    const sub=$('.brand em'); if(sub) sub.textContent='오늘 시장 대응 자료';
    const h=$('.hero h1'); if(h) h.innerHTML='오늘 시장,<br>무엇을 먼저 봐야 할지 정리합니다.';
    const lead=$('.hero .lead'); if(lead) lead.textContent='코스피·코스닥·환율·미국장·수급·섹터 흐름을 한 화면에서 보고, 삼성전자와 주요 대형주는 시장 신호로 함께 확인하는 전략노트입니다.';
    $$('.nav a').forEach(a=>{if(a.getAttribute('href')==='admin.html')a.remove();});
    $$('main > section').forEach(sec=>{const t=(sec.textContent||'').replace(/\s+/g,' ');if(t.includes('이 사이트의 기준')&&t.includes('자동 브리핑')&&t.includes('방문자 권한'))sec.remove();});
    replaceTerms();
  }
  function css(){
    const style=document.createElement('style');
    style.textContent=`#chart .container{width:min(1500px,calc(100% - 40px))}.chart-shell{padding:22px!important;overflow:hidden}.internal-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.internal-chart-card{background:linear-gradient(180deg,#0f1b2f,#0a1424);border:1px solid #2a3d5c;border-radius:22px;padding:18px;box-shadow:0 18px 44px rgba(0,0,0,.2)}.internal-chart-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.internal-chart-head strong{display:block;font-size:20px;color:#f4f8ff}.internal-chart-head span{display:block;color:#94a8c7;font-size:13px;margin-top:2px}.internal-chart-value{text-align:right;font-weight:900;color:#eaf6ff;font-size:18px;white-space:nowrap}.internal-chart-change{display:block;font-size:12px;margin-top:3px}.internal-chart-change.up{color:#fb7185}.internal-chart-change.down{color:#60a5fa}.internal-chart-change.flat{color:#cbd5e1}.internal-svg{width:100%;height:280px;display:block;border-radius:16px;background:#06101d;border:1px solid #1f314d}.internal-chart-foot{display:flex;justify-content:space-between;gap:10px;margin-top:10px;color:#8fa3bf;font-size:12px}@media(max-width:980px){.internal-chart-grid{grid-template-columns:1fr}.internal-svg{height:260px}}`;
    document.head.appendChild(style);
  }
  function path(points,w,h,pad){const vals=points.map(p=>Number(p.close)).filter(Number.isFinite);const min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;return points.map((p,i)=>{const x=pad+(i/(points.length-1||1))*(w-pad*2);const y=h-pad-((Number(p.close)-min)/span)*(h-pad*2);return `${i?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;}).join(' ');}
  function svg(item){const w=720,h=280,p=34;const pts=(item.points||[]).filter(x=>Number.isFinite(Number(x.close)));if(pts.length<2)return `<div class="internal-svg" style="display:grid;place-items:center;color:#94a8c7">업데이트 대기</div>`;const vals=pts.map(x=>Number(x.close));const min=Math.min(...vals),max=Math.max(...vals),last=vals[vals.length-1],span=max-min||1,lastX=w-p,lastY=h-p-((last-min)/span)*(h-p*2),d=path(pts,w,h,p);const grid=[0,1,2,3].map(i=>`<line x1="${p}" x2="${w-p}" y1="${p+i*((h-p*2)/3)}" y2="${p+i*((h-p*2)/3)}" stroke="#172843" stroke-width="1"/>`).join('');return `<svg class="internal-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${grid}<path d="${d} L ${lastX} ${h-p} L ${p} ${h-p} Z" fill="rgba(109,225,255,.16)"/><path d="${d}" fill="none" stroke="#6de1ff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${lastX}" cy="${lastY}" r="6" fill="#a7f3d0"/><text x="${p}" y="${h-10}" fill="#8fa3bf" font-size="12">최근 ${pts.length}개 흐름</text></svg>`;}
  const MAX_AGE_MS=7*24*60*60*1000, SKEW_MS=5*60*1000;
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
  const finitePositive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
  function validPayload(data,now=Date.now()){
    if(!object(data)||data.schemaVersion!==2||!iso(data.generatedAt)||Date.parse(data.generatedAt)>now+SKEW_MS||now-Date.parse(data.generatedAt)>MAX_AGE_MS||!Array.isArray(data.charts)||!data.charts.length||data.charts.length>4)return false;
    return data.charts.every(item=>{
      if(!object(item)||item.status!=='available'||item.timestampMeaning!=='provider_daily_bar'||typeof item.title!=='string'||!item.title.trim()||item.title.length>100||!finitePositive(item.last)||typeof item.changePct!=='number'||!Number.isFinite(item.changePct)||!iso(item.observedAt)||!iso(item.fetchedAt)||!iso(item.expiresAt)||!Array.isArray(item.points)||item.points.length<2||item.points.length>40)return false;
      const observed=Date.parse(item.observedAt),fetched=Date.parse(item.fetchedAt),expires=Date.parse(item.expiresAt);
      if(observed>fetched+SKEW_MS||fetched>now+SKEW_MS||Math.abs(fetched-Date.parse(data.generatedAt))>15*60*1000||expires<=now||expires<=observed||expires-observed>MAX_AGE_MS)return false;
      let previous=0;
      for(const point of item.points){
        if(!object(point)||!finitePositive(point.close)||!iso(point.observedAt)||point.date!==point.observedAt.slice(0,10))return false;
        const time=Date.parse(point.observedAt);
        if(time<=previous||time>observed)return false;
        previous=time;
      }
      const first=item.points[0].close,last=item.points[item.points.length-1];
      return last.observedAt===item.observedAt&&last.close===item.last&&Math.abs(item.changePct-Math.round(((item.last-first)/first)*10000)/100)<0.000001;
    });
  }
  function unavailable(){const chart=document.getElementById('chart');const shell=chart?.querySelector('.chart-shell');if(shell)shell.innerHTML='<div class="brief-card"><h3>차트 데이터 확인 중</h3><p>확인 가능한 최신 가격 자료가 없어 차트를 표시하지 않습니다. 실시간 시세는 거래소나 증권사에서 확인해 주세요.</p></div>';}
  function render(charts,updated){const chart=document.getElementById('chart');if(!chart)return;const title=chart.querySelector('.section-head h2');if(title)title.textContent='시장 차트 대시보드';const desc=chart.querySelector('.section-head p');if(desc)desc.textContent='주요 지수와 대표 대형주의 일별 가격 흐름을 확인합니다. 실시간 시세가 아닙니다.';const shell=chart.querySelector('.chart-shell');if(!shell)return;shell.innerHTML='<div class="internal-chart-grid">'+charts.map(item=>{const last=Number(item.last||0),chg=Number(item.changePct||0),cls=chg>0?'up':chg<0?'down':'flat';return `<article class="internal-chart-card"><div class="internal-chart-head"><div><strong>${esc(item.title)}</strong><span>${esc(item.desc||item.symbol||'')}</span></div><div class="internal-chart-value">${last?last.toLocaleString('ko-KR'):'-'}<span class="internal-chart-change ${cls}">${chg>0?'+':''}${chg.toFixed(2)}%</span></div></div>${svg(item)}<div class="internal-chart-foot"><span>최근 흐름</span><span>제공자 일별 가격 기준: ${esc(item.observedAt)} · 조회: ${esc(item.fetchedAt)}</span></div></article>`;}).join('')+'</div>';}
  let current=null;
  function renderCurrent(){if(validPayload(current))render(current.charts,current.generatedAt);else unavailable();}
  async function charts(){try{const r=await fetch('data/charts.json?ts='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('unavailable');current=await r.json();}catch{current=null;}renderCurrent();}
  clean();css();charts();setTimeout(clean,150);setTimeout(clean,800);setInterval(renderCurrent,60000);
})();
