'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const safety = require('../assets/js/briefing-safety');
const generator = require('../scripts/update-market');
const NOW = new Date('2026-11-05T20:00:00.000Z');
const facts = ['2026-11-05 발표 자료의 첫 번째 사실을 원문에서 확인했습니다.', '2026-11-05 발표 자료의 두 번째 사실을 원문에서 확인했습니다.', '2026-11-05 발표 자료의 세 번째 사실을 원문에서 확인했습니다.'];
function response() {
 const raw = JSON.stringify({summary:facts});
 return {candidates:[{finishReason:'STOP',content:{parts:[{text:raw}]},groundingMetadata:{groundingChunks:[{web:{title:'Reuters article',uri:'https://www.reuters.com/markets/article'}},{web:{title:'BOK release',uri:'https://www.bok.or.kr/portal/release'}}],groundingSupports:facts.map((t,i)=>{const text=JSON.stringify(t).slice(1,-1),startIndex=raw.indexOf(text);return {segment:{text,startIndex,endIndex:startIndex+text.length},groundingChunkIndices:[i%2]};})}}]};
}
const goodFetch = async () => new Response('<html>article</html>',{status:200,headers:{'content-type':'text/html'}});
async function ready() { return generator.buildReport(response(),{now:NOW,fetchFn:goodFetch}); }
for (const url of ['http://www.reuters.com/markets/a','https://example.com/source1','https://localhost/a','https://127.0.0.1/a','https://[::1]/a','https://reuters.com.evil.test/a','https://reuters.com@evil.test/a','https://u:p@reuters.com/a','javascript:alert(1)','data:text/html,x','https://www.reuters.com:8443/a','https://reuters.com./a','https://www.reuters.com/','https://www.reuters.com/sample','not-url']) test('reject URL '+url,()=>assert.equal(safety.safeSourceUrl(url),null));
test('accept genuine HTTPS publisher article',()=>assert.equal(safety.safeSourceUrl('https://www.reuters.com/markets/article'),'https://www.reuters.com/markets/article'));
test('valid supported report preserves all claims and bound sources',async()=>{const r=await ready();assert.ok(safety.validateReport(r,NOW.getTime()));assert.deepEqual(r.summary.map(i=>i.text),facts);assert.equal(r.sources.length,2);assert.equal(r.actionPlan,undefined);});
for (const [name,mutate] of [
 ['missing grounding',d=>delete d.candidates[0].groundingMetadata],
 ['model supplied sources',d=>d.candidates[0].content.parts[0].text=JSON.stringify({summary:facts,sources:[{url:'https://example.com'}]})],
 ['unsupported final claim',d=>d.candidates[0].groundingMetadata.groundingSupports.pop()],
 ['invalid chunk index',d=>d.candidates[0].groundingMetadata.groundingSupports[0].groundingChunkIndices=[50]],
 ['negative chunk index',d=>d.candidates[0].groundingMetadata.groundingSupports[0].groundingChunkIndices=[-1]],
 ['mismatched support text',d=>d.candidates[0].groundingMetadata.groundingSupports[0].segment.text='fabricated'],
 ['oversized offset',d=>{const c=d.candidates[0];c.groundingMetadata.groundingSupports=[{segment:{startIndex:0,endIndex:999999,text:c.content.parts[0].text},groundingChunkIndices:[0,1]}]}],
 ['wrong part index',d=>d.candidates[0].groundingMetadata.groundingSupports[0].segment.partIndex=999],
 ['multiple parts',d=>d.candidates[0].content.parts.push({text:' '})],
 ['negative offset',d=>d.candidates[0].groundingMetadata.groundingSupports[0].segment.startIndex=-1],
 ['safety block',d=>d.promptFeedback={blockReason:'SAFETY'}],
 ['truncated output',d=>d.candidates[0].finishReason='MAX_TOKENS'],
 ['empty candidates',d=>d.candidates=[]],
 ['malformed JSON',d=>d.candidates[0].content.parts[0].text='not json'],
 ['wrong summary type',d=>d.candidates[0].content.parts[0].text='{"summary":"wrong"}'],
 ['markdown JSON',d=>d.candidates[0].content.parts[0].text='```json\n'+d.candidates[0].content.parts[0].text+'\n```'],
 ['placeholder grounding URL',d=>d.candidates[0].groundingMetadata.groundingChunks[0].web.uri='https://example.com/source1'],
 ['placeholder title',d=>d.candidates[0].groundingMetadata.groundingChunks[0].web.title='가상 출처 1']
]) test('fail closed: '+name,async()=>{const d=response();mutate(d);await assert.rejects(generator.buildReport(d,{now:NOW,fetchFn:goodFetch}));});
test('supports with UTF-8 byte offsets',async()=>{const d=response(),raw=d.candidates[0].content.parts[0].text;for(const s of d.candidates[0].groundingMetadata.groundingSupports){s.segment.endIndex=Buffer.byteLength(raw.slice(0,s.segment.endIndex));s.segment.startIndex=Buffer.byteLength(raw.slice(0,s.segment.startIndex));}assert.ok(await generator.buildReport(d,{now:NOW,fetchFn:goodFetch}));});
for (const [name,fetchFn] of [
 ['HTTP failure',async()=>new Response('',{status:404})],
 ['non HTML',async()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}})],
 ['private redirect',async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})],
 ['untrusted redirect',async()=>new Response(null,{status:302,headers:{location:'https://attacker.test/a'}})],
 ['redirect loop',async()=>new Response(null,{status:302,headers:{location:'https://www.reuters.com/markets/article'}})],
 ['timeout',async()=>{throw new Error('timeout')}]
]) test('source '+name,async()=>assert.rejects(generator.verifySource({title:'Reuters',uri:'https://www.reuters.com/markets/article'},fetchFn,NOW)));
test('Google grounding redirect resolves only to approved publisher',async()=>{let calls=0;const r=await generator.verifySource({title:'Reuters',uri:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc'},async()=>++calls===1?new Response(null,{status:302,headers:{location:'https://www.reuters.com/markets/article'}}):goodFetch(),NOW);assert.equal(r.url,'https://www.reuters.com/markets/article');assert.equal(calls,2);});
for(const [name,mutate] of [
 ['legacy report',r=>delete r.schemaVersion],['unavailable',r=>r.status='unavailable'],['expired',r=>r.expiresAt='2026-11-05T19:59:59.000Z'],['future generated',r=>r.generatedAt='2026-11-06T00:00:00.000Z'],['long expiry',r=>r.expiresAt='2026-11-08T00:00:00.000Z'],['invalid timestamp',r=>r.generatedAt='yesterday'],['source unchecked',r=>delete r.sources[0].checkedAt],['future source',r=>r.sources[0].checkedAt='2026-11-06T00:00:00.000Z'],['unbound claim',r=>r.summary[0].sourceIndexes=[99]],['not grounded',r=>r.summary[0].grounded=false],['duplicate sources',r=>r.sources[1]=r.sources[0]],['sources not array',r=>r.sources={}]
]) test('browser rejects '+name,async()=>{const r=await ready();mutate(r);assert.equal(safety.validateReport(r,NOW.getTime()),false);});
for(const [name,options] of [ ['missing key',{apiKey:''}], ['API failure',{apiKey:'test-only',fetchFn:async()=>new Response('sensitive error details',{status:500})}], ['API safety',{apiKey:'test-only',fetchFn:async()=>new Response(JSON.stringify({promptFeedback:{blockReason:'SAFETY'}}),{status:200})}] ]) test('generator persists unavailable for '+name,async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'briefing-test-')),output=path.join(dir,'today.json');fs.writeFileSync(output,'{"unsafe":"old narrative"}');const r=await generator.generate({...options,now:NOW,output});const saved=JSON.parse(fs.readFileSync(output));assert.equal(r.status,'unavailable');assert.deepEqual(saved.sources,[]);assert.deepEqual(saved.summary,[]);assert.equal(saved.unsafe,undefined);assert.ok(!fs.readFileSync(output,'utf8').includes('sensitive'));fs.rmSync(dir,{recursive:true});});
function frontend(fetchFn) {
 const detail={innerHTML:''},fields=Object.fromEntries(['regime','summary','temperature','riskLevel','updatedAt'].map(k=>[k,{textContent:''}]));
 const preview={querySelector:s=>fields[s.match(/"(\w+)"/)?.[1]]||null};
 const document={addEventListener(){},querySelector:s=>s==='#liveDetail'?detail:null,querySelectorAll:s=>s==='[data-live-root]'?[preview]:[]};
 const context={document,fetch:fetchFn,BriefingSafety:{...safety,validateReport:r=>safety.validateReport(r,NOW.getTime())},Date,Intl,AbortSignal,setInterval(){},console,URL};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/site.js'),'utf8'),context);return {context,detail,fields};
}
test('homepage and detail hide legacy fabricated report',async()=>{const ui=frontend(async()=>new Response(JSON.stringify({marketTitle:'unsafe',actionPlan:{holder:'buy'},sources:[{title:'가상 출처 1',url:'http://example.com/source1'}]})));await vm.runInContext('loadToday()',ui.context);assert.match(ui.detail.innerHTML,/오늘 브리핑 확인 중/);assert.doesNotMatch(ui.detail.innerHTML,/example.com|unsafe|buy|가상 출처/);assert.match(ui.fields.summary.textContent,/표시하지 않습니다/);});
test('fetch failure shows explicit unavailable on both surfaces',async()=>{const ui=frontend(async()=>new Response('',{status:500}));await vm.runInContext('loadToday()',ui.context);assert.match(ui.detail.innerHTML,/오늘 브리핑 확인 중/);assert.equal(ui.fields.regime.textContent,'오늘 브리핑 확인 중');});
test('malformed fetch JSON shows unavailable',async()=>{const ui=frontend(async()=>new Response('oops'));await vm.runInContext('loadToday()',ui.context);assert.match(ui.detail.innerHTML,/오늘 브리핑 확인 중/);});
test('direct detail invocation cannot bypass validation',()=>{const ui=frontend(async()=>new Response('oops'));ui.context.inject={marketTitle:'unsafe'};vm.runInContext('renderLiveDetail(inject)',ui.context);assert.doesNotMatch(ui.detail.innerHTML,/unsafe/);});
test('valid report renders escaped text and safe links, no advice',async()=>{const r=await ready();r.summary[0].text='<img src=x onerror=alert(1)> '+r.summary[0].text;const ui=frontend(async()=>new Response(JSON.stringify(r)));await vm.runInContext('loadToday()',ui.context);assert.match(ui.detail.innerHTML,/&lt;img/);assert.doesNotMatch(ui.detail.innerHTML,/<img|보유자 대응|신규·현금 전략/);assert.match(ui.detail.innerHTML,/noopener noreferrer/);});
test('page entrypoints load safety gate before renderer',()=>{for(const name of ['index.html','live.html']){const s=fs.readFileSync(path.join(__dirname,'..',name),'utf8');assert.ok(s.indexOf('briefing-safety.js')<s.indexOf('assets/js/site.js'));}});
test('scheduled data writers serialize and use safe retry script',()=>{for(const name of ['update-market.yml','update-charts.yml']){const s=fs.readFileSync(path.join(__dirname,'../.github/workflows',name),'utf8');assert.match(s,/group: market-data-writes/);assert.match(s,/cancel-in-progress: false/);assert.match(s,/fetch-depth: 0/);assert.match(s,/bash scripts\/commit-data.sh/);}const s=fs.readFileSync(path.join(__dirname,'../scripts/commit-data.sh'),'utf8');assert.doesNotMatch(s,/push\s+--force|reset\s+--hard/);assert.match(s,/git rebase --abort/);});

for (const value of ['2026-10-01 오래된 사건에 대한 충분히 긴 설명입니다.', '2026-11-07 미래 사건에 대한 충분히 긴 설명입니다.', '날짜를 포함하지 않은 충분히 긴 자동 생성 설명입니다.', '2026-11-05 지금 종목을 매수하는 것을 추천합니다.', '2026-11-05 종목 비중을 확대하는 것이 좋습니다.', '2026-02-30 잘못된 날짜를 포함한 충분히 긴 설명입니다.']) test('reject unsafe summary '+value,()=>assert.equal(safety.safeSummary(value,NOW.getTime()),false));
test('accept Korean current date across UTC day boundary',()=>assert.equal(safety.safeSummary('2026-11-06 발표된 새 문서가 공개되었다고 설명합니다.',NOW.getTime()),true));
test('browser rejects stale or advisory summary even with valid source indexes',async()=>{for(const value of ['2026-10-01 오래된 사건에 대한 충분히 긴 설명입니다.','2026-11-05 지금 매수하는 것을 추천합니다.']){const r=await ready();r.summary[0].text=value;assert.equal(safety.validateReport(r,NOW.getTime()),false);}});
test('diagnostic write failure does not block saving unavailable',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'briefing-diagnostic-')),old=process.env.GITHUB_STEP_SUMMARY;process.env.GITHUB_STEP_SUMMARY=dir;try{const r=await generator.generate({apiKey:'',now:NOW,output:path.join(dir,'today.json')});assert.equal(r.status,'unavailable');}finally{if(old===undefined)delete process.env.GITHUB_STEP_SUMMARY;else process.env.GITHUB_STEP_SUMMARY=old;fs.rmSync(dir,{recursive:true});}});
