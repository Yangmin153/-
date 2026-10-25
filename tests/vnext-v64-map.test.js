import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
async function geometry(){
 const context={};context.globalThis=context;
 runInNewContext(await read('public/static/route-shape.js'),context);
 return context.YeoRoadShape;
}
const p=(lat,lng)=>({lat,lng});
const plain=x=>JSON.parse(JSON.stringify(x));

test('rendered Naver road shape leaves real coordinates unchanged when no endpoint spur',async()=>{
 const road=await geometry();
 const geometryPoints=[[126.00005,33],[126.00015,33],[126.00030,33],[126.00045,33]];
 assert.deepEqual(plain(road.displayPath(geometryPoints,p(33,126),p(33,126.00046))),geometryPoints);
});
test('short Naver road snapping spur is removed at origin, not redirected with a fake connector',async()=>{
 const road=await geometry();
 const geometryPoints=[[126.00027,33],[126.00004,33],[126.00018,33],[126.00044,33]];
 assert.deepEqual(plain(road.displayPath(geometryPoints,p(33,126),p(33,126.00044))),geometryPoints.slice(1));
});
test('short reversed endpoint spur is trimmed without moving the destination',async()=>{
 const road=await geometry();
 const points=[[126.00004,33],[126.00020,33],[126.00042,33],[126.00069,33]];
 const cleaned=plain(road.displayPath(points,p(33,126.00004),p(33,126.00043)));
 assert.deepEqual(cleaned,points.slice(0,-1));
});
test('long access roads and loops survive, malformed or duplicate GPS points do not',async()=>{
 const road=await geometry();
 const path=[[126,33],[126,33],['bad',33],[126.0015,33],[126.005,33]];
 assert.deepEqual(plain(road.displayPath(path,p(33,126),p(33,126.005))),[[126,33],[126.0015,33],[126.005,33]]);
 assert.ok(road.metres([126,33],[126.005,33])>400);
});
test('both steps share Korean start/end pins and marker anchor equals actual pin-tip geometry',async()=>{
 const [pins,css]=await Promise.all([read('public/static/route-pins.js'),read('public/static/route-pins.css')]);
 assert.match(pins,/type==='origin'\?'출발':type==='destination'\?'도착'/);
 assert.match(pins,/new maps\.LatLng\(lat,lng\)/);
 assert.match(pins,/anchor:new maps\.Point\(22,52\)/);
 assert.match(css,/width:44px!important;height:52px!important/);
 assert.match(css,/\.yg-map-pin--origin \.yg-map-pin__head b/);
});
test('thin single blue Naver segment never adds a second orange navigation outline',async()=>{
 const [app,html]=await Promise.all([read('public/static/app.js'),read('public/index.html')]);
 const start=app.indexOf('if(!collecting&&routePanelVisible&&r?.entries)');
 const end=app.indexOf('if(mapFitQueued)',start);
 const drawing=app.slice(start,end);
 assert.match(drawing,/YeoRoadShape\?\.displayPath\(leg\.path,previous,current\)/);
 assert.match(drawing,/strokeColor:'#2979D9'/);
 assert.match(drawing,/strokeWeight:4\.5/);
 assert.equal((drawing.match(/new naver\.maps\.Polyline/g)||[]).length,1);
 assert.doesNotMatch(drawing,/#ed5e17|#8a370d|strokeWeight:9/);
 assert.match(html,/src="\/static\/route-shape\.js\?v=6\.4\.0"/);
});
test('saved places bottom sheet freezes background while allowing inside list to scroll',async()=>{
 const [ui,css]=await Promise.all([read('public/static/vnext.js'),read('public/static/vnext.css')]);
 assert.match(ui,/body\.style\.position='fixed'/);
 assert.match(ui,/body\.style\.top='-'\+sheetFreeze\.scrollY\+'px'/);
 assert.match(ui,/window\.scrollTo\(\{top:hold\.scrollY,behavior:'instant'\}\)/);
 assert.match(ui,/if\(!searchOpen\)/);
 assert.match(css,/body\.yg-sheet-open \.yg-sheet-list/);
 assert.match(css,/-webkit-overflow-scrolling:touch/);
});
