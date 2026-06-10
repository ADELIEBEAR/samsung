
(function(){
  const cfg = window.STRATEGY_NOTE_CONFIG || { API_BASE: "" };
  const $ = s => document.querySelector(s);
  const apiInput = $('#apiBase'); if(!apiInput) return;
  const tokenInput = $('#adminToken'), log = $('#adminLog'), preview = $('#previewJson');
  apiInput.value = localStorage.getItem('samsungApiBase') || cfg.API_BASE || '';
  tokenInput.value = localStorage.getItem('samsungAdminToken') || '';
  function save(){ localStorage.setItem('samsungApiBase', apiInput.value.trim()); localStorage.setItem('samsungAdminToken', tokenInput.value.trim()); }
  function out(msg){ log.textContent = `[${new Date().toLocaleTimeString()}] ${msg}\n` + log.textContent; }
  function base(){ return apiInput.value.trim().replace(/\/$/,''); }
  function headers(){ return { 'Content-Type':'application/json', 'Authorization':'Bearer ' + tokenInput.value.trim() }; }
  async function call(path, body){ save(); if(!base()) throw new Error('Worker API URL을 먼저 입력하세요.'); if(!tokenInput.value.trim()) throw new Error('관리자 토큰을 입력하세요.'); const res = await fetch(base()+path, { method:'POST', headers:headers(), body:JSON.stringify(body||{}) }); const text = await res.text(); let data; try{ data = JSON.parse(text); }catch{ data = { raw:text }; } if(!res.ok) throw new Error(data.error || text || '요청 실패'); return data; }
  $('#saveSettings')?.addEventListener('click', ()=>{ save(); out('설정 저장 완료'); });
  $('#loadLatest')?.addEventListener('click', async()=>{ try{ const res = await fetch(base()+'/latest?ts='+Date.now(),{cache:'no-store'}); const data = await res.json(); preview.value = JSON.stringify(data,null,2); out('공개 브리핑 불러오기 완료'); } catch(e){ out('불러오기 실패: '+e.message); } });
  $('#generateGemini')?.addEventListener('click', async()=>{ try{ out('Gemini 분석 생성 중...'); const data = await call('/admin/generate', { marketMemo: $('#marketMemo').value, tone: $('#tone').value, extraInstructions: $('#extraInstructions').value }); preview.value = JSON.stringify(data.payload || data, null, 2); out('생성 및 공개 저장 완료'); }catch(e){ out('생성 실패: '+e.message); } });
  $('#publishManual')?.addEventListener('click', async()=>{ try{ const payload = JSON.parse(preview.value || '{}'); const data = await call('/admin/publish', { payload }); preview.value = JSON.stringify(data.payload || payload, null, 2); out('수동 브리핑 공개 저장 완료'); }catch(e){ out('저장 실패: '+e.message); } });
})();
