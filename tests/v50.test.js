import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('지도 조작 버튼은 지도 외부에 있고 기존 네이버 지도 도구는 유지',async()=>{
 const html=await read('public/index.html'),mapStart=html.indexOf('id="map-region"');
 for(const id of ['map-control-bar','map-lock','map-maximize','map-zoom-in','map-zoom-out'])
  assert.ok(html.indexOf('id="'+id+'"')>0&&html.indexOf('id="'+id+'"')<mapStart,id);
 assert.ok(html.indexOf('id="map-day-select"')>mapStart);
});
test('장소만 담기 화면은 제거되고 장소 수집 목록 하나로 통합',async()=>{
 const html=await read('public/index.html'),app=await read('public/static/app.js'),css=await read('public/static/design-v53.css');
 assert.doesNotMatch(html,/id="stop-view-switch"/);
 assert.doesNotMatch(app,/data-bag-search|data-bag-apply|data-bag-clear/);
 assert.match(app,/v53-stop/);assert.match(app,/d\.stops\.map\(stop=>/);
 assert.match(css,/\.stop-view-switch/);
});
test('방문지는 번호 없이 장소·분류·삭제 버튼만 표시',async()=>{
 const app=await read('public/static/app.js'),css=await read('public/static/design-v53.css');
 assert.match(app,/class="remove-stop"/);assert.match(app,/TripMeta\.meta\(stop\)/);
 assert.doesNotMatch(app,/data-stop-pin|data-cycle-category/);
 assert.match(css,/\.stop-num/);
});
test('지역 선택과 지도 중심 위치 변경 유지',async()=>{
 const html=await read('public/index.html'),region=await read('public/static/design-v51.js');
 assert.match(html,/어디로 떠나시나요/);assert.match(html,/id="btn-change-region"/);
 assert.match(region,/function rechoose\(\)/);assert.match(region,/centerMapAtRegion/);
});
test('브랜드와 네이버 지도 도구 유지',async()=>{
 const html=await read('public/index.html'),css=await read('public/static/design-v50.css');
 assert.match(css,/--yg-primary:#286CF4/);assert.match(html,/pretendardvariable-dynamic-subset\.css/);
 assert.match(await read('public/static/map-workspace.js'),/map\.setZoom\(next\)/);
});
