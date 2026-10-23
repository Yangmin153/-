'use strict';
// 여행길 v4: GitHub + Vercel 정적 프런트엔드.
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,9)}`);
const clone = (x) => structuredClone(x);
const STORAGE_KEY = 'yeohaenggil.v2.days';
const RECALC_KEY = 'yeohaenggil.vercel.recalc';
const DEFAULT_REGION = '제주';
const readableMinutes=value=>{const n=Math.max(0,Math.round(Number(value)||0)),h=Math.floor(n/60),m=n%60;return h?`${h}시간${m?' '+m+'분':''}`:`${m}분`;};
const p = (name,lat,lng) => ({id:uid(),name,lat,lng,locked:false});
const EXAMPLES = [
  ['제주국제공항',33.5104,126.4913],['서귀포 예시 숙소',33.2539,126.5594],
  ['성산일출봉 부근',33.4581,126.9424],['섭지코지 부근',33.4236,126.9303],
  ['협재해수욕장 부근',33.3940,126.2396],['오설록 부근',33.3059,126.2895],
  ['애월 부근',33.4628,126.3092],['비자림 부근',33.4890,126.8096],
  ['함덕해수욕장 부근',33.5431,126.6697]
];
function freshDays(){
 return [{id:uid(),origin:p('출발지 미설정',33.489,126.498),destination:p('도착지 미설정',33.489,126.498),departure:'09:00',mode:'auto',stops:[],result:null}];
}
function validPlace(q){return q&&typeof q.name==='string'&&q.name.length<=100&&Number.isFinite(Number(q.lat))&&Number.isFinite(Number(q.lng))&&Math.abs(Number(q.lat))<=90&&Math.abs(Number(q.lng))<=180}
function validDays(d){return Array.isArray(d)&&d.length>0&&d.length<=10&&d.every(day=>day&&validPlace(day.origin)&&validPlace(day.destination)&&Array.isArray(day.stops)&&day.stops.length<=30&&day.stops.every(validPlace)&&/^\d{2}:\d{2}$/.test(day.departure)&&['auto','manual'].includes(day.mode))}
function normalizeDays(days){return days.map(d=>{const {transport,...data}=d;return {...data,origin:omitStay(data.origin),destination:omitStay(data.destination),stops:data.stops.map(omitStay),result:null};});}
function omitStay(place){const {stayMinutes,...rest}=place;return rest;}
function loadDays(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(validDays(saved))return normalizeDays(saved)}catch{}return freshDays()}
const state={days:loadDays(),active:0,loading:false,modal:null,mapPicking:false,hadResult:{}};
const STOP_VIEW_KEY='yeohaenggil.stopView.v1';
let stopView='list';
// v5.3 uses a single unordered collection view.

let map=null, markers=[],paths=[],geocoderResults=[],pendingCalc=null,toastTimer=null,previewMarker=null,previewSelected=null,pendingRegionFocus=null;
let sdkReady=false, mapSetupDone=false, mapObserver=null, resizeFrame=0, sceneSignature='', sceneResult=null;
let mapCreateCount=0, mapResizeCount=0, overlayRenderCount=0;
let placeResults=[],placePage=0,placeMore=false,placeQuery="",placeSeq=0,placeTimer=null,placeAbort=null,placeComposing=false;
const searchCache=new Map(),SEARCH_TTL=25000,SEARCH_LIMIT=24;
const recommendationOpen=new Set(),recommendationCache=new Map();
let previousSearchType="";
const expandedStops=new Set();
let mapFitQueued=true,selectedMapStop=null,mapLocked=false,markerInfo=null;
const day=()=>state.days[state.active];
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300)}
function currentRegion(){return day().region||state.days[0].region||DEFAULT_REGION;}
function setRegion(value){const region=String(value||'').trim().replace(/\s+/g,' ').slice(0,28);if(!region)return false;for(const d of state.days)d.region=region;save();window.TripQuickAdd?.syncRegion?.();return true;}
function addQuickStop(item,allowDuplicate=false){const d=day();if(!validPlace(item))return {ok:false,error:'올바른 장소를 선택해 주세요.'};if(d.stops.length>=30)return {ok:false,error:'한 날짜에는 최대 30곳까지 추가할 수 있어요.'};const duplicated=d.stops.some(x=>(Boolean(x.sourceId)&&x.sourceId===String(item.id))||(Math.abs(x.lat-item.lat)<0.00003&&Math.abs(x.lng-item.lng)<0.00003&&x.name===item.name));if(duplicated&&!allowDuplicate)return {ok:false,duplicate:true};const stop={id:uid(),name:String(item.name).slice(0,100),lat:Number(item.lat),lng:Number(item.lng),address:String(item.address||'').slice(0,250),category:TripMeta.infer({categoryName:item.category,name:item.name}),sourceId:String(item.id||''),locked:false};d.stops.push(stop);markDirty(false);return {ok:true,stop};}
function save(){const snapshot=state.days.map(({result,...rest})=>rest);try{if(!window.YeoAccount?.isSignedIn?.())localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot))}catch{if(!save.warned){save.warned=true;toast('브라우저 저장 공간을 사용할 수 없습니다. 일정 저장 파일로 백업해 주세요.')}}}
function refresh({mapView=true}={}){renderTabs();renderEditor();renderResult();if(mapView)renderMap();save();window.TripUX?.render?.();window.MapWorkspace?.refresh?.()}
function renderTabs(){const el=$('day-tabs');el.innerHTML=state.days.map((d,i)=>`<button class="day-tab ${i===state.active?'active':''}" role="tab" aria-selected="${i===state.active}" data-day="${i}">DAY ${i+1}</button>`).join('')+(state.days.length<10?'<button class="day-add" id="day-add" title="날짜 추가" aria-label="여행 날짜 추가">+</button>':'');}
function renderEditor(){const d=day();document.body.dataset.stopView='list';
  document.querySelectorAll('[data-stop-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stopView===stopView)));
  $('stop-view-help').textContent='장소를 먼저 담으세요. 방문 순서는 동선을 계산한 후에 정해져요.';
  $('day-heading').textContent=`${state.active+1}일 차 일정`;$('day-caption').textContent='출발하는 곳과 마지막으로 갈 곳을 정해주세요.';
  $('btn-delete-day').disabled=state.days.length===1;$('origin-name').textContent=d.origin.name;$('origin-coord').textContent=d.origin.address||'오늘의 출발 장소';$('destination-name').textContent=d.destination.name;$('destination-coord').textContent=d.destination.address||'오늘의 마지막 장소';
  $('travel-date').value=d.date||'';$('departure').value=d.departure;$('place-count').textContent=d.stops.length;$('stops-empty').classList.toggle('hidden',d.stops.length!==0);
  d.mode='auto';$('mode-auto').classList.toggle('is-selected',d.mode==='auto');$('mode-manual').classList.toggle('is-selected',d.mode==='manual');$('btn-route').disabled=state.loading;$('btn-route').classList.toggle('is-busy',state.loading);$('btn-route').querySelector('span').textContent=state.loading?'최적 동선 계산 중…':d.result?'최적 동선 다시 계산':'최적 동선 만들기';
  $('stops-list').innerHTML=d.stops.map(stop=>{
    const meta=TripMeta.meta(stop);
    return `<div class="stop-card v53-stop" data-stop-id="${esc(stop.id)}">
      <span class="stop-category-icon" aria-hidden="true" style="color:${meta.color}">${TripMeta.icon(stop,20)}</span>
      <div class="v53-stop-info"><strong>${esc(stop.name)}</strong><small>${esc(meta.label)}${stop.address?' · '+esc(stop.address):''}</small></div>
      <button class="remove-stop" type="button" data-stop-id="${esc(stop.id)}" aria-label="${esc(stop.name)} 삭제">×</button>
    </div>`;
  }).join('');
}
function renderResult(){const d=day(),r=d.result;document.body.classList.toggle('has-route-result',Boolean(r));$('metric-places').textContent=d.stops.length;
 $('metric-mode-label').textContent='자동차 이동';$('result-alert').classList.add('hidden');$('route-savings').classList.add('hidden');
 $('map-caption').textContent=(state.active+1)+'일 차 · '+d.origin.name+' → '+d.destination.name;
 if(!r){$('metric-drive').textContent='—';$('metric-distance').textContent='—';$('result-status').textContent='길 찾기 전';$('result-status').className='result-status';$('timeline-note').textContent='장소를 담고 빠른 길 찾기를 눌러주세요';$('timeline').innerHTML='<div class="blank-timeline">방문지를 추가하고<br><strong>동선 계산하기</strong>를 눌러 주세요.</div>';return;}
 const minutes=r.drivingMinutes;$('metric-drive').textContent=readableMinutes(minutes);
 $('metric-distance').textContent=(r.totalDistanceMeters/1000).toFixed(1);
 const estimated=['estimated','mixed','road_partial'].includes(r.status);
 $('result-status').textContent=r.status==='road_exact'?'자동차 길 찾기 완료':estimated?'추정 구간 포함':'빠른 길 찾기 완료';
 $('result-status').className='result-status '+(estimated?'warning':'done');
 $('timeline-note').textContent='자동차'+' 이동 '+readableMinutes(minutes)+' · '+(r.totalDistanceMeters/1000).toFixed(1)+'km';
 if(Number.isFinite(r.savedMinutes)&&r.status==='road_exact'&&r.savedMinutes>0){$('route-savings').classList.remove('hidden');$('route-savings').textContent='기존 순서보다 '+readableMinutes(r.savedMinutes)+' 단축';}
 if(r.warnings?.length){$('result-alert').classList.remove('hidden');$('result-alert').textContent=r.warnings.join(' ');}
 $('timeline').innerHTML=r.entries.map((entry,i)=>{
  const leg=entry.leg,mode='자동차',meta=TripMeta.meta(entry.place);
  const segment=leg?'<div class="trip-leg-divider"><span class="trip-leg-summary">↓ '+mode+' · '+readableMinutes(leg.durationMinutes)+' 이동</span>'+(leg.source==='estimate'?'<span class="leg-estimated">추정</span>':'')+'<button type="button" class="timeline-nav" data-navigate-index="'+i+'" aria-label="이전 장소에서 '+esc(entry.place.name)+'까지 네이버 길안내">길안내 ↗</button></div>':'';
  return segment+'<div class="timeline-entry"><div class="timeline-rail"><span class="timeline-dot">'+(entry.kind==='origin'?'S':entry.kind==='destination'?'E':i)+'</span></div><div class="timeline-info"><span class="timeline-category" title="'+esc(meta.label)+'" style="color:'+esc(meta.color)+'">'+TripMeta.icon(entry.place,18)+'</span><strong>'+esc(entry.place.name)+'</strong><span class="timeline-kind">'+(entry.kind==='origin'?'출발':entry.kind==='destination'?'도착':i+'번째')+'</span></div></div>';
 }).join('');
}
function markDirty(shouldRecalculate=true){const d=day(),had=!!d.result;d.result=null;recommendationOpen.clear();recommendationCache.clear();refresh();if(had){window.TripQuickAdd?.setDirty?.(true);$('timeline-note').textContent='방문지가 바뀌었어요. 다시 계산해 주세요.';}document.dispatchEvent(new Event('trip:stops-changed'));}
function addDay(){if(state.days.length>=10)return toast('최대 10일까지 설정할 수 있습니다.');clearTimeout(pendingCalc);const prev=state.days[state.days.length-1];const origin=clone(prev.destination);origin.id=uid();const dest=clone(prev.destination);dest.id=uid();let nextDate='';if(prev.date){const t=new Date(prev.date+'T00:00:00Z');t.setUTCDate(t.getUTCDate()+1);nextDate=t.toISOString().slice(0,10);}state.days.push({id:uid(),origin,destination:dest,date:nextDate,departure:'09:00',mode:'auto',stops:[],result:null});state.active=state.days.length-1;refresh();toast('새로운 날짜를 추가했습니다. 전날 도착지를 출발지로 사용합니다.')}
function deleteDay(){if(state.days.length<=1)return;if(!confirm(`${state.active+1}일 차 일정을 삭제하시겠습니까?`))return;clearTimeout(pendingCalc);state.days.splice(state.active,1);state.active=Math.min(state.active,state.days.length-1);refresh()}
function moveStop(id,delta){const d=day();const ix=d.stops.findIndex(s=>s.id===id),to=ix+delta;if(ix<0||to<0||to>=d.stops.length)return;const had=Boolean(d.result);[d.stops[ix],d.stops[to]]=[d.stops[to],d.stops[ix]];d.mode='manual';markDirty(false);if(had)calculateRoute(false);else toast('순서를 변경했습니다. 계산 버튼으로 이동시간을 확인하세요.')}
function removeStop(id){const d=day();d.stops=d.stops.filter(s=>s.id!==id);markDirty();toast('장소를 일정에서 삭제했습니다.')}
async function calculateRoute(explicit=true){
 const d=day();if(state.loading){if(explicit)toast('이미 여행 동선을 계산하고 있어요.');return;}
 clearTimeout(pendingCalc);
 if(!d.origin||!d.destination||/미설정/.test(d.origin.name)||/미설정/.test(d.destination.name))return toast('출발지와 최종 도착지를 먼저 검색해 지정해 주세요.');
 const dayId=d.id;
 let calculationSucceeded=false;
 d.mode='auto';
 const body={origin:d.origin,destination:d.destination,stops:d.stops,departure:d.departure,mode:d.mode};
 const snapshot=JSON.stringify(body);
 window.YeoSearch?.hide?.();
 state.loading=true;$('route-loading-status').hidden=false;$('mobile-route-status').hidden=false;
 $('mobile-route').disabled=true;renderEditor();window.TripUX?.render?.();
 try{
  const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:snapshot});
  if(!response.ok){const detail=await response.json().catch(()=>null);throw Error(typeof detail?.detail==='string'?detail.detail:'경로 조회 실패 ('+response.status+')');}
  const result=await response.json();
  const dest=state.days.find(x=>x.id===dayId);
  if(!dest||JSON.stringify({origin:dest.origin,destination:dest.destination,stops:dest.stops,departure:dest.departure,mode:dest.mode})!==snapshot)throw Error('계산 중 일정이 변경되었습니다. 다시 계산해 주세요.');
  if(dest.mode==='auto'){const byId=new Map(dest.stops.map(stop=>[stop.id,stop]));const sorted=result.orderIds.map(id=>byId.get(id)).filter(Boolean);if(sorted.length===dest.stops.length)dest.stops=sorted;}
  dest.result=result;calculationSucceeded=true;mapFitQueued=true;window.TripQuickAdd?.setDirty?.(false);
  if(result.status!=='road_exact')toast('추정 구간이 있을 수 있습니다. 결과의 추정 표시를 확인하세요.');else toast('여행 동선을 계산했습니다.');
 }catch(error){
  toast('길을 찾지 못했어요: '+error.message);state.routeError=error.message;
 }finally{
  state.loading=false;$('route-loading-status').hidden=true;$('mobile-route-status').hidden=true;refresh();
  if(state.routeError){$('result-alert').textContent=state.routeError+' · 이동수단과 장소를 확인한 후 다시 계산해 주세요.';$('result-alert').classList.remove('hidden');state.routeError=null;}
  if(calculationSucceeded&&day().result&&day().id===dayId){window.YeoSearch?.hide?.();window.TripUX?.switchView?.('map');requestAnimationFrame(()=>setTimeout(()=>{resizeMapStable({fit:true});if(matchMedia('(max-width:768px)').matches)$('map-region').scrollIntoView({behavior:'smooth',block:'start'});},120));}
 }
}
// — 장소 편집 / 지도 클릭 —
function openModal(kind,id=null){window.TripUX?.beforeModal?.();syncModalViewport();const d=day();const existing=kind==='origin'?d.origin:kind==='destination'?d.destination:d.stops.find(s=>s.id===id);
 state.modal={kind,id,lat:existing?.lat??null,lng:existing?.lng??null,selectedAddress:existing?.address||null,selectedCategory:existing?.category||TripMeta.infer(existing),searchPendingSelection:false};$('modal-heading').textContent=kind==='origin'?'출발지 변경':kind==='destination'?'도착지 변경':id?'장소 수정':'장소 추가';
 $('place-query').value='';$('place-scope').value='all';$('place-results').innerHTML='';$('place-search-status').textContent='장소를 검색한 뒤 원하는 지점을 선택하세요.';$('place-more').classList.add('hidden');$('place-selected').classList.add('hidden');$('btn-modal-save').disabled=false;$('modal-name-details').open=false;placeResults=[];placePage=0;placeMore=false;placeQuery='';previousSearchType='';
 $('input-name').value=existing?.name||'';$('input-category').innerHTML=TripMeta.choices(state.modal.selectedCategory);$('category-field').classList.toggle('hidden',kind!=='stop');$('address-query').value='';$('address-results').innerHTML='';$('input-lat').value=existing?.lat??'';$('input-lng').value=existing?.lng??'';selectModalTab('place');updateCoordLabel();$('place-modal').classList.remove('hidden');$('place-modal').setAttribute('aria-hidden','false');setTimeout(()=>$('place-query').focus(),40)
}
function closeModal(){if(state.mapPicking)return;window.TripUX?.onModalClosed?.();cancelPlaceSearch();state.modal=null;placeComposing=false;document.body.classList.remove('place-keyboard-open');$('place-modal').classList.add('hidden');$('place-modal').setAttribute('aria-hidden','true')}
function syncModalViewport(){const viewport=window.visualViewport;document.documentElement.style.setProperty('--yg-place-viewport-height',Math.round(viewport?.height||innerHeight)+'px');document.documentElement.style.setProperty('--yg-place-viewport-top',Math.round(viewport?.offsetTop||0)+'px');document.body.classList.toggle('place-keyboard-open',Boolean(viewport&&innerHeight-viewport.height>130&&!$('place-modal').classList.contains('hidden')));}
function selectModalTab(t){document.querySelectorAll('[data-modal-tab]').forEach(el=>el.classList.toggle('active',el.dataset.modalTab===t));['place','address'].forEach(k=>$(`modal-${k}`).classList.toggle('hidden',k!==t));}
function updateCoordLabel(){$('selected-coord').textContent='';}
function setModalCoords(lat,lng,name){if(!state.modal)return;state.modal.lat=Number(lat);state.modal.lng=Number(lng);$('input-lat').value=lat;$('input-lng').value=lng;if(name)$('input-name').value=name;updateCoordLabel()}
function saveModal(){if(!state.modal)return;if(state.modal.searchPendingSelection)return toast('검색 결과에서 장소를 먼저 선택해 주세요.');const {kind,id}=state.modal;if(kind==='stop'&&!id&&window.YeoRegion&&!window.YeoRegion.ensureSelected())return;const name=$('input-name').value.trim();let lat=Number($('input-lat').value),lng=Number($('input-lng').value);if($('input-lat').value.trim()===''||$('input-lng').value.trim()===''){lat=state.modal.lat;lng=state.modal.lng}
 if(!name||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return toast('장소 이름과 올바른 위도·경도를 입력해 주세요.');
 const d=day();const oldDestination=clone(d.destination);const place={id:id||uid(),name,lat,lng,locked:false,category:kind==='stop'?$('input-category').value:TripMeta.infer({name})};
 if(state.modal.selectedAddress)place.address=state.modal.selectedAddress;
 if(kind==='origin'){place.id=d.origin.id;d.origin=place}else if(kind==='destination'){place.id=d.destination.id;d.destination=place;const nextDay=state.days[state.active+1];if(nextDay && nextDay.origin.name===oldDestination.name && nextDay.origin.lat===oldDestination.lat && nextDay.origin.lng===oldDestination.lng){nextDay.origin={...clone(place),id:nextDay.origin.id};nextDay.result=null}}else if(id){const ix=d.stops.findIndex(s=>s.id===id);if(ix===-1)return toast('수정할 관광지를 찾지 못했습니다.');place.locked=d.stops[ix].locked;d.stops[ix]=place}else{if(d.stops.length>=30)return toast('한 날짜에 방문지는 최대 30곳까지 추가할 수 있습니다.');d.stops.push(place)}
 state.modal=null;$('place-modal').classList.add('hidden');$('place-modal').setAttribute('aria-hidden','true');window.TripUX?.onModalClosed?.();markDirty();toast('일정에 장소를 반영했습니다.')
}
// 상호명 검색은 별도 카카오 로컬 API 사용. 네이버 주소 변환/지도/동선 엔진은 변경하지 않음.
function cancelPlaceSearch(){clearTimeout(placeTimer);placeSeq++;if(placeAbort)placeAbort.abort();placeAbort=null;$('btn-search-place').disabled=false;}
function placeStatus(msg){$('place-search-status').textContent=msg;}
function renderPlaceResults(){
 const container=$('place-results');
 if(!placeResults.length){container.innerHTML='<div class="place-no-results"><strong>검색 결과가 없어요.</strong><p>장소 이름이나 주소를 바꿔서 다시 검색해 주세요.</p></div>';$('place-address-fallback').classList.remove('hidden');return;}
 $('place-address-fallback').classList.add('hidden');
 container.innerHTML=placeResults.map((x,i)=>{
  const address=String(x.address||'주소 정보 없음'),isAddress=x.source==='naver-address';
  const type=isAddress?'주소':String(x.category||'장소').split(' > ').at(-1);
  const safeUrl=typeof x.url==='string'&&/^https:\/\//i.test(x.url)?x.url:null;
  return `<div class="place-hit ${isAddress?'place-address-hit':''}"><button type="button" class="place-hit-main" data-place-select="${i}" aria-pressed="false" aria-label="${esc(x.name)} 선택"><span class="place-result-icon" aria-hidden="true">${isAddress?'⌖':'↗'}</span><span class="place-hit-content"><span class="place-hit-top"><strong>${esc(x.name)}</strong><span>${esc(type)}</span></span><span class="place-hit-address">${esc(address)}</span></span><span class="place-hit-chevron" aria-hidden="true">›</span></button>${safeUrl?`<a class="place-hit-detail" href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(x.name)} 상세 보기">상세</a>`:''}</div>`;
 }).join('');
}
async function searchPlaces(nextPage=false){
 const q=$('place-query').value.trim();
 if(q.length<2){cancelPlaceSearch();placeResults=[];$('place-results').innerHTML='';placeStatus('두 글자 이상 입력해 주세요.');$('place-more').classList.add('hidden');return;}
 if(!nextPage){cancelPlaceSearch();placeResults=[];placePage=0;placeQuery=q;previousSearchType='';$('place-results').innerHTML='';$('place-address-fallback').classList.add('hidden');}
 else if(q!==placeQuery||!placeMore)return;
 const seq=++placeSeq;placeAbort=new AbortController();const signal=placeAbort.signal,page=placePage+1;
 const params=new URLSearchParams({q,page:String(page)});
 if($('place-scope').value==='nearby'){params.set('nearby','1');params.set('lat',day().origin.lat);params.set('lng',day().origin.lng);}
 $('btn-search-place').disabled=true;$('place-more').classList.add('hidden');placeStatus('장소와 주소를 찾고 있어요…');
 // On address-shaped queries we fetch both sources together. For ordinary keywords,
 // Naver address lookup only runs when the Kakao keyword search has no matches.
 async function requestJson(path){
   const now=Date.now(),hit=searchCache.get(path);
   if(hit&&now-hit.time<SEARCH_TTL)return hit.data;
   const res=await fetch(path,{signal});const data=await res.json();if(!res.ok)throw Error(data?.detail||'검색 서비스를 사용할 수 없습니다.');
   if(signal.aborted)throw new DOMException('검색 취소','AbortError');
   searchCache.set(path,{data,time:Date.now()});while(searchCache.size>SEARCH_LIMIT)searchCache.delete(searchCache.keys().next().value);
   return data;
  }
 const addressPath=`/api/geocode?q=${encodeURIComponent(q)}`;
 const placeRequest=requestJson(`/api/places?${params}`);
 const addressRequest=!nextPage&&window.TripSearch.looksLikeAddress(q)?requestJson(addressPath):null;
 try{
  const [placeOutcome,addressOutcome]=await Promise.allSettled([placeRequest,addressRequest||Promise.resolve(null)]);
  if(seq!==placeSeq||!state.modal)return;
  const items=placeOutcome.status==='fulfilled'?(placeOutcome.value.items||[]):[];
  let addressData=addressOutcome.status==='fulfilled'?addressOutcome.value:null;
  let addressError=addressOutcome.status==='rejected'?addressOutcome.reason:null;
  if(!nextPage&&!addressRequest&&!items.length){try{addressData=await requestJson(addressPath);}catch(err){addressError=err;}}
  if(seq!==placeSeq||!state.modal)return;
  if(placeOutcome.status==='rejected'&&!addressData?.results?.length){throw placeOutcome.reason;}
  const merged=window.TripSearch.combine(items,addressData?.results||[]);
  placeResults=nextPage?window.TripSearch.combine(placeResults.concat(merged),[]):merged;
  placePage=page;placeMore=placeOutcome.status==='fulfilled'&&Boolean(placeOutcome.value.hasNext);
  previousSearchType=addressData?.results?.length?'place-address':'place';
  renderPlaceResults();$('place-more').classList.toggle('hidden',!placeMore);
  const addressCount=placeResults.filter(x=>x.source==='naver-address').length;
  placeStatus(placeResults.length?`${placeResults.length}개 결과${addressCount?' · 주소 검색 포함':''}${placeMore?' · 더 보기 가능':''}`:(addressError?'검색 결과가 없습니다. 주소를 정확하게 입력하거나 다시 시도해 주세요.':'검색 결과가 없습니다. 다른 검색어로 시도해 주세요.'));
 }catch(err){if(seq!==placeSeq||err.name==='AbortError')return;placeStatus(err.message);if(!nextPage)$('place-results').innerHTML='<div class="place-no-results">검색 서비스를 연결하지 못했어요. 잠시 후 다시 시도해 주세요.</div>';}
 finally{if(seq===placeSeq){$('btn-search-place').disabled=false;placeAbort=null;}}
}
async function searchAddress(){const query=$('address-query').value.trim();if(query.length<2)return toast('검색할 도로명·지번 주소를 입력해 주세요.');$('address-results').textContent='주소 검색 중…';
 try{const r=await fetch(`/api/geocode?q=${encodeURIComponent(query)}`),data=await r.json();if(!r.ok)throw new Error(data?.detail||'검색 실패');geocoderResults=data.results||[];const el=$('address-results');el.innerHTML=geocoderResults.length?geocoderResults.map((x,i)=>`<button class="address-result" data-address-index="${i}">${esc(x.address)} <span>↗</span></button>`).join(''):'검색 결과가 없습니다. 정확한 주소로 다시 검색하거나 지도에서 장소를 골라주세요.'}
 catch(err){$('address-results').textContent=`주소 검색 불가: ${err.message}`}
}
function startMapPick(){window.TripUX?.switchView?.('map');if(!map){toast('네이버 지도를 연결한 뒤 이용할 수 있습니다.');return}state.mapPicking=true;$('place-modal').classList.add('hidden');$('place-modal').setAttribute('aria-hidden','true');$('map-select-notice').classList.remove('hidden');$('map-region').scrollIntoView({behavior:'smooth',block:'center'});toast('지도 위 원하는 위치를 눌러 선택하세요.')}
function cancelMapPick(){state.mapPicking=false;$('map-select-notice').classList.add('hidden');if(state.modal){$('place-modal').classList.remove('hidden');$('place-modal').setAttribute('aria-hidden','false')}}
// — 지도 —
function mapHasArea(){const a=$('map')?.getBoundingClientRect(),b=$('map-region')?.getBoundingClientRect();return Boolean(a&&b&&a.width>96&&a.height>140&&b.width>96&&b.height>140);}
function mapStatus(message,detail='',error=false){const el=$('map-placeholder');el.classList.remove('hidden');el.dataset.mapStatus=error?'error':'loading';el.setAttribute('role',error?'alert':'status');el.querySelector('strong').textContent=message;let span=el.querySelector('.map-placeholder-detail');if(!span){span=document.createElement('span');span.className='map-placeholder-detail';el.append(span);}span.textContent=detail;}
function resizeMapStable({fit=false}={}){
 if(fit)mapFitQueued=true;cancelAnimationFrame(resizeFrame);
 resizeFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(!mapHasArea())return;
  if(!map){createMapIfVisible();return;}
  if(!window.naver?.maps)return;
  try{map.autoResize();mapResizeCount++;if(mapFitQueued){mapFitQueued=false;fitMap();}}catch(error){console.warn('지도 크기 조정 실패',error);mapFitQueued=true;}
 }));
}
function createMapIfVisible(){
 if(map||!sdkReady||!window.naver?.maps||!mapHasArea())return;
 try{
  map=new naver.maps.Map('map',{center:new naver.maps.LatLng(33.39,126.55),zoom:10,minZoom:6,zoomControl:false,scrollWheel:false});
  mapCreateCount++;markerInfo=new naver.maps.InfoWindow({backgroundColor:'#fff',borderColor:'#e5ecf6',borderWidth:1,maxWidth:260});
  setMapLocked(window.matchMedia('(max-width: 768px)').matches);$('map-placeholder').classList.add('hidden');
  naver.maps.Event.addListener(map,'click',evt=>{if(!state.mapPicking||!state.modal)return;setModalCoords(evt.coord.lat(),evt.coord.lng());state.modal.selectedAddress=null;state.modal.searchPendingSelection=false;$('btn-modal-save').disabled=false;$('place-query').value='';$('input-name').value='';$('modal-name-details').open=true;state.mapPicking=false;$('map-select-notice').classList.add('hidden');selectModalTab('place');$('place-modal').classList.remove('hidden');$('place-modal').setAttribute('aria-hidden','false');syncModalViewport();$('input-name').focus({preventScroll:true});toast('지도에서 위치를 골랐어요. 장소 이름을 입력해 주세요.');});
  renderMap();
  if(pendingRegionFocus){
   mapFitQueued=false;
   map.setCenter(new naver.maps.LatLng(pendingRegionFocus.lat,pendingRegionFocus.lng));
   map.setZoom(pendingRegionFocus.zoom);
  }
  if(previewSelected)previewPlace(previewSelected);naver.maps.Event.addListener(map,'zoom_changed',()=>{$('map-region').classList.toggle('map-zoomed-out',map.getZoom()<=12)});document.dispatchEvent(new Event('trip-map-ready'));
 }catch(error){map=null;console.warn('네이버 지도 초기화 오류',error);mapStatus('지도를 초기화하지 못했어요','페이지를 새로고침하거나 네이버 지도 설정을 확인해 주세요.',true);}
}
function bootNaverMap(key){
 if(mapSetupDone)return;mapSetupDone=true;
 if(!key){mapStatus('네이버 지도 키가 필요해요','Vercel의 NAVER_MAPS_JS_KEY_ID를 확인해 주세요.',true);return;}
 mapStatus('네이버 지도를 불러오는 중이에요','지도 연결을 확인하고 있어요.');
 let authFailed=false,timer=null;
 window.navermap_authFailure=()=>{authFailed=true;sdkReady=false;clearTimeout(timer);mapStatus('네이버 지도 인증에 실패했어요','Dynamic Map 사용 권한과 Preview 도메인의 Web 서비스 URL 등록을 확인해 주세요.',true);};
 const loaded=()=>{
  if(sdkReady||authFailed)return;
  if(typeof window.naver?.maps?.Map!=='function'){mapStatus('지도 SDK 로드 실패','네트워크와 네이버 지도 API 설정을 확인해 주세요.',true);return;}
  sdkReady=true;clearTimeout(timer);
  if(typeof ResizeObserver==='function'){mapObserver=new ResizeObserver(()=>resizeMapStable());mapObserver.observe($('map-region'));}
  window.addEventListener('orientationchange',()=>setTimeout(()=>resizeMapStable({fit:true}),250));
  window.addEventListener('resize',()=>resizeMapStable());
  window.addEventListener('pageshow',()=>resizeMapStable());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)resizeMapStable();});
  resizeMapStable({fit:true});
 };
 window.__ygNaverMapsLoaded=loaded;
 if(typeof window.naver?.maps?.Map==='function'){loaded();return;}
 const prev=document.getElementById('naver-maps-sdk');if(prev){prev.addEventListener('load',loaded,{once:true});return;}
 const script=document.createElement('script');script.id='naver-maps-sdk';script.async=true;
 script.src='https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId='+encodeURIComponent(key)+'&callback=__ygNaverMapsLoaded';
 script.addEventListener('load',()=>{if(!sdkReady&&!authFailed&&typeof window.naver?.maps?.Map==='function')loaded();},{once:true});
 script.addEventListener('error',()=>mapStatus('네이버 지도 스크립트 로드 실패','네트워크와 지도 서비스 설정을 확인해 주세요.',true),{once:true});
 document.head.append(script);
 timer=setTimeout(()=>{if(!sdkReady&&!authFailed)mapStatus('지도 연결이 지연되고 있어요','Dynamic Map 권한과 Preview 도메인을 확인해 주세요.',true);},14000);
}
function clearMap(){markers.forEach(x=>x.setMap(null));paths.forEach(x=>x.setMap(null));markers=[];paths=[];markerInfo?.close();}
function centerMapAtRegion(place){
 if(!validMapPlace(place))return false;
 pendingRegionFocus={lat:place.lat,lng:place.lng,zoom:11};
 mapFitQueued=false;
 if(map&&sdkReady&&mapHasArea()){
  map.setCenter(new naver.maps.LatLng(place.lat,place.lng));
  map.setZoom(11);
 }
 return true;
}
function validMapPlace(place){return place&&Number.isFinite(place.lat)&&Number.isFinite(place.lng)&&place.lat>=-90&&place.lat<=90&&place.lng>=-180&&place.lng<=180;}
function routePlaces(){const d=day(),byId=new Map(d.stops.map(x=>[x.id,x]));const sorted=d.result?.orderIds?d.result.orderIds.map(id=>byId.get(id)).filter(Boolean):d.stops;return [d.origin,...sorted,d.destination].filter(x=>validMapPlace(x)&&!/미설정/.test(x.name));}
function fitMap(padding){if(!map||!window.naver?.maps)return;if(!mapHasArea()){mapFitQueued=true;return;}const places=routePlaces();if(!places.length)return;
 if(places.length===1||places.every(p=>Math.abs(p.lat-places[0].lat)<.00001&&Math.abs(p.lng-places[0].lng)<.00001)){map.setCenter(new naver.maps.LatLng(places[0].lat,places[0].lng));map.setZoom(14);return;}
 const bounds=new naver.maps.LatLngBounds();for(const p of places)bounds.extend(new naver.maps.LatLng(p.lat,p.lng));
 for(const e of day().result?.entries||[])for(const point of e.leg?.path||[])if(Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1])&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90)bounds.extend(new naver.maps.LatLng(point[1],point[0]));
 const pad=padding||window.MapWorkspace?.fitPadding?.()||{top:72,right:64,bottom:86,left:64};
 map.fitBounds(bounds,{...pad,maxZoom:15});
}
function selectedStopDetails(place,idx,kind){const info=TripMeta.meta(place);const escaped=esc(place.name);return `<div class="map-popover"><span class="map-popover-type">${kind==='origin'?'출발지':kind==='destination'?'최종 도착지':`${idx}번째 · ${info.label}`}</span><strong>${escaped}</strong><span>${esc(place.address||'')}</span></div>`;}
function previewPlace(place){if(!validMapPlace(place))return false;previewSelected=place;$('map-preview-name').textContent=place.name;$('map-preview-address').textContent=place.address||'선택한 위치를 지도에서 확인하세요.';$('map-place-preview').hidden=false;
 if(!map){if(sdkReady)resizeMapStable();return true;}if(previewMarker)previewMarker.setMap(null);
 previewMarker=new naver.maps.Marker({map,position:new naver.maps.LatLng(place.lat,place.lng),zIndex:1800,title:place.name,icon:{content:'<div style="background:#2469d9;color:#fff;border:3px solid white;border-radius:50%;height:18px;width:18px;box-shadow:0 2px 9px #12294366"></div>',anchor:new naver.maps.Point(10,10)}});
 map.panTo(new naver.maps.LatLng(place.lat,place.lng));if(map.getZoom()<12)map.setZoom(12);return true;}
function clearPlacePreview(){previewSelected=null;$('map-place-preview').hidden=true;if(previewMarker){previewMarker.setMap(null);previewMarker=null;}}
function focusPlace(id){if(!map)return;const item=routePlaces().find(p=>p.id===id);if(!item)return;selectedMapStop=id;renderMap();const point=new naver.maps.LatLng(item.lat,item.lng);if(!map.getBounds()?.hasLatLng?.(point))map.panTo(point);const marker=markers.find(x=>x.__placeId===id);if(marker&&markerInfo){const idx=routePlaces().findIndex(x=>x.id===id);markerInfo.setContent(selectedStopDetails(item,idx,idx===0?'origin':idx===routePlaces().length-1?'destination':'stop'));markerInfo.open(map,marker);}}
function setMapLocked(next){mapLocked=Boolean(next);if(map)map.setOptions({draggable:!mapLocked,pinchZoom:!mapLocked,scrollWheel:!mapLocked,keyboardShortcuts:!mapLocked,disableDoubleTapZoom:mapLocked,disableDoubleClickZoom:mapLocked,disableTwoFingerTapZoom:mapLocked});}
function renderMap(){if(!map)return;const d=day(),places=routePlaces();const r=d.result;const routePanelVisible=!matchMedia('(max-width:768px)').matches||document.body.dataset.mobileView==='map';const signature=JSON.stringify([d.id,routePanelVisible,...places.map(x=>[x.id,x.name,x.lat,x.lng,x.category])]);if(signature===sceneSignature&&r===sceneResult){if(mapFitQueued)resizeMapStable();return;}sceneSignature=signature;sceneResult=r;overlayRenderCount++;clearMap();if(!places.length)return;
 places.forEach((place,i)=>{
  const start=i===0,end=i===places.length-1,kind=start?'origin':end?'destination':'stop',active=selectedMapStop===place.id,meta=TripMeta.meta(place);
  const bg=start?'#1762c2':end?'#293449':'#ffffff',color=start||end?'#fff':meta.color;
  const label=r?.entries?String(i+1):'•';const content=`<div class="route-marker ${kind} ${active?'active':''}" style="--category-color:${meta.color};--marker-bg:${bg};--marker-ink:${color}" aria-hidden="true"><span class="marker-order">${label}</span></div>`;
  const marker=new naver.maps.Marker({position:new naver.maps.LatLng(place.lat,place.lng),map,title:place.name,zIndex:active?900:start||end?500:100+i,icon:{content,anchor:new naver.maps.Point(10,10)}});
  marker.__placeId=place.id;markers.push(marker);
  naver.maps.Event.addListener(marker,'click',()=>{selectedMapStop=place.id;renderMap();const node=markers.find(x=>x.__placeId===place.id);if(node&&markerInfo){markerInfo.setContent(selectedStopDetails(place,i,kind));markerInfo.open(map,node);}document.querySelectorAll('.stop-card').forEach(x=>x.classList.toggle('map-selected',x.dataset.stopId===place.id));});
 });
 if(routePanelVisible&&r?.entries){r.entries.slice(1).forEach(entry=>{const leg=entry.leg;if(!leg||!Array.isArray(leg.path)||!leg.path.length)return;const coords=leg.path.filter(pair=>Array.isArray(pair)&&pair.length>=2&&Number.isFinite(pair[0])&&Number.isFinite(pair[1])).map(pair=>new naver.maps.LatLng(pair[1],pair[0]));if(coords.length<2)return;paths.push(new naver.maps.Polyline({map,path:coords,strokeColor:leg.source==='estimate'?'#e59b59':'#2475e7',strokeWeight:5,strokeOpacity:.78,strokeStyle:leg.source==='estimate'?'shortdash':'solid',zIndex:20}));});}
 
 if(mapFitQueued){mapFitQueued=false;fitMap();}
 window.MapWorkspace?.refresh?.();
}
// — 이벤트 —
$('day-tabs').addEventListener('click',e=>{const btn=e.target.closest('[data-day]');if(btn){clearTimeout(pendingCalc);state.active=Number(btn.dataset.day);mapFitQueued=true;selectedMapStop=null;refresh();return}if(e.target.closest('#day-add'))addDay()});
$('btn-delete-day').addEventListener('click',deleteDay);
$('travel-date').addEventListener('change',e=>{day().date=e.target.value;refresh()});
$('auto-recalc').checked=localStorage.getItem(RECALC_KEY)==='1';$('auto-recalc').addEventListener('change',e=>{localStorage.setItem(RECALC_KEY,e.target.checked?'1':'0');toast(e.target.checked?'변경 후 경로 자동 재계산을 켰습니다. 유료 API 호출에 유의하세요.':'자동 재계산을 껐습니다. 필요할 때 계산 버튼을 누르세요.')});
$('departure').addEventListener('change',e=>{day().departure=e.target.value;markDirty()});
$('editor-inner').addEventListener('click',e=>{const select=e.target.closest('[data-action]');if(select){openModal(select.dataset.action==='pick-origin'?'origin':'destination');return}});
$('btn-add-place').addEventListener('click',()=>{if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return;if(window.YeoSearch)window.YeoSearch.show();else openModal('stop');});
$('stop-view-switch').addEventListener('click',e=>{
 const button=e.target.closest('[data-stop-view]');if(!button)return;
 const next=button.dataset.stopView;if(next!=='list'&&next!=='bag'||next===stopView)return;
 stopView=next;try{localStorage.setItem(STOP_VIEW_KEY,next);}catch{}
 renderEditor();window.TripUX?.render?.();
});
$('stops-list').addEventListener('click',e=>{
 const categoryButton=e.target.closest('[data-cycle-category]');if(categoryButton){const item=day().stops.find(x=>x.id===categoryButton.dataset.cycleCategory);if(!item)return;const kinds=Object.keys(TripMeta.categories),index=kinds.indexOf(TripMeta.infer(item));item.category=kinds[(index+1)%kinds.length];save();renderEditor();renderResult();renderMap();window.MapWorkspace?.refresh?.();return;}
 const bagSearch=e.target.closest('[data-bag-search]');if(bagSearch){if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return;if(window.YeoSearch)window.YeoSearch.show();else openModal('stop');return;}
 const bagApply=e.target.closest('[data-bag-apply]');if(bagApply){day().mode='auto';calculateRoute();return;}
 const bagClear=e.target.closest('[data-bag-clear]');if(bagClear){if(!day().stops.length)return;if(!confirm('담은 장소를 모두 지울까요? 다시 되돌릴 수 없어요.'))return;day().stops=[];markDirty(false);toast('담은 장소를 모두 지웠어요.');return;}
 const pin=e.target.closest('[data-stop-pin]');if(pin){const item=day().stops.find(x=>x.id===pin.dataset.stopPin);if(!item)return;item.locked=!item.locked;markDirty(false);toast(item.locked?'이 방문지의 순서를 고정했어요.':'순서 고정을 해제했어요.');return;}
 const exp=e.target.closest('[data-stop-expand]');if(exp){const id=exp.dataset.stopExpand;if(expandedStops.has(id))expandedStops.delete(id);else expandedStops.add(id);renderEditor();window.TripUX?.render?.();return;}const focus=e.target.closest('[data-stop-focus]');if(focus){window.TripUX?.switchView?.('map');setTimeout(()=>{window.TripApp?.resizeMap?.();focusPlace(focus.dataset.stopFocus)},90);return;}const btn=e.target.closest('button[data-stop-id]');if(!btn)return;const id=btn.dataset.stopId;if(btn.classList.contains('remove-stop')){if(confirm('이 방문지를 일정에서 삭제할까요?'))removeStop(id)}else if(btn.classList.contains('stop-up'))moveStop(id,-1);else if(btn.classList.contains('stop-down'))moveStop(id,1);else if(btn.classList.contains('stop-edit'))openModal('stop',id)});
$('stops-list').addEventListener('change',e=>{const id=e.target.dataset.stopId,d=day(),item=d.stops.find(s=>s.id===id);if(!item)return;if(e.target.classList.contains('stop-category')){item.category=e.target.value;save();renderEditor();renderResult();renderMap();window.MapWorkspace?.refresh?.();return;}if(e.target.classList.contains('stop-transfer')){if(e.target.value==='')return;const target=state.days[Number(e.target.value)];if(!target||target===d)return;if(target.stops.length>=30)return toast('이동할 날짜에는 최대 30곳까지 등록할 수 있습니다.');d.stops=d.stops.filter(x=>x.id!==id);item.locked=false;target.stops.push(item);target.result=null;markDirty(false);toast(`DAY ${Number(e.target.value)+1}로 이동했습니다.`);return;}markDirty()});
$('mode-auto').addEventListener('click',()=>{day().mode='auto';markDirty(false)});
$('mode-manual').addEventListener('click',()=>{day().mode='manual';markDirty(false)});

$('btn-route').addEventListener('click',()=>calculateRoute());

$('btn-reset').addEventListener('click',()=>{if(!confirm('현재 일정 전체를 예시 일정으로 바꾸시겠습니까?'))return;clearTimeout(pendingCalc);state.days=freshDays();state.active=0;refresh();toast('예시 일정을 불러왔습니다.')});
$('btn-export').addEventListener('click',()=>{const snapshot=state.days.map(({result,...rest})=>rest);const blob=new Blob([JSON.stringify({app:'yeohaenggil-v2',days:snapshot},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='여행길-일정백업.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('일정 JSON 파일을 저장했습니다.')});
$('btn-import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async(e)=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1024*200)throw Error('파일 크기가 너무 큽니다.');const obj=JSON.parse(await file.text());if(!validDays(obj.days))throw Error('여행길 일정 형식이 아닙니다.');if(!confirm('현재 일정을 백업 파일로 교체할까요?'))return;state.days=normalizeDays(obj.days);state.active=0;refresh();toast('일정 백업을 불러왔습니다.')}catch(err){toast('불러오기 실패: '+err.message)}finally{e.target.value=''}});
$('modal-close').addEventListener('click',closeModal);$('btn-modal-cancel').addEventListener('click',closeModal);$('btn-modal-save').addEventListener('click',saveModal);$('place-modal').addEventListener('click',e=>{if(e.target===$('place-modal'))closeModal()});
document.querySelectorAll('[data-modal-tab]').forEach(x=>x.addEventListener('click',()=>selectModalTab(x.dataset.modalTab)));
$('btn-search-place').addEventListener('click',()=>{clearTimeout(placeTimer);$('place-query').blur();searchPlaces()});
$('place-query').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();clearTimeout(placeTimer);$('place-query').blur();searchPlaces()}});
$('place-query').addEventListener('compositionstart',()=>{placeComposing=true;clearTimeout(placeTimer);cancelPlaceSearch()});
$('place-query').addEventListener('compositionend',()=>{placeComposing=false;clearTimeout(placeTimer);if($('place-query').value.trim().length>=2)placeTimer=setTimeout(()=>searchPlaces(),130)});
$('place-query').addEventListener('input',e=>{clearTimeout(placeTimer);cancelPlaceSearch();const query=$('place-query').value.trim();if(state.modal)state.modal.searchPendingSelection=Boolean(query);$('btn-modal-save').disabled=Boolean(query);$('place-selected').classList.add('hidden');if(query.length>=2&&!e.isComposing&&!placeComposing)placeTimer=setTimeout(()=>searchPlaces(),210);else{placeResults=[];placeStatus(query.length<2?(query?'두 글자 이상 입력해 주세요.':'장소 이름이나 주소를 입력해 주세요.'):'검색어를 입력하고 있어요…');$('place-results').innerHTML='';$('place-more').classList.add('hidden')}});
$('place-scope').addEventListener('change',()=>{cancelPlaceSearch();const query=$('place-query').value.trim();if(query&&state.modal){state.modal.searchPendingSelection=true;$('btn-modal-save').disabled=true;$('place-selected').classList.add('hidden');}if(query.length>=2)searchPlaces()});
$('place-more').addEventListener('click',()=>searchPlaces(true));
$('place-results').addEventListener('click',e=>{const btn=e.target.closest('[data-place-select]');if(!btn||!state.modal)return;const item=placeResults[Number(btn.dataset.placeSelect)];if(!item)return;setModalCoords(item.lat,item.lng,item.name);$('place-query').blur();state.modal.searchPendingSelection=false;$('btn-modal-save').disabled=false;state.modal.selectedAddress=item.address;state.modal.selectedCategory=TripMeta.infer({categoryName:item.category,name:item.name});$('input-category').value=state.modal.selectedCategory;document.querySelectorAll('.place-hit').forEach((node,i)=>{const selected=i===Number(btn.dataset.placeSelect);node.classList.toggle('is-selected',selected);node.querySelector('[data-place-select]')?.setAttribute('aria-pressed',String(selected));});$('place-selected').classList.remove('hidden');$('place-selected').textContent=`${item.name} 선택됨 · 아래 적용 버튼으로 저장하세요.`; });
$('btn-search-address').addEventListener('click',searchAddress);$('address-query').addEventListener('keydown',e=>{if(e.key==='Enter')searchAddress()});
$('address-results').addEventListener('click',e=>{const btn=e.target.closest('[data-address-index]');if(!btn)return;const item=geocoderResults[Number(btn.dataset.addressIndex)];if(!item)return;setModalCoords(item.lat,item.lng);$('input-name').value=item.address;state.modal.selectedAddress=item.address;state.modal.searchPendingSelection=false;$('btn-modal-save').disabled=false;toast('주소를 선택했습니다.')});
$('btn-pick-map').addEventListener('click',startMapPick);$('btn-pick-map-primary').addEventListener('click',startMapPick);$('btn-cancel-map-pick').addEventListener('click',cancelMapPick);
$('input-lat').addEventListener('input',()=>{if(state.modal){const v=Number($('input-lat').value);state.modal.lat=$('input-lat').value.trim()===''?null:v;updateCoordLabel()}});
$('input-lng').addEventListener('input',()=>{if(state.modal){const v=Number($('input-lng').value);state.modal.lng=$('input-lng').value.trim()===''?null:v;updateCoordLabel()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.mapPicking)cancelMapPick();else if(!$('place-modal').classList.contains('hidden'))closeModal()}});
window.visualViewport?.addEventListener('resize',syncModalViewport);window.visualViewport?.addEventListener('scroll',syncModalViewport);window.addEventListener('resize',syncModalViewport);
async function boot(){refresh({mapView:false});try{const r=await fetch('/api/config'),c=await r.json();$('api-indicator').textContent=c.directionsReady?'도로 경로 확인 가능':'도로 경로 확인 필요';$('api-indicator').className='api-indicator '+(c.directionsReady?'ready':'not-ready');bootNaverMap(c.mapsKeyId)}catch{$('api-indicator').textContent='연결 상태 확인 중';$('api-indicator').className='api-indicator not-ready'}}
window.TripApp = Object.freeze({
 getDays:()=>state.days, getDay:day, getActive:()=>state.active,validateDays:validDays,
 restoreGuestDays(){const days=loadDays();clearTimeout(pendingCalc);state.days=days;state.active=0;refresh();},
 newTrip(){const region=currentRegion();state.days=freshDays();state.days[0].region=region;state.active=0;refresh();},

 insertStopBetween(index,place){
  const d=day(),entries=d.result?.entries;if(!Array.isArray(entries)||index<1||index>=entries.length||d.stops.length>=30||!validPlace(place))return false;
  const prev=entries[index-1].place,next=entries[index].place;
  const arranged=d.result.orderIds.map(id=>d.stops.find(x=>x.id===id)).filter(Boolean);
  const position=prev.id===d.origin.id?0:arranged.findIndex(x=>x.id===prev.id)+1;
  if(position<0||position>arranged.length)return false;
  const item={id:uid(),name:place.name,lat:Number(place.lat),lng:Number(place.lng),category:TripMeta.infer(place),address:place.address||'',locked:false};
  arranged.splice(position,0,item);d.stops=arranged;d.mode='manual';markDirty(false);return true;
 },
 setActive(index){if(!Number.isInteger(index)||index<0||index>=state.days.length)return;clearTimeout(pendingCalc);state.active=index;mapFitQueued=true;selectedMapStop=null;refresh()},
 importDays(days){if(!validDays(days))return false;clearTimeout(pendingCalc);state.days=normalizeDays(days);state.active=0;refresh();return true},
 refresh, calculateRoute, openModal, toast, markDirty,
 resizeMap:()=>resizeMapStable({fit:mapFitQueued}),refreshMap:renderMap,getMap:()=>map,fitMap,focusPlace,setMapLocked,
 centerMapAtRegion,getMapDiagnostics:()=>({created:mapCreateCount,resizes:mapResizeCount,overlays:overlayRenderCount,ready:!!map,visible:mapHasArea()}),getRegion:currentRegion,setRegion,addQuickStop,previewPlace,clearPlacePreview,
});
boot();
