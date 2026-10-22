import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('대중교통 UI, 경로 API 및 파일 제거',async()=>{
 for(const path of ['public/index.html','public/static/app.js','api/config.js','vercel.json','dev-server.js'])assert.doesNotMatch(await read(path),/ODSAY|transitReady|\/api\/transit|transport-transit|대중교통/);
 for(const path of ['api/transit.js','lib/transit.js'])await assert.rejects(access(new URL('../'+path,import.meta.url)));
 assert.match(await read('public/static/app.js'),/const \{transport,\.\.\.data\}=d/);
});
test('네이버 지도 SDK 준비 후 초기화 및 인증 오류 처리',async()=>{
 const code=await read('public/static/app.js');
 for(const term of ['ncpKeyId','callback=__ygNaverMapsLoaded','navermap_authFailure','ResizeObserver','autoResize','mapHasArea()','Dynamic Map'])assert.ok(code.includes(term),term);
});
test('컴팩트 결과, 상단 스티키, 모바일 안전 영역과 터치',async()=>{
 const html=await read('public/index.html'),js=await read('public/static/quick-add.js'),css=await read('public/static/native-v47.css');
 assert.ok(html.includes('id="quick-search-dock"'));
 for(const t of ['quick-result-heading','quick-result-category','quick-result-info','quick-direct-add'])assert.ok(js.includes(t),t);
 for(const t of ['55px','position:sticky','overflow-y:auto','100dvh','safe-area-inset-bottom','font-size:16px!important','transform:scale(.98)','-webkit-tap-highlight-color:transparent'])assert.ok(css.includes(t),t);
});
test('네이버 자동차 및 카카오 장소 검색 엔드포인트 유지',async()=>{
 assert.match(await read('api/route.js'),/buildPlan/);assert.match(await read('api/places.js'),/searchPlaces/);
});
