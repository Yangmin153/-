import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {handleTrips,validateTripPayload} from '../lib/trips.js';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const ID_A='11111111-1111-4111-8111-111111111111',ID_B='22222222-2222-4222-8222-222222222222';
const TRIP='88888888-8888-4888-8888-888888888888';
const point=id=>({id,name:id,lat:33.5,lng:126.5});
const day={id:'day',origin:point('start'),destination:point('end'),stops:[],mode:'manual',departure:'09:30',region:'제주'};
const payload={name:'제주 여행',region:'제주',days:[day]};
const env={SUPABASE_URL:'https://demo.supabase.co',SUPABASE_ANON_KEY:'publishable-public-key'};
function req(method='GET',id='',body,user='A'){
 return new Request('https://yeohaenggil.example/api/trips'+(id?'?id='+id:''),{method,headers:{authorization:'Bearer mocktoken'+user,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
function mockDb(){
 const rows=new Map(),queries=[];
 const fetcher=async(raw,opts)=>{
  const url=new URL(raw),owner=opts.headers.authorization.endsWith('A')?ID_A:ID_B;
  if(url.pathname==='/auth/v1/user')return Response.json({id:owner});
  assert.equal(url.pathname,'/rest/v1/trips');
  assert.equal(opts.headers.apikey,env.SUPABASE_ANON_KEY);
  queries.push({method:opts.method,auth:owner,path:url.search});
  const id=url.searchParams.get('id')?.replace('eq.','');
  const list=[...rows.values()].filter(row=>row.owner_id===owner&&(!id||row.id===id));
  if(opts.method==='GET')return Response.json(list);
  if(opts.method==='POST'){const data=JSON.parse(opts.body);if(data.owner_id!==owner)return Response.json({message:'RLS'}, {status:403});const record={...data,id:TRIP,updated_at:new Date().toISOString()};rows.set(record.id,record);return Response.json([record]);}
  if(opts.method==='PATCH'){const data=JSON.parse(opts.body);if(list.length){rows.set(id,{...list[0],...data});return Response.json([rows.get(id)]);}return Response.json([]);}
  if(opts.method==='DELETE'){list.forEach(row=>rows.delete(row.id));return Response.json(list);}
  throw Error('unexpected');
 };
 return {rows,queries,fetcher};
}
test('v4.9 CSS: eight live stylesheets replaced with two consolidated entry points',async()=>{
 const html=await read('public/index.html');
 for(const file of ['foundation-v49.css','mobile-v49.css'])assert.ok(html.includes(file));
 for(const file of ['styles.css?v=','polish.css?v=','map-workspace.css?v=','quick-add.css?v=','map-first-v46.css?v=','native-v47.css?v=','tabs-v48.css?v=','map-v44.css?v='])assert.ok(!html.includes(file),file);
 const base=await read('public/static/foundation-v49.css'),mobile=await read('public/static/mobile-v49.css');
 assert.match(base,/Legacy source: styles.css/);assert.match(mobile,/Legacy source: tabs-v48.css/);
});
test('v4.9 fullscreen search uses same search DOM, keyboard viewport, ESC, popstate',async()=>{
 const html=await read('public/index.html'),script=await read('public/static/search-screen.js'),css=await read('public/static/mobile-v49.css');
 for(const id of ['search-screen','search-screen-back','search-screen-form-mount','search-screen-results-mount'])assert.ok(html.includes('id="'+id+'"'));
 assert.equal((html.match(/id="quick-form"/g)||[]).length,1);
 for(const token of ['original.insertBefore(form','history.pushState','popstate','visualViewport','input.focus','document.body.classList.add'])assert.ok(script.includes(token),token);
 assert.match(css,/\.search-screen-results-mount/);assert.match(css,/100dvh/);
});
test('v4.9 timeline uses exactly the same TripMeta metadata as stop card',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/TripMeta\.meta\(entry.place\)/);
 assert.match(app,/TripMeta\.icon\(entry.place,18\)/);
 assert.match(app,/renderEditor\(\);renderResult\(\);renderMap\(\)/);
});
test('v4.9 account UI and non-destructive browser guest save',async()=>{
 const html=await read('public/index.html'),app=await read('public/static/app.js'),acc=await read('public/static/accounts.js');
 for(const id of ['account-panel','account-email','account-password','account-trips','cloud-save'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app,/YeoAccount\?\.isSignedIn/);
 assert.match(app,/restoreGuestDays\(/);
 assert.match(acc,/yeohaenggil\.v2\.days/);assert.match(acc,/crypto\.subtle\.digest/);
 assert.match(acc,/import_fingerprint/);
 assert.match(acc,/auth\.signUp/);assert.match(acc,/auth\.signInWithPassword/);
});
test('v4.9 private trips: rejects unauthenticated/unconfigured API',async()=>{
 assert.equal((await handleTrips(req(),{},async()=>{throw Error('must not call')})).status,503);
 const missing=new Request('https://yeohaenggil.example/api/trips');
 assert.equal((await handleTrips(missing,env,async()=>{throw Error('must not call')})).status,401);
});
test('v4.9 independent users: B cannot view, update or delete A trip even if B knows UUID',async()=>{
 const {fetcher,queries}=mockDb();
 const created=await handleTrips(req('POST','',{...payload,owner_id:ID_B}),env,fetcher);
 assert.equal(created.status,200);
 const a=await (await handleTrips(req('GET','','','A'),env,fetcher)).json();
 assert.equal(a.trips.length,1);assert.equal(a.trips[0].owner_id,ID_A);
 const b=await (await handleTrips(req('GET','','','B'),env,fetcher)).json();
 assert.equal(b.trips.length,0);
 assert.equal((await handleTrips(req('PATCH',TRIP,payload,'B'),env,fetcher)).status,404);
 assert.equal((await handleTrips(req('DELETE',TRIP,undefined,'B'),env,fetcher)).status,404);
 const after=await (await handleTrips(req('GET','','','A'),env,fetcher)).json();
 assert.equal(after.trips.length,1);
 assert.ok(queries.filter(q=>q.method!=='POST').every(q=>q.path.includes('owner_id=eq.')));
});
test('v4.9 input validation and RLS SQL contain owner-scoped policies',async()=>{
 assert.ok(validateTripPayload(payload)===null);
 assert.ok(validateTripPayload({...payload,days:[{...day,origin:{...day.origin,lat:999}}]}));
 const sql=await read('supabase/migrations/20261022_user_trips.sql');
 for(const token of ['enable row level security','force row level security','auth.uid()','for select','for insert','for update','for delete','owner_id','trips_unique_import_idx'])assert.ok(sql.includes(token),token);
 const config=await read('api/config.js');
 assert.ok(config.includes('supabaseReady'));
 assert.ok(!config.includes('SUPABASE_SERVICE_ROLE_KEY'));
});

