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
function sections(day,provider,mode='via'){
 const points=mode==='direct'?(valid(day?.destination)?[day.destination]:null):orderedPoints(day);
 if(!points||!MAX_VIA[provider])return [];
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
let provider='naver',travelMode='via',config=null,loadPromise=null,activeDayId='',lastOpened=-1;
const panel=$('yg-nav-modal'),content=$('yg-nav-segments'),status=$('yg-nav-status');
const app=()=>root.TripApp,day=()=>app()?.getDay?.();
const explain=msg=>{status.textContent=msg;status.hidden=!msg;};
const storageKey='yeohaenggil.navigation.v7';
let locked=false,previousFocus=null;
function signature(d,p,m){
 if(!d)return '';
 const places=sections(d,p,m);
 if(!places.length)return '';
 return JSON.stringify([d.id,p,m,d.destination?.id,d.destination?.lat,d.destination?.lng,
  places.flatMap(part=>[...part.via,part.destination].map(x=>[x.id,x.lat,x.lng]))]);
}
function restoreProgress(d){
 lastOpened=-1;const sign=signature(d,provider,travelMode);if(!sign)return;
 try{const stored=JSON.parse(sessionStorage.getItem(storageKey)||'null');
  if(stored?.signature===sign&&Number.isInteger(stored.lastOpened))lastOpened=stored.lastOpened;
 }catch{}
}
function persistProgress(d){
 try{sessionStorage.setItem(storageKey,JSON.stringify({signature:signature(d,provider,travelMode),lastOpened}));}catch{}
}
function close(){
 if(panel.hidden)return;
 panel.hidden=true;document.body.classList.remove('yg-nav-open');
 if(locked){root.YGScrollLock?.unlock('navigation');locked=false;}
 previousFocus?.focus?.({preventScroll:true});previousFocus=null;
}
function nextIndex(parts){return lastOpened>=parts.length-1?0:Math.max(0,lastOpened+1);}
function redraw(){
 const selected=day(),parts=sections(selected,provider,travelMode),next=nextIndex(parts);
 const ready=parts.length>0,part=parts[next];
 $('yg-nav-open').disabled=!(valid(selected?.destination));
 $('yg-nav-start').disabled=!ready;
 $('yg-nav-provider-name').textContent=provider==='naver'?'네이버지도':'카카오내비';
 $('yg-nav-segment-count').textContent=travelMode==='direct'?'목적지로 바로 이동':
    (ready?'방문지 '+(selected?.result?.orderIds?.length||0)+'곳':'동선 계산 필요');
 const complete=ready&&lastOpened>=parts.length-1&&lastOpened>=0;
 $('yg-nav-start').textContent=!ready?'동선 계산 후 시작':complete?'처음부터 다시 안내':
  lastOpened>=0?'다음 길안내':'길안내 시작';
 if(!ready){
  content.innerHTML='';
  explain(travelMode==='via'?'방문지 동선을 먼저 계산해 주세요.':'이날의 도착지를 먼저 설정해 주세요.');
  return;
 }
 const left=parts.length-1-next;
 const rows=[...part.via,part.destination];
 const label=travelMode==='direct'?'현재 위치에서 도착지로 바로 안내해요.':
  (parts.length>1?'방문 순서 그대로 안내해요. 정차 후 다음 길안내를 눌러주세요.':'방문 순서 그대로 경유지로 안내해요.');
 explain(label);
 content.innerHTML='<div class="yg-nav-next-preview">'+
  '<strong>'+(lastOpened>=0&&!complete?'다음 이동':'이번에 안내할 길')+'</strong>'+
  '<p>현재 위치 → '+rows.map((p,i)=>safe(p.name)+(i<rows.length-1?' (경유)':'')).join(' → ')+'</p>'+
  (part.via.length?'<small>경유지 '+part.via.length+'곳 · 마지막 '+safe(part.destination.name)+'</small>':
   '<small>목적지 '+safe(part.destination.name)+'</small>')+
  (parts.length>1?'<small>남은 길안내 '+(parts.length-next)+'회</small>':'')+
  '</div>';
 // Keep the existing event interface available for previously bound integrations.
 if(!ready)return;
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
  if(!key)throw Error('카카오내비 연결 설정을 확인해 주세요. Vercel Preview의 JavaScript 키가 필요합니다.');
  if(!root.Kakao){
   await new Promise((resolve,reject)=>{
    const el=document.createElement('script');
    el.src='https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';
    el.async=true;el.onload=resolve;el.onerror=()=>reject(Error('카카오 내비 SDK를 불러오지 못했어요.'));
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
 const d=day();
 if(!valid(d?.destination)){
  app()?.toast?.('이날의 도착지를 먼저 설정해 주세요.');return;
 }
 previousFocus=document.activeElement;activeDayId=d.id;provider='naver';
 travelMode=orderedPoints(d)&&d.stops.length?'via':'direct';
 panel.querySelector('[name="yg-nav-provider-choice"][value="naver"]').checked=true;
 panel.querySelector('[name="yg-nav-mode-choice"][value="'+travelMode+'"]').checked=true;
 restoreProgress(d);
 panel.hidden=false;document.body.classList.add('yg-nav-open');
 root.YGScrollLock?.lock('navigation');locked=true;
 redraw();$('yg-nav-close')?.focus?.({preventScroll:true});
}
function launch(index,preview=false){
 const selected=day(),parts=sections(selected,provider,travelMode),part=parts[index];
 if(!part){explain('일정이 변경됐어요. 최신 동선을 확인해 주세요.');return;}
 if(activeDayId!==selected.id){explain('날짜가 바뀌었어요. 다시 선택해 주세요.');return;}
 if(travelMode==='via'&&!orderedPoints(selected)){explain('방문지 동선을 다시 계산해 주세요.');return;}
 if(provider==='naver'){
  const url=naverLaunchUrl(part,location.origin,navigator.userAgent,preview);
  lastOpened=index;persistProgress(selected);redraw();
  // Official Naver scheme: no slat/slng => device's current GPS location.
  window.location.href=url;return;
 }
 if(root.Kakao?.isInitialized?.()&&root.Kakao?.Navi?.start){
  try{
   root.Kakao.Navi.start(kakaoArguments(part));
   lastOpened=index;persistProgress(selected);redraw();
  }catch(e){explain('카카오내비를 열지 못했어요. '+e.message);}
 }else{
  explain('카카오내비 연결 중이에요. 완료 안내가 나오면 한 번 더 눌러주세요.');
  loadKakao().then(()=>explain('카카오내비 연결 완료. 이제 길안내를 눌러주세요.'))
   .catch(e=>explain(e.message));
 }
}
$('yg-nav-open').addEventListener('click',open);
$('yg-nav-start').addEventListener('click',()=>{
 const parts=sections(day(),provider,travelMode);
 if(!parts.length)return;
 launch(nextIndex(parts));
});
$('yg-nav-close').addEventListener('click',close);
panel.addEventListener('click',e=>{if(e.target===panel||e.target.closest('[data-nav-close]'))close();});
panel.querySelectorAll('[name="yg-nav-provider-choice"]').forEach(input=>input.addEventListener('change',()=>{
 if(!input.checked)return;provider=input.value;restoreProgress(day());redraw();
 if(provider==='kakao'){
  explain('카카오내비 연결 중이에요…');
  loadKakao().then(()=>explain('카카오내비 연결 완료. 길안내를 시작할 수 있어요.'))
   .catch(err=>explain(err.message));
 }
}));
panel.querySelectorAll('[name="yg-nav-mode-choice"]').forEach(input=>input.addEventListener('change',()=>{
 if(!input.checked)return;travelMode=input.value;restoreProgress(day());redraw();
}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close();});
document.addEventListener('trip:day-changed',()=>{if(!panel.hidden)close();else redraw();});
document.addEventListener('trip:stops-changed',()=>{if(!panel.hidden)close();else redraw();});
document.addEventListener('trip:endpoint-changed',()=>{if(!panel.hidden)close();else redraw();});
document.addEventListener('trip:routes-ready',()=>{if(!panel.hidden){restoreProgress(day());redraw();}});
document.addEventListener('trip:routes-cleared',()=>{if(!panel.hidden)close();else redraw();});
redraw();

root.TripNavigation=Object.freeze({open,close});
})(globalThis);
