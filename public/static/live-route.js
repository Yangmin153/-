/** GPS based route optimization. Only the displayed route is transient; saved planned stops remain untouched. */
(function(root){
 'use strict';
 const $=id=>document.getElementById(id);
 if(!root.document||!$('yg-live-optimize'))return;
 const button=$('yg-live-optimize'),status=$('yg-live-status');
 const app=()=>root.TripApp;
 let busy=false,run=0;
 const message=(text,error=false)=>{
  status.hidden=!text;status.textContent=text||'';
  status.dataset.error=String(error);
 };
 const readyGps=()=>root.isSecureContext&&Boolean(root.navigator?.geolocation);
 function position(){
  return new Promise((resolve,reject)=>{
   if(!readyGps())return reject(new Error(
    !root.isSecureContext?'현재 위치는 HTTPS 연결에서만 사용할 수 있어요.':'브라우저에서 위치 서비스를 사용할 수 없어요.'));
   root.navigator.geolocation.getCurrentPosition(resolve,reject,{
    enableHighAccuracy:true,timeout:12000,maximumAge:30000
   });
  });
 }
 function locationError(error){
  if(error?.code===1)return '현재 위치 권한이 필요해요. 브라우저에서 위치를 허용한 후 다시 눌러주세요.';
  if(error?.code===2)return '현재 위치를 확인하지 못했어요. GPS를 켜고 다시 시도해 주세요.';
  if(error?.code===3)return '위치 확인 시간이 초과됐어요. 다시 시도해 주세요.';
  return error?.message||'현재 위치를 가져오지 못했어요.';
 }
 function fingerprint(d){
  return JSON.stringify({id:d.id,date:d.date,origin:d.origin,destination:d.destination,
   stops:d.stops.map(s=>[s.id,s.lat,s.lng,s.locked]),mode:d.mode});
 }
 function show(){
  const d=app()?.getDay?.();
  const active=Boolean(d?.liveOrigin&&d?.result?.isLiveRoute);
  button.textContent=busy?'현재 위치로 계산 중…':'◎ 현재 위치에서 다시 최적화';
  button.disabled=busy||!d||!d.stops?.length||!d.date;
  if(!busy){
   if(!d?.stops?.length)message('방문지를 추가하면 현재 위치에서 최적화할 수 있어요.');
   else if(active)message('현재 위치에서 새로 계산한 동선이에요. 원래 계획은 그대로 보관돼요.');
   else if(status.dataset.error!=='true'&&!status.textContent.includes('원래 여행 계획'))message('');
  }
 }
 async function start(){
  if(busy)return;
  const d=app()?.getDay?.();
  if(!d||!d.stops?.length)return app()?.toast?.('먼저 방문지를 추가해 주세요.');
  if(!d.destination||/미설정/.test(d.destination.name||''))return app().toast('최종 도착지를 먼저 설정해 주세요.');
  if(!root.confirm('현재 위치에서 방문지와 최종 도착지까지 동선을 다시 계산할까요?\n위치 권한을 요청할 수 있으며 기존에 입력한 장소는 유지됩니다.'))return;
  const id=d.id,original=fingerprint(d),requestId=++run;
  busy=true;show();
  try{
   message('현재 위치를 확인하고 있어요…');
   const geo=await position(),lat=Number(geo.coords.latitude),lng=Number(geo.coords.longitude);
   if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)
    throw new Error('유효한 GPS 위치를 확인하지 못했어요.');
   if(!app()?.getDay?.()||app().getDay().id!==id||fingerprint(app().getDay())!==original)
    throw new Error('일정이 변경되어 계산을 취소했어요.');
   const gps={id:'gps-current-'+id.slice(0,30),name:'현재 위치',lat,lng,category:'교통',address:''};
   message('현재 위치를 기준으로 자동차 동선을 계산하고 있어요…');
   const time=new Date();
   const departure=String(time.getHours()).padStart(2,'0')+':'+String(time.getMinutes()).padStart(2,'0');
   const body={origin:gps,destination:d.destination,stops:d.stops,mode:'auto',departure};
   const res=await fetch('/api/route',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
   });
   const route=await res.json().catch(()=>null);
   if(!res.ok)throw new Error(route?.detail||'자동차 동선 계산에 실패했어요.');
   if(run!==requestId||app().getDay()?.id!==id||fingerprint(app().getDay())!==original)
    throw new Error('계산 중 여행 일정이 변경됐어요. 다시 시도해 주세요.');
   if(!app().applyLiveRoute(id,gps,route))
    throw new Error('동선 결과와 저장된 방문지가 일치하지 않아요.');
   message('현재 위치에서 동선을 다시 계산했어요. 아래 방문 순서를 확인해 주세요.');
   app().toast('현재 위치 기준으로 동선을 다시 계산했어요.');
   // Reoptimization updates only the map/timeline. Navigation is a separate user action.
  }catch(error){message(locationError(error),true);}
  finally{busy=false;show();}
 }
 button.addEventListener('click',start);
 document.addEventListener('trip:day-changed',()=>{run++;message('');show();});
 document.addEventListener('trip:days-imported',()=>{run++;message('');show();});
 document.addEventListener('trip:routes-ready',show);
 document.addEventListener('trip:live-route-changed',show);
 document.addEventListener('trip:stops-changed',show);
 document.addEventListener('trip:endpoint-changed',show);
 root.YeoLiveRoute=Object.freeze({start,show});
 show();
})(globalThis);
