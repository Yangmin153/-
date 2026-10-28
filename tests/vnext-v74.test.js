import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {refineRoadOrder,buildPlan} from '../lib/core.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const point=(id,lat,lng,locked=false)=>({id,name:id,lat,lng,locked});
function syntheticRoadMock(points,cheapLastId){
 const matches=new Map(points.map((p,i)=>[p.lng.toFixed(7)+','+p.lat.toFixed(7),i]));
 let calls=0;
 return {
  async fetch(url){
   calls++;
   const parsed=new URL(url);
   const from=matches.get(parsed.searchParams.get('start'));
   const to=matches.get(parsed.searchParams.get('goal'));
   if(from===undefined||to===undefined)throw Error('unknown map point');
   // Driving-time graph: a surprising bottleneck to destination from any but the
   // special nearby visit. Total travel time, not straight distance, is the objective.
   const duration=to===points.length-1&&points[from].id!==cheapLastId?500:8;
   return new Response(JSON.stringify({code:0,route:{traoptimal:[{
    summary:{duration:duration*60000,distance:duration*350},
    path:[[points[from].lng,points[from].lat],[points[to].lng,points[to].lat]]
   }]}}),{status:200});
  },
  count:()=>calls
 };
}
test('road-time refiner moves the cheap-to-destination visit to the end without moving fixed stop',async()=>{
 const origin=point('origin',33.5,126.5),stops=[
  point('near-end',33.4,126.88),point('s2',33.42,126.57),
  point('fixed',33.44,126.62,true),point('s4',33.46,126.69),
  point('s5',33.48,126.76),point('s6',33.50,126.78),
  point('far-end',33.52,126.8)
 ],destination=point('end',33.4,126.881);
 const all=[origin,...stops,destination],fake=syntheticRoadMock(all,'near-end'),previous=globalThis.fetch;
 try{
  globalThis.fetch=fake.fetch;
  const baseline=[1,2,3,4,5,6,7],matrix=new Map();
  const improved=await refineRoadOrder(baseline,all,{
   NAVER_MAPS_CLIENT_ID:'public-test-id',NAVER_MAPS_CLIENT_SECRET:'private-test-secret',
   ROUTE_REFINEMENT_API_BUDGET:'48'
  },matrix);
  assert.deepEqual(new Set(improved),new Set(baseline));
  assert.equal(improved[2],3,'locked stop must remain at its original position');
  assert.equal(improved.at(-1),1,'last stop must connect cheaply to fixed destination');
  const travel=seq=>[0,...seq,8].slice(0,-1).reduce((sum,i,k)=>{
   const next=[...seq,8][k],leg=matrix.get(i+':'+next);return sum+leg.durationMinutes;
  },0);
  assert.ok(travel(improved)<travel(baseline));
  assert.ok(fake.count()<=56,'within 48 optional plus 8 baseline route calls');
 }finally{globalThis.fetch=previous;}
});
test('buildPlan 5+ stops samples directed road times and never changes destination or stop set',async()=>{
 const origin=point('origin',33.5,126.5),stops=[
  point('s1',33.55,126.55),point('s2',33.52,126.6),
  point('s3',33.53,126.7),point('s4',33.56,126.8),
  point('near-end',33.51,126.9)
 ],destination=point('end',33.5,126.901);
 const all=[origin,...stops,destination],fake=syntheticRoadMock(all,'near-end'),previous=globalThis.fetch;
 try{
  globalThis.fetch=fake.fetch;
  const result=await buildPlan({origin,destination,stops,mode:'auto',departure:'09:00'},{
    NAVER_MAPS_CLIENT_ID:'public-test-id',NAVER_MAPS_CLIENT_SECRET:'private-test-secret',
    ROUTE_REFINEMENT_API_BUDGET:48
  });
  assert.equal(result.entries[0].place.id,'origin');
  assert.equal(result.entries.at(-1).place.id,'end');
  assert.equal(result.orderIds.length,5);
  assert.equal(new Set(result.orderIds).size,5);
  assert.equal(result.orderIds.at(-1),'near-end');
  assert.ok(result.apiLegs>=6);
  assert.equal(result.status,'road_order');
  assert.ok(result.warnings.some(x=>x.includes('자동차 이동시간')));
 }finally{globalThis.fetch=previous;}
});
test('navigation destination cards replace dropdown with named selectable list and no unsafe name HTML',async()=>{
 const [html,js,css]=await Promise.all(['public/index.html','public/static/navigation.js','public/static/vnext.css'].map(read));
 assert.match(html,/id="yg-nav-place-list" class="yg-nav-place-list"/);
 assert.match(html,/목적지를 선택하세요/);
 assert.match(js,/const name=document\.createElement\('strong'\);name\.textContent=p\.name/);
 assert.match(js,/const sub=document\.createElement\('small'\);sub\.textContent=p\.address/);
 assert.match(js,/btn\.dataset\.navTarget=p\.id/);
 assert.match(js,/aria-pressed/);
 assert.match(css,/yg-nav-place-option\[aria-pressed="true"\]/);
 assert.match(html,/navigation\.js\?v=7\.4\.0/);
});
