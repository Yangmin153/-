import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {buildPlan,validatePlan} from '../lib/core.js';
import {recommendations,distanceFromSegment} from '../lib/recommend.js';
const root=new URL('../public/',import.meta.url);
const place=(name,i)=>({id:name,name,lat:33.40+i*0.008,lng:126.45+i*.007,locked:false});
const plan=(n)=>({origin:place('start',0),destination:place('end',n+1),stops:Array.from({length:n},(_,i)=>place('s'+i,i+1)),departure:'09:00',mode:'auto'});
test('체류시간 구형 데이터는 계산하지 않음, 경로 결과에 체류시간 없음',async()=>{
 const p=plan(3);p.stops.forEach(x=>x.stayMinutes=720);
 const result=await buildPlan(p,{});assert.equal(result.totalMinutes,result.drivingMinutes);assert.equal(result.stayMinutes,undefined);assert.equal(result.entries.length,5);
 const cleaned=plan(3);assert.equal(validatePlan(cleaned),null);
});
test('자동 최적화 고정 순번 보존: 1,5,15,30곳',async()=>{
 for(const count of [1,5,15,30]){const p=plan(count);if(count>1){p.stops[1].locked=true;p.stops.at(-1).locked=true;}const r=await buildPlan(p,{});if(count>1){assert.equal(r.orderIds[1],'s1');assert.equal(r.orderIds[count-1],`s${count-1}`)}assert.equal(r.entries.length,count+2);}
});
test('근처 경유 추천은 좌표와 권한을 검증하고 최대 3개 반환',async()=>{
 const url='https://example.com/api/recommendations?aLat=33.4&aLng=126.4&bLat=33.5&bLng=126.5';
 assert.equal((await recommendations(new Request(url),{})).status,503);
 const mock=async()=>Response.json({documents:[{id:'7',place_name:'테스트 카페',y:'33.45',x:'126.45',category_name:'카페',address_name:'제주시 테스트',road_address_name:''}]});
 const data=await (await recommendations(new Request(url),{KAKAO_REST_API_KEY:'test'},mock)).json();assert.ok(data.items.length>0&&data.items.length<=3);assert.equal(data.items[0].name,'테스트 카페');assert.ok(!JSON.stringify(data).includes('KakaoAK'));assert.equal(distanceFromSegment([33.45,126.45],[33.4,126.4],[33.5,126.5])<100,true);
});
test('지도/추천 UI와 체류시간 UI 제거 정적 회귀',async()=>{
 const html=await readFile(new URL('index.html',root),'utf8'),app=await readFile(new URL('static/app.js',root),'utf8'),map=await readFile(new URL('static/map-workspace.js',root),'utf8');
 assert.doesNotMatch(html,/(?:id="input-stay"|id="stay-field"|data-modal-tab="coordinate"|위도\s*\(|경도\s*\()/);
 assert.doesNotMatch(app,/(?:체류\s*\$\{|체류시간은|\.stayMinutes\s*=)/);
 for(const id of ['map-sheet','stops-list','map-place-preview'])assert.ok(html.includes('id="'+id+'"'));assert.ok(!html.includes('id="btn-export-route"'));
 assert.match(map,/visibleSheetPixels/);assert.match(map,/fitPadding/);assert.match(app,/v53-stop/);assert.match(app,/remove-stop/);assert.doesNotMatch(app,/data-gap-index/);
});
test('경로 도식 내보내기는 실제 leg.path 기반',async()=>{
 await import('../public/static/route-export.js');const p=plan(1);const r=await buildPlan(p,{});const days=[{...p,result:r}];
 const model=globalThis.TripExport.model(days,'day',0);assert.ok(model.batches[0].lines.length);assert.ok(model.bounds.maxX>model.bounds.minX);
 assert.throws(()=>globalThis.TripExport.model([{...p,result:null}],'day',0),/계산/);
});
