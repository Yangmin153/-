/** 여행길 → 외부 내비게이션. Always start from the driver's current location.
 * No guessed travel times; never modify the optimized visit order. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const MAX_VIA=Object.freeze({naver:5,kakao:3});
const valid=p=>p&&typeof p.name==='string'&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&
 Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180;
const safe=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
function orderedPoints(day){
 if(!day?.result||!Array.isArray(day.result.orderIds)||!Array.isArray(day.stops))return null;
 const byId=new Map(day.stops.map(p=>[p.id,p])),ids=day.result.orderIds;
 if(ids.length!==day.stops.length||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))return null;
 const visits=ids.map(id=>byId.get(id));
 const entries=day.result.entries;
 if(!Array.isArray(entries)||entries.length!==visits.length+2||
    entries.slice(1,-1).some((entry,i)=>entry.place?.id!==visits[i].id))return null;
 const currentDestination=day.destination;
 if(!valid(currentDestination)||!valid(day.origin)||[...visits].some(x=>!valid(x)))return null;
 const last=entries.at(-1)?.place,first=entries[0]?.place;
 if(!valid(first)||!valid(last)||Number(last.lat)!==Number(currentDestination.lat)||
 Number(last.lng)!==Number(currentDestination.lng)||Number(first.lat)!==Number(day.origin.lat)||
 Number(first.lng)!==Number(day.origin.lng))return null;
 return [...visits,currentDestination];
}
function sections(day,provider){
 const points=orderedPoints(day);if(!points||!MAX_VIA[provider])return [];
 const limit=MAX_VIA[provider]+1,out=[];
 for(let i=0;i<points.length;i+=limit){
  const parts=points.slice(i,i+limit);
  out.push({index:out.length,via:parts.slice(0,-1),destination:parts.at(-1),
   startHint:i===0?'현재 위치':'이전 구간 도착지 근처의 현재 위치',
   visitOrder:parts.map(p=>p.name),last:i+limit>=points.length});
 }
 return out;
}
function naverUrl(part,webOrigin){
 if(!valid(part.destination))throw Error('도착지 좌표를 확인해 주세요.');
 // Do not set slat/slng: NAVER navigation defaults to the device's current location.
 const params=new URLSearchParams({dlat:String(part.destination.lat),dlng:String(part.destination.lng),
 dname:part.destination.name,appname:webOrigin});
 for(let i=0;i<part.via.length;i++){
  const n=i+1,p=part.via[i];
  params.set('v'+n+'lat',String(p.lat));
  params.set('v'+n+'lng',String(p.lng));
  params.set('v'+n+'name',p.name);
 }
 return 'nmap://navigation?'+params;
}
function kakaoArguments(part){
 return {name:part.destination.name,x:Number(part.destination.lng),y:Number(part.destination.lat),
 coordType:'wgs84',viaPoints:part.via.map(p=>({name:p.name,x:Number(p.lng),y:Number(p.lat)}))};
}
function naverRouteUrl(part,webOrigin){
 return naverUrl(part,webOrigin).replace(/^nmap:\/\/navigation\?/,'nmap://route/car?');
}
function androidNaverIntent(schemeUrl){
 const url=new URL(schemeUrl);
 if(url.protocol!=='nmap:')throw Error('지원하지 않는 네이버 지도 호출 주소입니다.');
 return 'intent://'+url.host+url.pathname+url.search+
  '#Intent;scheme=nmap;action=android.intent.action.VIEW;'+
  'category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end';
}
function naverLaunchUrl(part,webOrigin,agent,preview=false){
 const scheme=preview?naverRouteUrl(part,webOrigin):naverUrl(part,webOrigin);
 return /Android/i.test(agent||'')?androidNaverIntent(scheme):scheme;
}
const planner=Object.freeze({orderedPoints,sections,naverUrl,naverRouteUrl,naverLaunchUrl,androidNaverIntent,kakaoArguments,MAX_VIA});
root.TripNaviPlanner=planner;
if(!root.document||!$('yg-nav-open'))return;
let provider='naver',config=null,loadPromise=null,activeDayId='',lastOpened=-1;
const panel=$('yg-nav-modal'),content=$('yg-nav-segments'),status=$('yg-nav-status');
const app=()=>root.TripApp,day=()=>app()?.getDay?.();
const explain=msg=>{status.textContent=msg;status.hidden=!msg;};
function close(){
 panel.hidden=true;document.body.classList.remove('yg-nav-open');
}
function redraw(){
 const selected=day(),parts=sections(selected,provider);
 const unready=!parts.length;
 $('yg-nav-start').disabled=unready;
 $('yg-nav-open').disabled=unready;
 $('yg-nav-provider-name').textContent=provider==='naver'?'네이버지도 내비게이션':'카카오내비';
 content.innerHTML=parts.map(part=>'<div class="yg-nav-segment">'+
  '<div class="yg-nav-segment-top"><strong>'+(part.index+1)+'구간</strong><span>'+
   safe(part.startHint)+' → '+safe(part.destination.name)+'</span></div>'+
  (part.via.length?'<small>앱에 전달할 경유지 '+part.via.length+'곳: '+part.via.map((p,i)=>(i+1)+'. '+safe(p.name)).join(' → ')+'</small>':'<small>경유지 없이 목적지로 이동</small>')+
  '<button type="button" data-nav-segment="'+part.index+'">'+(part.index===0?'길안내 시작':'이 구간 실행')+'</button>'+
  (provider==='naver'&&part.via.length?'<button type="button" data-nav-preview="'+part.index+'" class="yg-nav-preview">경유지 포함 경로 먼저 확인</button>':'')+'</div>').join('');
 $('yg-nav-segment-count').textContent=parts.length?parts.length+'개 구간':'계산 결과 없음';
 explain(unready?'이 날짜의 동선을 먼저 계산해 주세요.':(parts.length>1?'한 구간을 마친 뒤 여행길로 돌아와 다음 구간을 실행하세요. ':'')+
 (provider==='kakao'?'카카오내비에는 최대 3개 경유지를 직접 전달합니다. ':'네이버지도에는 최대 5개 경유지를 직접 전달합니다. ')+
 '내비게이션은 현재 위치에서 시작하며, 실제 도로 경로는 내비 앱이 다시 계산합니다.');
 if(parts.length&&lastOpened>=0&&activeDayId===selected.id){
  const upcoming=content.querySelector('[data-nav-segment="'+Math.min(lastOpened+1,parts.length-1)+'"]');
  if(upcoming)upcoming.classList.add('yg-nav-next');
 }
}
async function getConfig(){
 if(config)return config;
 const r=await fetch('/api/config');if(!r.ok)throw Error('연동 설정을 불러오지 못했어요.');
 config=await r.json();return config;
}
async function loadKakao(){
 if(root.Kakao?.Navi?.start&&root.Kakao?.isInitialized?.())return root.Kakao;
 if(loadPromise)return loadPromise;
 loadPromise=(async()=>{
  const c=await getConfig(),key=String(c.kakaoJsKey||'');
  if(!key)throw Error('카카오내비 연동용 JavaScript 키가 아직 설정되지 않았어요. Vercel에 KAKAO_JAVASCRIPT_KEY를 등록해 주세요.');
  if(!root.Kakao){
   await new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src='https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';
    el.async=true;el.onload=resolve;el.onerror=()=>reject(Error('카카오 SDK를 불러오지 못했어요.'));
    document.head.appendChild(el);
   });
  }
  if(!root.Kakao?.isInitialized?.())root.Kakao.init(key);
  if(!root.Kakao?.Navi?.start)throw Error('카카오내비 SDK를 사용할 수 없어요.');
  return root.Kakao;
 })().catch(e=>{loadPromise=null;throw e});
 return loadPromise;
}
function open(){
 const d=day(),points=orderedPoints(d);
 if(!points){app()?.toast?.('동선을 계산하거나 최신 결과로 다시 계산해 주세요.');return;}
 activeDayId=d.id;lastOpened=-1;provider='naver';$('yg-nav-provider').value=provider;
 panel.hidden=false;document.body.classList.add('yg-nav-open');redraw();
}
function launch(index,preview=false){
 const selected=day(),parts=sections(selected,provider),part=parts[index];
 if(!part){explain('최신 동선으로 다시 계산한 뒤 내비게이션을 시작해 주세요.');return;}
 // Validate again at the exact moment navigation is opened.
 if(activeDayId!==selected.id||!orderedPoints(selected)){explain('일정이 변경됐어요. 다시 계산해 주세요.');return;}
 lastOpened=index;redraw();
 if(provider==='naver'){
  // Direct, trusted Naver official scheme. The external app uses GPS as origin.
  const url=naverLaunchUrl(part,location.origin,navigator.userAgent,preview);
  window.location.href=url;return;
 }
 // Call the app-launching SDK synchronously within the click when preloaded;
 // otherwise load the SDK and request a second direct user tap (mobile gesture requirement).
 if(root.Kakao?.isInitialized?.()&&root.Kakao?.Navi?.start){
  try{root.Kakao.Navi.start(kakaoArguments(part));}catch(e){explain(e.message);}
 }else{
  explain('카카오내비를 준비하고 있어요. 준비가 되면 다시 실행 버튼을 눌러주세요.');
  loadKakao().then(()=>explain('카카오내비 준비 완료. 길안내 버튼을 다시 눌러주세요.')).catch(e=>explain(e.message));
 }
}
$('yg-nav-open').addEventListener('click',open);
$('yg-nav-start').addEventListener('click',()=>launch(0));
$('yg-nav-close').addEventListener('click',close);
panel.addEventListener('click',e=>{
 if(e.target===panel||e.target.closest('[data-nav-close]'))return close();
 const preview=e.target.closest('[data-nav-preview]');
 if(preview)return launch(Number(preview.dataset.navPreview),true);
 const b=e.target.closest('[data-nav-segment]');if(b)launch(Number(b.dataset.navSegment));
});
$('yg-nav-provider').addEventListener('change',e=>{
 provider=e.target.value;lastOpened=-1;redraw();
 if(provider==='kakao'){
  explain('카카오내비 연결을 확인 중이에요…');
  loadKakao().then(()=>explain('카카오내비 준비 완료. 현재 위치에서 길안내를 시작할 수 있어요.'))
   .catch(err=>explain(err.message));
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
document.addEventListener('trip:day-changed',()=>{if(!panel.hidden)close();redraw();});
document.addEventListener('trip:stops-changed',()=>{if(!panel.hidden)close();redraw();});
document.addEventListener('trip:endpoint-changed',()=>{if(!panel.hidden)close();redraw();});
document.addEventListener('trip:routes-ready',redraw);
document.addEventListener('trip:routes-cleared',redraw);
redraw();
root.TripNavigation=Object.freeze({open,close});
})(globalThis);
