import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/static/live-route.js',import.meta.url),'utf8');
function makeHarness({permissionDenied=false}={}){
 const listeners=new Map(),dom=new Map();
 for(const id of ['yg-live-optimize','yg-live-status','yg-live-reset']){
  dom.set(id,{hidden:false,disabled:false,textContent:'',dataset:{},addEventListener(type,fn){listeners.set(id+':'+type,fn)}});
 }
 const stops=[
  {id:'s1',name:'관광지 1',lat:33.4,lng:126.4,locked:false},
  {id:'s2',name:'관광지 2',lat:33.5,lng:126.5,locked:false}
 ];
 const d={id:'d1',date:'2026-11-04',origin:{id:'o1',name:'제주공항',lat:33.5,lng:126.49},
  destination:{id:'end',name:'숙소',lat:33.51,lng:126.48},stops,departure:'09:00',mode:'auto',result:{
   orderIds:['s1','s2'],entries:[],drivingMinutes:70,totalDistanceMeters:28000
  }};
 const oldOrigin={...d.origin},oldStops=JSON.stringify(d.stops),oldResult=d.result;
 const calls={requests:[],navigatorOpened:0,toasts:[],apply:0};
 const root={
  isSecureContext:true,
  navigator:{geolocation:{getCurrentPosition(ok,fail){
   if(permissionDenied)fail({code:1});
   else ok({coords:{latitude:37.5665,longitude:126.9780}});
  }}},
  document:{getElementById:id=>dom.get(id)||null,addEventListener(){}},
  TripApp:{
   getDay:()=>d,
   applyLiveRoute(id,gps,result){
    calls.apply++;assert.equal(id,'d1');
    assert.deepEqual(result.orderIds,['s2','s1']);
    d.liveOrigin=gps;d.result={...result,isLiveRoute:true};return true;
   },
   restorePlannedRoute(){d.result=oldResult;delete d.liveOrigin;return true;},
   toast:msg=>calls.toasts.push(msg)
  },
  TripNavigation:{open:()=>{calls.navigatorOpened++}},
  fetch:async(url,opts)=>{
   assert.equal(url,'/api/route');
   const body=JSON.parse(opts.body);calls.requests.push(body);
   return {ok:true,async json(){
    return {orderIds:['s2','s1'],drivingMinutes:55,totalDistanceMeters:20000,
      entries:[{place:body.origin},{place:stops[1]},{place:stops[0]},{place:body.destination}]};
   }};
  }
 };
 root.globalThis=root;
 vm.runInNewContext(source,root,{filename:'live-route.js'});
 return {root,dom,listeners,d,calls,oldOrigin,oldStops,oldResult};
}
test('GPS -> actual road API -> nav chooser with original day visits and origin untouched',async()=>{
 const v=makeHarness();
 await v.listeners.get('yg-live-optimize:click')();
 assert.equal(v.calls.requests.length,1);
 const body=v.calls.requests[0];
 assert.equal(body.origin.name,'현재 위치');
 assert.equal(body.origin.lat,37.5665);assert.equal(body.origin.lng,126.978);
 assert.equal(body.mode,'auto');
 assert.deepEqual(body.stops.map(p=>p.id),['s1','s2']);
 assert.deepEqual(v.d.origin,v.oldOrigin);
 assert.equal(JSON.stringify(v.d.stops),v.oldStops);
 assert.deepEqual(v.d.result.orderIds,['s2','s1']);
 assert.equal(v.calls.navigatorOpened,1);
 assert.equal(v.dom.get('yg-live-reset').hidden,false);
 v.listeners.get('yg-live-reset:click')();
 assert.strictEqual(v.d.result,v.oldResult);
 assert.equal(v.d.liveOrigin,undefined);
});
test('GPS denied does not call routing, change itinerary or open navigation',async()=>{
 const v=makeHarness({permissionDenied:true});
 await v.listeners.get('yg-live-optimize:click')();
 assert.equal(v.calls.requests.length,0);
 assert.equal(v.calls.navigatorOpened,0);
 assert.equal(v.calls.apply,0);
 assert.strictEqual(v.d.result,v.oldResult);
 assert.match(v.dom.get('yg-live-status').textContent,/위치 권한/);
});
