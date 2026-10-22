import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('대중교통 전면 제거 및 자동차 엔진 유지',async()=>{
 const files=['public/index.html','public/static/app.js','api/config.js','vercel.json','dev-server.js'];
 for(const p of files){const s=await read(p);assert.doesNotMatch(s,/ODSAY|transitReady|\/api\/transit|transport-transit|대중교통/);}
 for(const p of ['api/transit.js','lib/transit.js'])await assert.rejects(access(new URL('../'+p,import.meta.url)));
 assert.match(await read('public/static/app.js'),/const \{transport,\.\.\.data\}=d/);
});
test('네이버 지도 SDK 준비 및 인증/크기 오류 처리',async()=>{
 const s=await read('public/static/app.js');
 for(const term of ['ncpKeyId','callback=__ygNaverMapsLoaded','navermap_authFailure','ResizeObserver','autoResize','mapHasArea()','Dynamic Map'])assert.ok(s.includes(term),term);
});
test('검색 결과는 밀도 높은 두 줄+우측 추가 버튼',async()=>{
 const h=await read('public/index.html'),q=await read('public/static/quick-add.js'),css=await read('public/static/native-v47.css');
 assert.ok(h.includes('id="quick-search-dock"'));
 for(const term of ['quick-result-heading','quick-result-category','quick-result-info','quick-direct-add'])assert.ok(q.includes(term));
 for(const term of ['55px','position:sticky','overflow-y:auto','100dvh','safe-area-in���q�^