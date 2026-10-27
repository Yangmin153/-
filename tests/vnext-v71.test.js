import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const p=i=>({id:String(i),name:'방문지 '+i,lat:33.39+i*.004,lng:126.42+i*.004});
const d=()=>({origin:p(80),destination:p(81),stops:[p(0),p(1),p(2)],
 result:{orderIds:['0','1','2'],entries:[p(80),p(0),p(1),p(2),p(81)].map(place=>({place}))}});
async function sdk(){const g={URL,URLSearchParams};g.globalThis=g;vm.runInNewContext(await read('public/static/navigation.js'),g);return g.TripNaviPlanner}
test('Naver with visits opens /route/car with all waypoints, not /navigation which loses waypoints on devices',async()=>{
 const n=await sdk(),part=n.sections(d(),'naver')[0],url=n.naverLaunchUrl(part,'https://trip.example','iPhone');
 assert.match(url,/^nmap:\/\/route\/car\?/);
 const u=new URL(url);
 assert.equal(u.searchParams.get('v1name'),'방문지 0');
 assert.equal(u.searchParams.get('v2name'),'방문지 1');
 assert.equal(u.searchParams.get('v3name'),'방문지 2');
 assert.equal(u.searchParams.get('dname'),'방문지 81');
 assert.equal(u.searchParams.has('slat'),false);
});
test('Naver direct mode launches GPS origin native navigation with no via params',async()=>{
 const n=await sdk(),part=n.sections(d(),'naver','direct')[0],url=n.naverLaunchUrl(part,'https://trip.example','iPhone');
 assert.match(url,/^nmap:\/\/navigation\?/);
 assert.equal(new URL(url).searchParams.has('v1lat'),false);
});
test('Naver Android intent opens route/car for visits and navigation only for direct',async()=>{
 const n=await sdk(),a=n.naverLaunchUrl(n.sections(d(),'naver')[0],'https://trip.example','Android 14'),b=n.naverLaunchUrl(n.sections(d(),'naver','direct')[0],'https://trip.example','Android 14');
 assert.match(a,/^intent:\/\/route\/car\?/);
 assert.match(a,/v3lat=/);
 assert.match(a,/#Intent;scheme=nmap;/);
 assert.match(b,/^intent:\/\/navigation\?/);
});
test('Kakao remains viaPoints and failure guidance offers origin-specific JavaScript SDK troubleshooting',async()=>{
 const [ui,html]=await Promise.all([read('public/static/navigation.js'),read('public/index.html')]);
 assert.match(ui,/viaPoints:part\.via\.map/);
 assert.match(ui,/diagnosticMessage\(err\)/);
 assert.match(ui,/yg-kakao-navi-domain/);
 assert.match(html,/id="yg-kakao-navi-help"/);
 assert.match(html,/id="yg-nav-retry"/);
 assert.match(ui,/launch\(lastOpened\)/);
});
