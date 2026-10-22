import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('v5: map buttons and contextual panels are outside the map viewport',async()=>{
 const html=await read('public/index.html');
 const mapStart=html.indexOf('<div class="map-region" id="map-region">');
 const mapEnd=html.indexOf('<div class="result-section" id="route-results">');
 assert.ok(html.indexOf('id="map-control-bar"')<mapStart);
 for(const id of ['map-overlay-controls','map-lock','map-maximize','map-day-select','map-full-close']){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  assert.ok(html.indexOf('id="'+id+'"')<mapStart,id);
 }
 for(const id of ['map-place-preview','map-select-notice','map-sheet']){
  const pos=html.indexOf('id="'+id+'"');
  assert.ok(pos>mapStart&&pos<mapEnd,id+' location check');
 }
 assert.match(await read('public/static/design-v50.css'),/\.map-control-bar \.map-overlay-controls\{position:static!important/);
});
test('v5: two stop presentations reuse the same d.stops and bag forces AUTO algorithm',async()=>{
 const html=await read('public/index.html'),app=await read('public/static/app.js');
 assert.match(html,/data-stop-view="list"/);
 assert.match(html,/data-stop-view="bag"/);
 assert.match(app,/STOP_VIEW_KEY='yeohaenggil\.stopView\.v1'/);
 assert.match(app,/if\(stopView==='bag'\)/);
 assert.match(app,/d\.stops\.map\(stop=>/);
 assert.match(app,/d\.stops\.map\(\(stop,i\)=>/);
 assert.match(app,/data-bag-apply/);
 assert.match(app,/if\(stopView==='bag'\)d\.mode='auto'/);
 assert.match(app,/data-bag-clear/);
 assert.match(app,/return;\s*\}\s*\$\('stops-list'\)\.innerHTML=d\.stops\.map/);
});
test('v5: selected chips remove by existing stop-id handler without new persisted trip model',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/class="remove-stop" data-stop-id=/);
 assert.match(app,/if\(btn\.classList\.contains\('remove-stop'\)\)/);
 assert.match(app,/day\(\)\.stops=\[\];markDirty\(false\)/);
 assert.match(app,/if\(confirm\('이 방문지를 일정에서 삭제할까요\?'\)\)removeStop\(id\)/);
});
test('v5: big region onboarding and instant destination chips',async()=>{
 const html=await read('public/index.html'),ui=await read('public/static/design-v50.js');
 assert.match(html,/어디로 떠나시나요\?/);
 assert.match(html,/제주도, 부산처럼 가고 싶은 곳/);
 for(const region of ['제주','부산','강릉','경주','서울','여수'])assert.ok(html.includes('data-region-choice="'+region+'"'),region);
 assert.match(ui,/app\(\)\?\.setRegion\(choice\)/);
 assert.match(ui,/aria-pressed/);
});
test('v5: instant place added acknowledgement and count badge bounce',async()=>{
 const quick=await read('public/static/quick-add.js'),css=await read('public/static/design-v50.css'),design=await read('public/static/design-v50.js');
 assert.match(quick,/✓ 담았어요/);
 assert.match(quick,/trip:stop-added/);
 assert.match(quick,/setTimeout\(\(\)=>\{if\(sequence===completed/);
 assert.match(css,/\.quick-direct-add\.is-added/);
 assert.match(css,/yg-count-bounce/);
 assert.match(design,/badge\.classList\.add\('yg-count-bounce'\)/);
});
test('v5: typography and mobile map toolbar outside viewport work across breakpoints',async()=>{
 const html=await read('public/index.html'),css=await read('public/static/design-v50.css');
 assert.match(html,/pretendardvariable-dynamic-subset\.css/);
 assert.match(css,/--yg-primary:#286CF4/);
 assert.match(css,/--yg-ink:#191F28/);
 assert.match(css,/@media\(max-width:768px\)/);
 assert.match(css,/@media\(max-width:350px\)/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/body\.map-immersive \.map-control-bar/);
 assert.match(await read('public/static/map-workspace.js'),/top:small\?18:34/);
 assert.match(await read('public/static/app.js'),/zoomControl:false/);
 assert.match(html,/id="map-zoom-in"/);assert.match(html,/id="map-zoom-out"/);
 assert.match(await read('public/static/map-workspace.js'),/map\.setZoom\(next\)/);
});

