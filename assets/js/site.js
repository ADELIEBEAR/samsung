
(function(){
  const cfg = window.STRATEGY_NOTE_CONFIG || { API_BASE: "" };
  const qs = (s, root=document) => root.querySelector(s);
  const qsa = (s, root=document) => [...root.querySelectorAll(s)];
  qsa('.menu-btn').forEach(btn => btn.addEventListener('click', () => qs('.nav')?.classList.toggle('open')));
  qsa('[data-print]').forEach(btn => btn.addEventListener('click', () => window.print()));
  const search = qs('#materialSearch');
  if(search){ search.addEventListener('input', () => { const term = search.value.trim().toLowerCase(); qsa('[data-material-card]').forEach(card => { const text = (card.textContent + ' ' + (card.dataset.keywords || '')).toLowerCase(); card.classList.toggle('hidden', term && !text.includes(term)); }); }); }
  async function getLatest(){
    if(cfg.API_BASE){ try{ const res = await fetch(cfg.API_BASE.replace(/\/$/,'') + '/latest?ts=' + Date.now(), { cache:'no-store' }); if(res.ok) return await res.json(); }catch(e){ console.warn('live api fallback', e); } }
    const paths = ['data/live-sample.json','../data/live-sample.json'];
    for(const p of paths){ try{ const res = await fetch(p,{cache:'no-store'}); if(res.ok) return await res.json(); }catch{} }
    return null;
  }
  function renderLive(data){
    if(!data) return;
    qsa('[data-live-field]').forEach(el => { const key = el.dataset.liveField; el.textContent = data[key] || '-'; });
    qsa('[data-live-list]').forEach(el => { const key = el.dataset.liveList; const arr = Array.isArray(data[key]) ? data[key] : []; el.innerHTML = arr.map(v => `<li>${esc(String(v))}</li>`).join('') || '<li>업데이트 대기</li>'; });
    qsa('[data-live-chips]').forEach(el => { const key = el.dataset.liveChips; const arr = Array.isArray(data[key]) ? data[key] : []; el.innerHTML = arr.map(v => `<span class="pill">${esc(String(v))}</span>`).join('') || '<span class="pill">업데이트 대기</span>'; });
    qsa('[data-live-sources]').forEach(el => { const arr = Array.isArray(data.sources) ? data.sources : []; el.innerHTML = arr.length ? arr.map((s,i)=> `<a href="${attr(s.uri||'#')}" target="_blank" rel="noopener">${i+1}. ${esc(s.title || s.uri || 'source')}</a>`).join('') : '<p>관리자 업데이트 시 출처가 표시됩니다.</p>'; });
  }
  function esc(str){return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));}
  function attr(str){return esc(str).replace(/`/g,'&#96;');}
  if(qs('[data-live-root]')) getLatest().then(renderLive);
})();
