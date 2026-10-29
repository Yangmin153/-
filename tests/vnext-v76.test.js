import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {handleTrips} from '../lib/trips.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',tripId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
test('GET trip by id returns one trip object, not an array-only trips payload',async()=>{
 const requested=[],row={id:tripId,name:'제주 여행',days:[{date:'2026-11-01'}]};
 const fetcher=async(input,opts)=>{
  const u=new URL(input);
  if(u.pathname==='/auth/v1/user')return new Response(JSON.stringify({id:owner}),{status:200});
  requested.push(u);
  return new Response(JSON.stringify([row]),{status:200});
 };
 const r=await handleTrips(new Request('https://travel.example/api/trips?id='+tripId,{headers:{authorization:'Bearer user_token'}}),env,fetcher);
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).trip,row);
 assert.equal(requested[0].searchParams.get('id'),'eq.'+tripId);
 assert.equal(requested[0].searchParams.get('owner_id'),'eq.'+owner);
});
test('missing exact trip id returns 404 without exposing other owners plans',async()=>{
 const fetcher=async(input)=>{
  const u=new URL(input);
  if(u.pathname==='/auth/v1/user')return new Response(JSON.stringify({id:owner}),{status:200});
  return new Response('[]',{status:200});
 };
 const r=await handleTrips(new Request('https://travel.example/api/trips?id='+tripId,{headers:{authorization:'Bearer user_token'}}),env,fetcher);
 assert.equal(r.status,404);
});
test('navigation has fixed header, single scroll body, and safe-area CTA footer',async()=>{
 const [html,css,js]=await Promise.all(['public/index.html','public/static/vnext.css','public/static/navigation.js'].map(read));
 const start=html.indexOf('class="yg-nav-header"'),body=html.indexOf('class="yg-nav-body"'),footer=html.indexOf('class="yg-nav-footer"');
 assert.ok(start>0&&body>start&&footer>body);
 assert.ok(html.indexOf('id="yg-nav-place-list"')>body);
 assert.ok(html.indexOf('id="yg-nav-start"')>footer);
 assert.ok(html.indexOf('id="yg-kakao-navi-help"')>body);
 assert.match(css,/grid-template-rows:auto minmax\(0,1fr\) auto/);
 assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
 assert.match(js,/Kakao\.Navi\.start/);
});
test('STEP3 individual stop removal keeps user on result step and preserves other days',async()=>{
 const [html,ui,app]=await Promise.all(['public/index.html','public/static/vnext.js','public/static/app.js'].map(read));
 assert.doesNotMatch(html,/id="yg-delete-routes"/);
 assert.match(ui,/data-adjust-remove/);
 assert.match(ui,/app\.removeStop\(id\)/);
 assert.match(ui,/\$\('yg-three-add'\)\.addEventListener\('click',\(\)=>openSearch\(\)\)/);
 assert.match(app,/owner\.stops=owner\.stops\.filter/);
 assert.match(app,/owner\.result=null/);
 assert.doesNotMatch(app.slice(app.indexOf('function removeStop('),app.indexOf('function syncLinkedOrigins(')),/invalidateRoutes\(\)/);
});
test('account plan list renders metadata and fetches full days lazily',async()=>{
 const [account,server]=await Promise.all(['public/static/accounts.js','lib/trips.js'].map(read));
 assert.match(account,/request\('\?summary=1'\)/);
 assert.match(account,/request\('\?id='\+encodeURIComponent\(trip.id\)\)/);
 assert.match(account,/app\(\)\.validateDays\(full\.days\)/);
 assert.match(account,/mergeCachedTrip\(data\.trip\)/);
 assert.match(account,/tripCacheUser=owner/);
 assert.match(server,/method==='GET'&&id/);
});
