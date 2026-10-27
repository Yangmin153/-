import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('대중교통 UI, 경로 API 및 파일 제거',async()=>{
 for(const path of ['public/static/app.js','api/config.js','vercel.json','dev-server.js'])assert.doesNotMatch(await read(path),/ODSAY|transitReady|\/api\/transit|transport-transit/);assert.match(await read('public/index.html'),/대중교통 · 지원 준비 중/);
 for(const path of ['api/transit.js','lib/transit.js'])await assert.rejects(access(new URL('../'+path,import.meta.url)));
 assert.match(await read('public/static/app.js'),/const \{transport,liveOrigin,\.\.\.data\}=d/);
});
test('네이버 지도 SDK 준비 후 초기화 및 인증 오류 처리',async()=>{
 const code=await read('public/static/app.js');
 for(const term of ['ncpKeyId','callback=__ygNaverMapsLoaded','navermap_authFailure','ResizeObserver','autoResize','mapHasArea()','Dynamic Map'])assert.ok(code.includes(term),term);
});
test('컴팩트 결과, 하단 고정 검색창, 모바일 안전 영역과 터치',async()=>{
 const html=await read('public/index.html'),js=await read('public/static/quick-add.js'),css=await read('public/static/native-v47.css');
 assert.ok(html.includes('id="mobile-bottom-actions"'));assert.ok(html.indexOf('id="mobile-bottom-actions"')<html.indexOf('id="quick-form"'));
 for(const t of ['quick-result-heading','quick-result-category','quick-result-info','quick-direct-add'])assert.ok(js.includes(t),t);
 for(const t of ['100dvh','safe-area-inset-bottom','font-size:16px!important','transform:scale(.98)','-webkit-tap-highlight-color:transparent'])assert.ok(css.includes(t),t);const v48=await read('public/static/tabs-v48.css');for(const t of ['51px','position:fixed','bottom:calc(100%','overflow-y:auto'])assert.ok(v48.includes(t),t);
});
test('네이버 자동차 및 카카오 장소 검색 엔드포인트 유지',async()=>{
 assert.match(await read('api/route.js'),/buildPlan/);assert.match(await read('api/places.js'),/searchPlaces/);
});
