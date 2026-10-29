import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rankResults,tripSearchAnchor,isRegionQualified,distanceKm} from '../public/static/region-search.js';
import {searchPlaces} from '../lib/place-search.js';
import {handleTrips} from '../lib/trips.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const loc=(name,lat,lng,address)=>({id:name+lat,name,lat,lng,address});
test('identically named restaurants prefer the itinerary vicinity and explicit city query overrides the bias',()=>{
 const busan=loc('하림각',35.18,129.07,'부산광역시 중구');
 const seoul=loc('하림각',37.56,126.98,'서울특별시 종로구');
 const anchor=tripSearchAnchor({stops:[loc('부산숙소',35.18,129.08,'부산광역시')],origin:loc('출발지 미설정',33.4,126.5,''),destination:loc('도착지 미설정',33.4,126.5,'')});
 assert.equal(anchor.name,'부산숙소');
 assert.equal(rankResults([seoul,busan],'',anchor)[0].address,'부산광역시 중구');
 assert.ok(distanceKm(anchor,seoul)>distanceKm(anchor,busan));
 assert.equal(isRegionQualified('서울 하림각'),true);
 assert.equal(isRegionQualified('하림각'),false);
 assert.equal(tripSearchAnchor({stops:[],origin:loc('출발지 미설정',33.4,126.5,''),destination:loc('도착지 미설정',33.4,126.5,'')}),null);
});
test('nearby-biased Kakao request sorts by distance without a 20km exclusion radius',async()=>{
 let target;
 const res=await searchPlaces(new Request('https://sample.example/api/places?q=%ED%95%98%EB%A6%BC%EA%B0%81&bias=1&lat=35.18&lng=129.07'),
  {KAKAO_REST_API_KEY:'test-key'},
  async input=>{target=new URL(input);return new Response(JSON.stringify({documents:[],meta:{is_end:true,total_count:0}}),{status:200});});
 assert.equal(res.status,200);
 assert.equal(target.searchParams.get('x'),'129.07');
 assert.equal(target.searchParams.get('y'),'35.18');
 assert.equal(target.searchParams.get('sort'),'distance');
 assert.equal(target.searchParams.has('radius'),false);
});
test('trip summary list omits bulky route detail but exact itinerary GET keeps it',async()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',requested=[];
 const fetcher=async(input,opts)=>{
  const url=new URL(input);
  if(url.pathname.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id}),{status:200});
  requested.push(url.searchParams.get('select'));
  return new Response(JSON.stringify(url.searchParams.has('id')?[{id,name:'테스트 여행',days:[]}]:[]),{status:200});
 };
 const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
 for(const q of ['?summary=1','?id='+id]){
  const resp=await handleTrips(new Request('https://yeohaenggil.example/api/trips'+q,{headers:{authorization:'Bearer test_token'}}),env,fetcher);
  assert.equal(resp.status,200);
 }
 assert.equal(requested[0].includes('days'),false);
 assert.equal(requested[1].includes('days'),true);
 assert.ok(requested[0].includes('name'));
});
test('3rd step groups recalculation after adjustments, and long destination list clearly signals scrolling',async()=>{
 const [html,css,nav,account]=await Promise.all(['public/index.html','public/static/vnext.css','public/static/navigation.js','public/static/accounts.js'].map(read));
 const adjust=html.indexOf('id="yg-route-adjust"'),recalc=html.indexOf('id="yg-live-controls"');
 assert.ok(adjust>0&&recalc>adjust);
 assert.equal((html.match(/id="yg-three-recalc"/g)||[]).length,1);
 assert.match(html,/id="yg-nav-scroll-hint"/);
 assert.match(nav,/ordered.length<=4/);
 assert.match(css,/grid-template-rows:auto minmax\(0,1fr\) auto/);
 assert.match(html,/class="yg-nav-body"/);
 assert.match(html,/class="yg-nav-footer"/);
 assert.match(css,/overflow-y:auto;overflow-x:hidden/);
 assert.doesNotMatch(html,/id="yg-delete-routes"/);
 assert.match(account,/request\('\?summary=1'\)/);
 assert.match(account,/request\('\?id='\+encodeURIComponent\(trip.id\)\)/);
 assert.match(account,/setView\('signin'\)/);
 assert.match(html,/id="yg-progress-help"/);
});
