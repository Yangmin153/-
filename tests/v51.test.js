import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('v5.1 region onboarding is before the map AND editor workspace',async()=>{
 const html=await read('public/index.html');
 const region=html.indexOf('class="region-onboarding"'),workspace=html.indexOf('id="trip-workspace"'),map=html.indexOf('id="map-region"');
 assert.ok(region>0&&region<workspace&&region<map);
 for(const id of ['region-confirm','region-selection-state','trip-region','region-shortcuts'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.match(html,/직접 입력<\/label>/);
 assert.match(html,/이 지역으로 여행 시작하기/);
});

test('v5.1 region selection is required before opening mobile fullscreen search',async()=>{
 const js=await read('public/static/design-v51.js'),screen=await read('public/static/search-screen.js'),app=await read('public/static/app.js');
 assert.match(js,/function ensureSelected\(\)/);
 assert.match(js,/const ready=Boolean\(current&&chosen===current\)/);
 assert.match(js,/accept\(b\.dataset\.regionChoice\)/);
 assert.match(screen,/window\.YeoRegion\.ensureSelected\(\)/);
 assert.match(app,/window\.YeoRegion\.ensureSelected\(\)/);
});

test('v5.1 choosing a region changes map without touching origin, destination or stops',async()=>{
 const app=await read('public/static/app.js'),ui=await read('public/static/design-v51.js');
 assert.match(app,/function centerMapAtRegion\(place\)/);
 assert.match(app,/pendingRegionFocus=\{lat:place\.lat,lng:place\.lng,zoom:11\}/);
 assert.match(app,/map\.setCenter\(new naver\.maps\.LatLng\(place\.lat,place\.lng\)\)/);
 assert.match(ui,/\/api\/geocode\?q=/);
 assert.match(ui,/controller\.abort\(\)/);
 assert.match(ui,/if\(seq!==token\)return false/);
 assert.match(ui,/app\(\)\?\.centerMapAtRegion/);
 assert.match(ui,/localStorage\.setItem\(choiceKey,v\)/);
});

test('v5.1 faster typeahead with bounded in-memory cache',async()=>{
 const quick=await read('public/static/quick-add.js');
 assert.match(quick,/TTL=45000,LIMIT=36/);
 assert.match(quick,/timer=setTimeout\(\(\)=>search\(\),170\)/);
 assert.match(quick,/abort\.abort\(\)/);
 assert.match(quick,/if\(current!==sequence\)return/);
 assert.match(quick,/cache\.set\(path/);
 assert.match(quick,/cache\.size>LIMIT/);
});

test('v5.1 collection mode has a prominent fast search action and brand colors',async()=>{
 const app=await read('public/static/app.js'),css=await read('public/static/design-v51.css');
 assert.match(app,/data-bag-search/);
 assert.match(app,/bagSearch=e\.target\.closest/);
 assert.match(app,/window\.YeoSearch\.show\(\)/);
 assert.match(css,/background:linear-gradient\(145deg,#164FAF/);
 assert.match(css,/\.bag-search-trigger/);
 assert.match(css,/@media\(max-width:768px\)/);
});
test('v5.1 requires an explicit region selection even when example stops exist',async()=>{
 const js=await read('public/static/design-v51.js');
 assert.match(js,/if\(restore&&restore===normalize\(app\(\)\?\.getRegion\(\)\)\)/);
 assert.doesNotMatch(js,/some\(d=>d\.stops\?\.length\)/);
});

test('v5.1 desktop bag mode opens the same fast collection search',async()=>{
 const app=await read('public/static/app.js'),screen=await read('public/static/search-screen.js'),quick=await read('public/static/quick-add.js'),css=await read('public/static/design-v51.css');
 assert.match(app,/if\(window\.YeoSearch\)window\.YeoSearch\.show\(\);else openModal\('stop'\)/);
 assert.match(screen,/if\(opened\)return;/);
 assert.match(quick,/function add\(item,button=null\)\{\s*if\(window\.YeoRegion&&!window\.YeoRegion\.ensureSelected\(\)\)return;/);
 assert.match(css,/@media\(min-width:769px\)/);
});
