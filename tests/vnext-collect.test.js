import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('STEP 1 renders no calendar-day cards but auto-generates real dates',async()=>{
 const [html,ui]=await Promise.all([read('public/index.html'),read('public/static/vnext.js')]);
 const before=html.indexOf('id="yg-step-one"'),after=html.indexOf('id="yg-step-two-intro"');
 const section=html.slice(before,after);
 assert.doesNotMatch(section,/id="yg-day-cards"|class="yg-date-pill"/);
 assert.match(section,/id="yg-start-date"/);assert.match(section,/id="yg-end-date"/);assert.match(section,/id="yg-duration"/);
 assert.match(ui,/app\.setTravelDates\(start,end\)/);
 assert.match(ui,/function renderDates\(\)\{\/\*/);
});

test('STEP 2 DOM order is search then saved-list then Naver map then endpoint panel',async()=>{
 const html=await read('public/index.html');
 const idx=['id="yg-add-visit"','id="yg-open-stops"','id="map-region"','id="yg-endpoint-section"','id="yg-active-date"','id="yg-origin-pick"','id="yg-dest-pick"'].map(x=>html.indexOf(x));
 assert.ok(idx.every(n=>n>=0));assert.deepEqual(idx,[...idx].sort((a,b)=>a-b));
 assert.match(html,/id="yg-fit-all"/);
});

test('date-unassigned visits live in compatible days data, are never force-assigned on search',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/unassignedStops:\[\]/);
 assert.match(app,/unassignedStops:\(data\.unassignedStops\|\|\[\]\)\.map\(omitStay\)/);
 assert.match(app,/state\.days\[0\]\.unassignedStops\.push\(stop\)/);
 assert.match(app,/function setStopFixedDate\(id,value\)/);
 assert.match(app,/stop\.fixedDate=value\|\|null/);
 assert.match(app,/function allStops\(\)/);
 assert.match(app,/invalidateRoutes\(\);refresh\(\)/);
});

test('visit date changes remain reversible, and route results invalidate on data changes',async()=>{
 const app=await read('public/static/app.js'),wizard=await read('public/static/vnext.js');
 assert.match(app,/if\(target\)target\.stops\.push\(stop\)/);
 assert.match(app,/else state\.days\[0\]\.unassignedStops\.push\(stop\)/);
 assert.match(wizard,/data-fixed-id/);assert.match(wizard,/option value="">날짜 미배정/);
 assert.match(wizard,/app\.setStopFixedDate\(select\.dataset\.fixedId,select\.value\)/);
 assert.match(app,/function invalidateRoutes\(\)/);
});

test('date allocation uses fixed dates and real road routing APIs, with no fabricated route labels',async()=>{
 const [wizard,multi,core]=await Promise.all([read('public/static/vnext.js'),read('lib/multi-day.js'),read('lib/core.js')]);
 assert.match(wizard,/fetch\('\/api\/multi-route'/);
 assert.match(wizard,/fetch\('\/api\/route'/);
 assert.match(wizard,/fixedDate:d\.date/);
 assert.match(wizard,/pending\.map\(p=>\(\{\.\.\.p,fixedDate:null\}\)\)/);
 assert.match(multi,/for\(const place of trip\.stops\)if\(place\.fixedDate\)/);
 assert.match(multi,/await buildPlan\(/);
 assert.match(core,/signal:AbortSignal\.timeout\(5500\)/);
 assert.match(core,/r\.status|source:'estimate'|status=road===0/);
});

test('shared custom markers use GPS coordinates and matching pixel dimensions',async()=>{
 const [pins,css,app,search]=await Promise.all([read('public/static/route-pins.js'),read('public/static/route-pins.css'),read('public/static/app.js'),read('public/static/search-screen.js')]);
 assert.match(pins,/new maps\.LatLng\(lat,lng\)/);
 assert.match(pins,/anchor:new maps\.Point\(22,52\)/);
 assert.match(css,/width:44px!important;height:52px!important/);
 assert.match(app,/YeoPins\?\.marker/);assert.match(search,/YeoPins\?\.marker/);
 assert.match(pins,/type==='origin'\?'S':type==='destination'\?'E'/);
});

test('STEP 2 shows all visits before calculating; STEP 3 shows date-specific order',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/collecting\?\[\.\.\.allStops\(\),\.\.\.state\.days\.flatMap/);
 assert.match(app,/const points=collecting/);
 assert.match(app,/stopNumber=d\.result\?\.entries\?\.findIndex/);
 assert.match(app,/if\(!collecting&&routePanelVisible&&r\?\.entries\)/);
 assert.match(app,/i===0\?'S':i===r\.entries\.length-1\?'E':i/);
});

test('map draws only NAVER returned road polyline [longitude,latitude], in orange dual strokes',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/new naver\.maps\.LatLng\(p\[1\],p\[0\]\)/);
 assert.match(app,/#ed5e17/);
 assert.match(app,/#8a370d/);
 assert.match(app,/leg\.source==='estimate'/);
 assert.match(app,/for\(const entry of r\.entries\.slice\(1\)\)/);
});

test('readable STEP 3 controls have map fit, zoom, and full-screen actions separated from result toolbar',async()=>{
 const [html,css,workspace]=await Promise.all([read('public/index.html'),read('public/static/vnext.css'),read('public/static/map-workspace.js')]);
 for(const id of ['yg-route-fit','map-zoom-out','map-zoom-in','map-maximize','yg-step-three-actions','yg-three-recalc'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(workspace,/\$\('yg-route-fit'\)\.addEventListener\('click',fit\)/);
 assert.match(css,/@media\(min-width:769px\)/);
 assert.match(css,/position:static!important;bottom:auto!important/);
});

test('saved and cloud trips retain unassigned pool and refresh date selectors when loaded',async()=>{
 const [app,accounts,wizard]=await Promise.all([read('public/static/app.js'),read('public/static/accounts.js'),read('public/static/vnext.js')]);
 assert.match(accounts,/function currentDays\(\)/);assert.match(accounts,/\.\.\.day/);
 assert.match(app,/document\.dispatchEvent\(new Event\('trip:days-imported'\)\)/);
 assert.match(wizard,/addEventListener\('trip:days-imported'/);
 assert.match(app,/unassignedStops:\(data\.unassignedStops\|\|\[\]\)\.map/);
});
