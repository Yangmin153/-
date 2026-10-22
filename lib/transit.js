/** ODsay-backed public transit. Never substitute invented durations for actual routes. */
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const point=p=>p&&typeof p.id==='string'&&typeof p.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180;
const hav=(a,b)=>{const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlng=(b.lng-a.lng)*rad;const k=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlng/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(k)));};
export function geographicOrder(origin,stops,destination){const remaining=[...stops],out=[];let here=origin;while(remaining.length){let at=0,best=Infinity;for(let i=0;i<remaining.length;i++){const value=hav(here,remaining[i])+hav(remaining[i],destination)*.075;if(value<best){best=value;at=i;}}const next=remaining.splice(at,1)[0];out.push(next);here=next;}const unlocked=out.filter(x=>!x.locked),kept=[];let at=0;for(const place of stops)kept.push(place.locked?place:unlocked[at++]);return kept;}
export function parseTransit(response){if(response?.error){throw Error(String(response.error.msg||response.error.message||'경로 조회 실패').slice(0,120));}
 const options=response?.result?.path;if(!Array.isArray(options)||!options.length)throw Error('이 구간의 대중교통 경로가 없습니다.');
 const sorted=options.filter(x=>Number.isFinite(Number(x?.info?.totalTime))&&Number(x.info.totalTime)>=0).sort((a,b)=>Number(a.info.totalTime)-Number(b.info.totalTime));
 const info=sorted[0]?.info;if(!info)throw Error('대중교통 소요시간이 제공되지 않습니다.');
 return {durationMinutes:Number(info.totalTime),distanceMeters:Math.max(0,Number(info.trafficDistance||0)+Number(info.totalWalk||0)),source:'odsay',pathType:sorted[0].pathType};
}
async function leg(a,b,apiKey){if(hav(a,b)<.015)return {durationMinutes:0,distanceMeters:0,source:'same_point',path:[]};
 const u=new URL('https://api.odsay.com/v1/api/searchPubTransPathT');for(const [k,v] of Object.entries({apiKey,SX:a.lng,SY:a.lat,EX:b.lng,EY:b.lat,OPT:0,SearchType:0}))u.searchParams.set(k,String(v));
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{const response=await fetch(u,{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw Error('ODsay HTTP '+response.status);
 const result=parseTransit(await response.json());return {...result,path:[[a.lng,a.lat],[b.lng,b.lat]]};}
 finally{clearTimeout(timer);}
}
export async function transitPlan(plan,env=process.env){const key=env.ODSAY_API_KEY;
 if(!key)return json({detail:'대중교통 경로 API가 연결되지 않았습니다. Vercel에 ODSAY_API_KEY를 설정해 주세요. 자동차 경로는 계속 사용할 수 있습니다.'},503);
 const {origin,destination,stops,mode}=plan||{};
 if(!point(origin)||!point(destination)||!Array.isArray(stops)||stops.length>30||!stops.every(point)||!['auto','manual'].includes(mode))return json({detail:'출발지·도착지 또는 방문지 정보가 올바르지 않습니다.'},400);
 const ordered=mode==='auto'?geographicOrder(origin,stops,destination):[...stops];const places=[origin,...ordered,destination],entries=[{kind:'origin',place:origin,leg:null}],warnings=[];
 let total=0,meters=0;
 const legs=new Array(places.length-1);let next=0,problem=null;
 await Promise.all(Array.from({length:Math.min(4,legs.length)},async()=>{while(next<legs.length&&!problem){const i=next++;try{legs[i]=await leg(places[i],places[i+1],key);}catch(error){problem={index:i+1,message:error.message};}}}));
 if(problem)return json({detail:problem.index+'번째 이동 구간 대중교통 조회 실패: '+problem.message+' 다른 장소나 자동차 이동을 선택해 주세요.'},422);
 for(let i=1;i<places.length;i++){const part=legs[i-1];total+=part.durationMinutes;meters+=part.distanceMeters;entries.push({kind:i===places.length-1?'destination':'stop',place:places[i],leg:part});}
 warnings.push('지도 선은 방문지 간 직선 연결입니다. 실제 버스·지하철 운행 선로를 나타내지 않습니다.');
 if(mode==='auto'&&ordered.length>1)warnings.push('방문 순서는 지리적 거리 기반으로 정리했습니다. 대중교통 최단시간 순서임을 보장하지 않습니다.');
 return json({transport:'transit',entries,orderIds:ordered.map(x=>x.id),totalDistanceMeters:meters,travelMinutes:total,drivingMinutes:0,totalMinutes:total,status:'transit_verified',warnings,savedMinutes:null,estimatedLegs:0,calculatedAt:new Date().toISOString()});
}
