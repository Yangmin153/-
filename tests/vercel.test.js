import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildPlan,validatePlan,heuristicOrder,optimalMatrix} from '../lib/core.js';
import {GET as health} from '../api/health.js';
import {GET as config} from '../api/config.js';
import {GET as geocode} from '../api/geocode.js';
import {POST as route} from '../api/route.js';
const place=(id,lng,lat=33.2,locked=false)=>({id,name:id,lat,lng,stayMinutes:30,locked});
const example={origin:place('o',126),destination:place('end',127),stops:[place('C',126.8),place('B',126.1),place('D',126.4)],departure:'09:00',mode:'auto'};
function req(path,data,extra={}){return new Request('https://demo.vercel.app'+path,{method:'POST',headers:{'content-type':'application/json',...extra},body:JSON.stringify(data)});}
test('출발지→관광지 전체→도착지, API 없을 때 추정 결과 안내',async()=>{
 const r=await buildPlan(example,{});
 assert.deepEqual(r.orderIds,['B','D','C']);
 assert.equal(r.entries.at(-1).kind,'destination');
 assert.equal(r.status,'estimated');
 assert.match(r.warnings.join(' '),/직선거리/);
});
test('고정 순서·사용자 지정 방문 순서',async()=>{
 const locked=await buildPlan({...example,stops:[place('C',126.8),place('B',126.1,33.2,true),place('D',126.4)]},{});
 assert.equal(locked.orderIds[1],'B');
 const manual=await buildPlan({...example,mode:'manual'},{});
 assert.deepEqual(manual.orderIds,['C','B','D']);
});
test('잘못된 사용자 입력과 중복 관광지 차단',()=>{
 assert.equal(validatePlan(example),null);
 for(const invalid of [
  {...example,departure:'26:00'},
  {...example,stops:Array.from({length:31},(_,i)=>place('x'+i,126.1+i/200))},
  {...example,stops:[example.stops[0],example.stops[0]]},
  {...example,origin:{...example.origin,lat:Infinity}},
  {...example,mode:'unknown'}
 ]) assert.ok(validatePlan(invalid));
});
test('네이버 길찾기 성공: 네이버 도로시간 전수 비교와 절감 효과',async(t)=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(u)=>{
  const url=new URL(String(u));
  const from=Number(url.searchParams.get('start').split(',')[0]),to=Number(url.searchParams.get('goal').split(',')[0]);
  const dur=Math.round((Math.abs(from-to)*17+3)*60000);
  return Response.json({code:0,route:{traoptimal:[{summary:{duration:dur,distance:2000+Math.abs(from-to)*100000},path:[[from,33.2],[to,33.2]]}]}});
 };
 t.after(()=>{globalThis.fetch=original});
 const result=await buildPlan(example,{NAVER_MAPS_CLIENT_ID:'id',NAVER_MAPS_CLIENT_SECRET:'secret'});
 assert.equal(result.status,'road_exact');
 assert.deepEqual(result.orderIds,['B','D','C']);
 assert.equal(result.apiLegs,4);
 assert.equal(result.estimatedLegs,0);
 assert.ok(result.savedMinutes>0);
});
test('네이버 실패 시 실패를 감추지 않고 추정 결과를 표시',async(t)=>{
 const orig=globalThis.fetch;globalThis.fetch=async()=>new Response('bad gateway',{status:502});t.after(()=>{globalThis.fetch=orig});
 const r=await buildPlan(example,{NAVER_MAPS_CLIENT_ID:'id',NAVER_MAPS_CLIENT_SECRET:'secret'});
 assert.equal(r.status,'estimated');
 assert.ok(r.warnings.some(x=>x.includes('실패')));
});
test('서버 API 준비 상태 및 인증 비밀키 비노출',async(t)=>{
 const prev=[process.env.NAVER_MAPS_CLIENT_ID,process.env.NAVER_MAPS_CLIENT_SECRET];
 process.env.NAVER_MAPS_CLIENT_ID='PUBLIC_TEST';process.env.NAVER_MAPS_CLIENT_SECRET='DO_NOT_LEAK';
 t.after(()=>{for(const [k,v] of [['NAVER_MAPS_CLIENT_ID',prev[0]],['NAVER_MAPS_CLIENT_SECRET',prev[1]]]){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 const h=await health();assert.equal((await h.json()).hosting,'vercel-functions');
 const c=await config();const txt=await c.text();assert.ok(txt.includes('PUBLIC_TEST'));assert.ok(!txt.includes('DO_NOT_LEAK'));
});
test('POST /api/route: 올바른 요청과 제한 검증',async()=>{
 delete process.env.NAVER_MAPS_CLIENT_ID;delete process.env.NAVER_MAPS_CLIENT_SECRET;
 let res=await route(req('/api/route',example));assert.equal(res.status,200);assert.equal((await res.json()).status,'estimated');
 res=await route(req('/api/route',example,{'origin':'https://evil.test'}));assert.equal(res.status,403);
 res=await route(req('/api/route',{...example,departure:'33:00'}));assert.equal(res.status,422);
 res=await route(new Request('https://demo.vercel.app/api/route',{method:'POST',headers:{'content-type':'text/plain'},body:'a'}));assert.equal(res.status,415);
});
test('GET /api/geocode: 네이버 주소 API 형식 유지',async(t)=>{
 const original=globalThis.fetch;
 const oldId=process.env.NAVER_MAPS_CLIENT_ID,oldSecret=process.env.NAVER_MAPS_CLIENT_SECRET;
 process.env.NAVER_MAPS_CLIENT_ID='id';process.env.NAVER_MAPS_CLIENT_SECRET='secret';
 globalThis.fetch=async()=>Response.json({status:'OK',addresses:[{roadAddress:'제주시 공항로 2',x:'126.4913',y:'33.5104'}]});
 t.after(()=>{globalThis.fetch=original;for(const [key,value] of [['NAVER_MAPS_CLIENT_ID',oldId],['NAVER_MAPS_CLIENT_SECRET',oldSecret]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 const r=await geocode(new Request('https://demo.vercel.app/api/geocode?q=%EC%A0%9C%EC%A3%BC'));
 assert.equal(r.status,200);assert.equal((await r.json()).results[0].lat,33.5104);
});
test('브라우저 HTML 정적 리소스 주소와 화면 필수 요소',async()=>{
 const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 const js=await readFile(new URL('../public/static/app.js',import.meta.url),'utf8');
 assert.match(html,/\/static\/app\.js/);
 for(const id of ['day-tabs','stops-list','mode-auto','mode-manual','btn-route','map','travel-date','origin-name','destination-name'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(js,/pointerdown/);assert.match(js,/pointermove/);assert.match(js,/\/api\/route/);
 assert.ok(!html.includes('Cloudflare'));
});
