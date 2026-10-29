import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const p=i=>({id:'p'+i,name:'방문지 '+i,lat:33.4+i*.01,lng:126.5+i*.009});
async function planner(){const g={URL,URLSearchParams};g.globalThis=g;vm.runInNewContext(await read('public/static/navigation.js'),g);return g.TripNaviPlanner;}
const day=()=>{const origin=p(50),destination=p(51),stops=[p(0),p(1),p(2),p(3)];return {id:'d1',origin,destination,stops,result:{orderIds:['p3','p0','p2','p1'],entries:[origin,stops[3],stops[0],stops[2],stops[1],destination].map(place=>({place}))}}};
test('selected single visit routes from device GPS directly to that visit, not final endpoint',async()=>{
 const n=await planner(),d=day();
 const routeN=n.sections(d,'naver','single','p2'),routeK=n.sections(d,'kakao','single','p2');
 assert.equal(routeN.length,1);assert.equal(routeN[0].destination.id,'p2');assert.equal(routeN[0].via.length,0);
 assert.equal(routeK.length,1);assert.equal(routeK[0].destination.id,'p2');assert.equal(routeK[0].via.length,0);
 const uri=n.naverLaunchUrl(routeN[0],'https://example.app','iPhone');
 assert.match(uri,/^nmap:\/\/navigation\?/);
 const url=new URL(uri);assert.equal(url.searchParams.has('slat'),false);assert.equal(url.searchParams.get('dname'),'방문지 2');
 const data=n.kakaoArguments(routeK[0]);assert.equal(data.name,'방문지 2');assert.equal(data.viaPoints.length,0);
 assert.equal(n.sections(d,'naver','single','nonexistent').length,0);
});
test('whole trip retains calculated visit order and waypoint split without duplicate or missing visits',async()=>{
 const n=await planner(),d=day();const expected=['p3','p0','p2','p1','p51'];
 for(const provider of ['naver','kakao']){
  const result=n.sections(d,provider,'via').flatMap(x=>[...x.via,x.destination].map(p=>p.id));
  assert.deepEqual(JSON.parse(JSON.stringify(result)),expected);
 }
});
test('STEP3 nav modal offers two unambiguous modes and a visit picker; neither mode shows the old route preview',async()=>{
 const [html,nav,live,app]=await Promise.all(['public/index.html','public/static/navigation.js','public/static/live-route.js','public/static/app.js'].map(read));
 assert.match(html,/name="yg-nav-mode-choice" value="single"/);
 assert.match(html,/name="yg-nav-mode-choice" value="via"/);
 assert.match(html,/id="yg-nav-single-target"/);
 assert.match(html,/모든 방문지 순서대로 안내/);
 assert.doesNotMatch(html,/바로 도착지로 가기|이번에 안내할 길|원래 여행길 보기/);
 assert.doesNotMatch(html,/id="yg-route-account-actions"/);
 assert.match(nav,/function targetChoices\(d\)/);
 assert.match(nav,/targetId=e\.target\.value/);
 assert.match(nav,/lastOpened>=0\?'다음 길안내':'길안내 시작'/);
 assert.match(nav,/content\.hidden=true/);
 assert.doesNotMatch(nav,/이번에 안내할 길/);
 assert.doesNotMatch(live,/TripNavigation\?\.open/);
 assert.match(app,/i===0\?'출발':i===r\.entries\.length-1\?'도착':i/);
});
test('STEP1 centered date layout and STEP3 toolbar use single row, avoid old nested padding',async()=>{
 const [css,html]=await Promise.all(['public/static/vnext.css','public/index.html'].map(read));
 assert.match(css,/body\[data-trip-step="1"\] #yg-step-one\{\s*display:flex!important;flex-direction:column;justify-content:center/);
 assert.match(css,/body\[data-trip-step="3"\] #trip-workspace #map-overlay-controls\{[\s\S]*?position:static!important/);
 assert.match(css,/body\[data-trip-step="3"\] #trip-workspace #map-overlay-controls \.map-control-buttons\{[\s\S]*?flex-wrap:nowrap!important/);
 assert.match(html,/id="map-maximize"[^>]*>지도 크게<\/button>/);
 assert.match(css,/timeline-dot-start/);assert.match(css,/timeline-dot-end/);
});
