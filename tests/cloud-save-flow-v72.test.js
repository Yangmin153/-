import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTrips} from '../lib/trips.js';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'};
const location=i=>({id:'p'+i,name:'장소 '+i,lat:33.4+i*.01,lng:126.2+i*.01});
const days=()=>{
 const origin=location(1),destination=location(2),stop=location(3);
 return [{id:'day-a',date:'2026-11-04',origin,destination,stops:[stop],mode:'auto',departure:'09:00',unassignedStops:[],
  result:{orderIds:[stop.id],drivingMinutes:37,totalDistanceMeters:22000,status:'road_exact',
   entries:[{kind:'origin',place:origin},
    {kind:'stop',place:stop,leg:{durationMinutes:15,distanceMeters:10000,path:[[126.21,33.41],[126.23,33.43]],source:'naver'}},
    {kind:'destination',place:destination,leg:{durationMinutes:22,distanceMeters:12000,path:[[126.23,33.43],[126.22,33.42]],source:'naver'}}]}}];
};
function mockServer(){
 const saved=[],seen={auth:0,rest:0};let seq=0;
 async function fetcher(input,opts={}){
  const url=new URL(input),headers=opts.headers||{},token=String(headers.authorization||'');
  const owner=token.includes('tokenA')?A:token.includes('tokenB')?B:null;
  if(url.pathname==='/auth/v1/user'){
   seen.auth++;
   return new Response(JSON.stringify(owner?{id:owner}:{error:'invalid'}),{status:owner?200:401});
  }
  if(url.pathname==='/rest/v1/trips'){
   seen.rest++;
   const selected=saved.filter(x=>x.owner_id===owner),id=url.searchParams.get('id')?.slice(3);
   let result;
   if(opts.method==='POST'){
    const d=JSON.parse(opts.body);
    const row={...d,id:'00000000-0000-4000-8000-'+String(++seq).padStart(12,'0'),updated_at:'2026-10-28',owner_id:owner};
    saved.push(row);result=[row];
   }else if(opts.method==='PATCH'){
    const row=selected.find(x=>x.id===id);if(!row)result=[];
    else {Object.assign(row,JSON.parse(opts.body));result=[row];}
   }else if(opts.method==='DELETE'){
    const row=selected.find(x=>x.id===id);if(!row)result=[];
    else {saved.splice(saved.indexOf(row),1);result=[row];}
   }else result=selected;
   return new Response(JSON.stringify(result),{status:200});
  }
  throw Error('unexpected '+url.pathname);
 }
 return {fetcher,saved,seen};
}
const req=(method,token,path='',body)=>new Request('https://trips.example.com/api/trips'+path,{
 method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},
 ...(body?{body:JSON.stringify(body)}:{})
});
test('authenticated save includes route result and owner-scoped loading faithfully round-trips it',async()=>{
 const server=mockServer(),payload={name:'제주 1일 여행',region:'제주',days:days()};
 const created=await handleTrips(req('POST','tokenA','',payload),env,server.fetcher);
 assert.equal(created.status,200);
 const saved=(await created.json()).trip;
 assert.equal(saved.owner_id,A);
 assert.deepEqual(saved.days[0].result.orderIds,['p3']);
 assert.equal(saved.days[0].result.entries[1].leg.path.length,2);
 const list=await handleTrips(req('GET','tokenA'),env,server.fetcher);
 assert.equal(list.status,200);
 const loaded=(await list.json()).trips;
 assert.equal(loaded.length,1);
 assert.deepEqual(loaded[0].days[0].result,saved.days[0].result);
});
test('second signed-in user cannot list, patch or delete someone else’s itinerary',async()=>{
 const server=mockServer();
 const create=await handleTrips(req('POST','tokenA','',{name:'A 여행',region:'제주',days:days()}),env,server.fetcher);
 const row=(await create.json()).trip;
 const otherList=await handleTrips(req('GET','tokenB'),env,server.fetcher);
 assert.deepEqual((await otherList.json()).trips,[]);
 const otherPatch=await handleTrips(req('PATCH','tokenB','?id='+row.id,{name:'훔침',region:'제주',days:days()}),env,server.fetcher);
 assert.equal(otherPatch.status,404);
 const otherDelete=await handleTrips(req('DELETE','tokenB','?id='+row.id),env,server.fetcher);
 assert.equal(otherDelete.status,404);
 assert.equal(server.saved.length,1);
});
test('unsigned callers cannot access any private travel itinerary endpoints',async()=>{
 const server=mockServer();
 const result=await handleTrips(new Request('https://trips.example.com/api/trips'),env,server.fetcher);
 assert.equal(result.status,401);
 assert.equal(server.seen.rest,0);
});
