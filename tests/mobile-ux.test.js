import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {encodeTrip,decodeTrip,tripSnapshot,naverRouteLinks,MOBILE_BREAKPOINT} from '../public/static/trip-utils.js';

const place=(id,name,lat,lng)=>({id,name,lat,lng,stayMinutes:60,locked:false});
const plan=[{id:'day1',origin:place('a','제주국제공항',33.51,126.49),destination:place('b','서귀포 숙소',33.25,126.55),stops:[place('c','성산일출봉',33.46,126.94)],mode:'manual',departure:'09:00',result:{entries:[1,2,3]}}];

test('공유 링크 UTF-8 왕복 및 동선 결과 제외, 원본 불변',()=>{
 const original=JSON.stringify(plan);const encoded=encodeTrip(plan);const decoded=decodeTrip(encoded);
 assert.equal(decoded[0].stops[0].name,'성산일출봉');
 assert.equal(decoded[0].result,undefined);
 assert.equal(JSON.stringify(plan),original);
 assert.deepEqual(tripSnapshot(plan),decoded);
});
test('공유 데이터의 손상, 과대 길이, 다른 형식 차단',()=>{
 for(const str of ['', '*', 'a'.repeat(12000),btoa(JSON.stringify({v:2,days:[]}))])assert.throws(()=>decodeTrip(str));
 const large=structuredClone(plan);large[0].stops[0].name='길'.repeat(6000);assert.throws(()=>encodeTrip(large));
});
test('NAVER 지도 자동차 길안내 scheme 은 appname, 좌표, 한글 장소명 인코딩',()=>{
 const {app,web}=naverRouteLinks(plan[0].origin,plan[0].destination,'https://example.com');
 const parsed=new URL(app);
 assert.equal(parsed.protocol,'nmap:'); assert.equal(parsed.host,'route');assert.equal(parsed.pathname,'/car');
 assert.equal(parsed.searchParams.get('appname'),'https://example.com');
 assert.equal(parsed.searchParams.get('dname'),'서귀포 숙소');
 assert.equal(parsed.searchParams.get('slng'),'126.49');
 assert.ok(web.startsWith('https://map.naver.com/'));assert.match(web,/pathType=1/);
});
test('잘못된 내비게이션 좌표 거부',()=>assert.throws(()=>naverRouteLinks({lat:Infinity,lng:0},plan[0].destination)));
test('모바일 핵심 UI 구조와 합의한 데이터 저장 키 유지',async()=>{
 const [html,js,css]=await Promise.all(['../public/index.html','../public/static/app.js','../public/static/styles.css'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
 for(const id of ['mobile-view-tabs','mobile-bottom-actions','mobile-add-place','mobile-route','btn-share','btn-inherit-origin','place-address-fallback'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(html,/data-stay-minutes="90"/);
 assert.match(js,/yeohaenggil\.v2\.days/);assert.match(js,/\/api\/route/);assert.match(js,/\/api\/places/);assert.match(js,/TripApp/);
 assert.match(css,/safe-area-inset-bottom/);assert.match(css,/85dvh/);assert.match(css,/touch-action:\s*none/);assert.equal(MOBILE_BREAKPOINT,768);
});
test('라우팅 API와 카카오 검색 API 파일 보존',async()=>{
 const [routes,search]=await Promise.all(['../api/route.js','../api/places.js'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
 assert.match(routes,/buildPlan/);assert.match(search,/searchPlaces/);
});
