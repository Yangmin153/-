'use strict';
// 여행길 v2: 프레임워크 없이 실행되는 모바일 우선 UI.
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,9)}`);
const clone = (x) => structuredClone(x);
const STORAGE_KEY = 'yeohaenggil.v2.days';
const p = (name,lat,lng,stayMinutes=0) => ({id:uid(),name,lat,lng,stayMinutes,locked:false});
const EXAMPLES = [
  ['제주국제공항',33.5104,126.4913],['서귀포 예시 숙소',33.2539,126.5594],
  ['성산일출봉 부근',33.4581,126.9424],['섭지코지 부근',33.4236,126.9303],
  ['협재해수욕장 부근',33.3940,126.2396],['오설록 부근',33.3059,126.2895],
  ['애월 부근',33.4628,126.3092],['비자림 부근',33.4890,126.8096],
  ['함덕해수욕장 부근',33.5431,126.6697]
];
function freshDays(){
  const airport=p('제주국제공항 (예시 위치)',33.5104,126.4913);
  const hotel=p('서귀포 숙소 (예시 위치)',33.2539,126.5594);
  return [{id:uid(),origin:airport,destination:clone(hotel),departure:'09:30',mode:'auto',stops:[p('애월 부근',33.4628,126.3092,60),p('협재해수욕장 부근',33.3940,126.2396,75),p('오설록 부근',33.3059,126.2895,60)],result:null},
          {id:uid(),origin:clone(hotel),destination:p('제주공항 (예시 위치)',33.5104,126.4913),departure:'09:00',mode:'auto',stops:[p('성산일출봉 부근',33.4581,126.9424,85),p('섭지코지 부근',33.4236,126.9303,60)],result:null}];
}
function validPlace(q){return q&&typeof q.name==='string'&&q.name.length<=100&&Number.isFinite(Number(q.lat))&&Number.isFinite(Number(q.lng))&&Math.abs(Number(q.lat))<=90&&Math.abs(Number(q.lng))<=180}
function validDays(d){return Array.isArray(d)&&d.length>0&&d.length<=10&&d.every(day=>day&&validPlace(day.origin)&&validPlace(day.destination)&&Array.isArray(day.stops)&&day.stops.length<=12&&day.stops.every(validPlace)&&/^\d{2}:\d{2}$/.test(day.departure)&&['auto','manual'].includes(day.mode))}
function loadDays(){try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));if(validDays(saved))return saved.map(d=>({...d,result:null}))}catch{}return freshDays()}
const state={days:loadDays(),active:0,loading:false,modal:null,mapPicking:false,hadResult:{}};
let map=null, markers=[],paths=[],geocoderResults=[],pendingCalc=null,toastTimer=null,drag=null;
const day=()=>state.days[state.active];
const coordLabel=(x)=>`${Number(x.lat).toFixed(5)}, ${Number(x.lng).toFixed(5)}`;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300)}
function save(){const snapshot=state.days.map(({result,...rest})=>rest);localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot))}
function refresh({mapView=true}={}){renderTabs();renderEditor();renderResult();if(mapView)renderMap();save()}
function renderTabs(){const el=$('day-tabs');el.innerHTML=state.days.map((d,i)=>`<button class="day-tab ${i===state.active?'active':''}" role="tab" aria-selected="${i===state.active}" data-day="${i}">DAY ${i+1}</button>`).join('')+(state.days.length<10?'<button class="day-add" id="day-add" title="날짜 추가" aria-label="여행 날짜 추가">+</button>':'');}
function renderEditor(){const d=day();$('day-heading').textContent=`${state.active+1}일 차 일정`;$('day-caption').textContent='날짜마다 출발지와 도착지를 다르게 지정할 수 있어요.';
  $('btn-delete-day').disabled=state.days.length===1;$('origin-name').textContent=d.origin.name;$('origin-coord').textContent=coordLabel(d.origin);$('destination-name').textContent=d.destination.name;$('destination-coord').textContent=coordLabel(d.destination);
  $('departure').value=d.departure;$('place-count').textContent=d.stops.length;$('stops-empty').classList.toggle('hidden',d.stops.length!==0);
  $('mode-auto').classList.toggle('is-selected',d.mode==='auto');$('mode-manual').classList.toggle('is-selected',d.mode==='manual');$('btn-route').disabled=state.loading;
  $('btn-route').classList.toggle('is-busy',state.loading);$('btn-route').querySelector('span').textContent=state.loading?'경로 계산 중…':d.mode==='auto'?'최적 동선 계산하기':'이 순서대로 경로 계산';
  $('stops-list').innerHTML=d.stops.map((stop,i)=>`<div class="stop-card" data-stop-id="${esc(stop.id)}"><span class="drag-handle" role="button" tabindex="0" aria-label="${esc(stop.name)} 이동, 방향키 또는 아래 위 버튼 이용" title="드래그해서 이동">⠿</span><span class="stop-num">${i+1}</span><div class="stop-info"><strong title="${esc(stop.name)}">${esc(stop.name)}</strong><div class="stop-meta"><select class="stop-stay" data-stop-id="${esc(stop.id)}" aria-label="${esc(stop.name)} 체류시간">${[0,20,30,40,60,75,90,120,150,180,240,300].concat([stop.stayMinutes]).filter((v,i,arr)=>arr.indexOf(v)===i).sort((a,b)=>a-b).map(v=>`<option value="${v}" ${v===stop.stayMinutes?'selected':''}>${v}분 체류</option>`).join('')}</select><label title="자동 최적화할 때 이 위치를 고정합니다"><input type="checkbox" class="stop-locked" data-stop-id="${esc(stop.id)}" ${stop.locked?'checked':''}>위치 고정</label></div></div><div class="stop-actions"><button class="stop-edit" data-stop-id="${esc(stop.id)}" title="장소 수정">✎</button><button class="stop-up" data-stop-id="${esc(stop.id)}" title="위로 이동" ${i===0?'disabled':''}>↑</button><button class="stop-down" data-stop-id="${esc(stop.id)}" title="아래로 이동" ${i===d.stops.length-1?'disabled':''}>↓</button><button class="remove-stop" data-stop-id="${esc(stop.id)}" title="삭제">×</button></div></div>`).join('');
}
function renderResult(){const d=day(),r=d.result;$('metric-places').textContent=d.stops.length;$('result-alert').classList.add('hidden');$('map-caption').textContent=`DAY ${state.active+1} · ${d.origin.name} → ${d.destination.name}`;
 if(!r){$('metric-drive').textContent='—';$('metric-distance').textContent='—';$('result-status').textContent='계산 전';$('result-status').className='result-status';$('timeline-note').textContent='순서 편집 후 경로를 계산하세요';$('timeline').innerHTML='<div class="blank-timeline">장소를 추가하거나 순서를 변경했다면<br><strong>경로 계산 버튼</strong>을 눌러주세요.</div>';return;}
 $('metric-drive').textContent=Math.round(r.drivingMinutes);$('metric-distance').textContent=(r.totalDistanceMeters/1000).toFixed(1);
 const isExact=r.status==='road_exact';const estimated=['estimated','mixed','road_partial'].includes(r.status);
 $('result-status').textContent=isExact?'도로시간 최적화':estimated?'추정 구간 포함':r.status==='road_partial'?'도로 비교 일부 추정':r.status==='road_order'?'도로경로 확인':'경로 계산됨';$('result-status').className='result-status '+(estimated?'warning':'done');
 $('timeline-note').textContent=`체류 ${Math.round(r.stayMinutes)}분 · 총 ${Math.round(r.totalMinutes)}분`;
 if(r.warnings?.length){$('result-alert').classList.remove('hidden');$('result-alert').textContent=r.warnings.join(' ')}
 $('timeline').innerHTML=r.entries.map((e,i)=>{const leg=e.leg;const legline=leg?`이전 장소에서 자동차 ${Math.round(leg.durationMinutes)}분 · ${(leg.distanceMeters/1000).toFixed(1)}km${leg.source==='estimate'?'<span class="estimated">추정</span>':''}`:'여행 시작';const ext=e.kind==='stop'?` · 체류 ${e.place.stayMinutes}분`:(e.kind==='destination'?' · 오늘의 마지막 목적지':'');return `<div class="timeline-entry"><div class="timeline-hour">${esc(e.arrival)}</div><div class="timeline-rail"><span class="timeline-dot">${e.kind==='origin'?'S':e.kind==='destination'?'E':i}</span></div><div class="timeline-info"><strong>${esc(e.place.name)}</strong><p>${legline}${ext}</p></div></div>`}).join('');
}
function markDirty(shouldRecalculate=true){const d=day();const had=!!d.result;d.result=null;refresh();if(had&&shouldRecalculate){clearTimeout(pendingCalc);pendingCalc=setTimeout(()=>calculateRoute(false),650)}}
function addDay(){if(state.days.length>=10)return toast('최대 10일까지 설정할 수 있습니다.');clearTimeout(pendingCalc);const prev=state.days[state.days.length-1];const origin=clone(prev.destination);origin.id=uid();const dest=clone(prev.destination);dest.id=uid();state.days.push({id:uid(),origin,destination:dest,departure:'09:00',mode:'auto',stops:[],result:null});state.active=state.days.length-1;refresh();toast('새로운 날짜를 추가했습니다. 전날 도착지를 출발지로 사용합니다.')}
function deleteDay(){if(state.days.length<=1)return;if(!confirm(`${state.active+1}일 차 일정을 삭제하시겠습니까?`))return;clearTimeout(pendingCalc);state.days.splice(state.active,1);state.active=Math.min(state.active,state.days.length-1);refresh()}
function moveStop(id,delta){const d=day();const ix=d.stops.findIndex(s=>s.id===id),to=ix+delta;if(ix<0||to<0||to>=d.stops.length)return;[d.stops[ix],d.stops[to]]=[d.stops[to],d.stops[ix]];d.mode='manual';markDirty()}
function removeStop(id){const d=day();d.stops=d.stops.filter(s=>s.id!==id);markDirty();toast('장소를 일정에서 삭제했습니다.')}
async function calculateRoute(explicit=true){const d=day();if(state.loading){if(explicit)toast('이미 경로를 계산하고 있습니다.');return;}clearTimeout(pendingCalc);if(!d.origin||!d.destination)return toast('출발지와 도착지를 지정해 주세요.');
 state.loading=true;renderEditor();const dayId=d.id;const body={origin:d.origin,destination:d.destination,stops:d.stops,departure:d.departure,mode:d.mode};const token=JSON.stringify(body);
 try{const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:token});if(!response.ok){const detail=await response.json().catch(()=>null);throw new Error(detail?.detail ? JSON.stringify(detail.detail):`서버 오류 ${response.status}`)}const result=await response.json();
   const dest=state.days.find(x=>x.id===dayId);if(dest && JSON.stringify({origin:dest.origin,destination:dest.destination,stops:dest.stops,departure:dest.departure,mode:dest.mode})===token){
    if(dest.mode==='auto'){const byId=new Map(dest.stops.map(s=>[s.id,s]));dest.stops=result.orderIds.map(id=>byId.get(id)).filter(Boolean)}
    dest.result=result;if(result.status==='estimated')toast('네이버 도로 경로가 아닌 추정 결과입니다. API 설정을 확인하세요.');else if(result.status==='mixed')toast('일부 구간은 추정치입니다. 하단 안내를 확인하세요.');else if(explicit)toast('경로 계산을 완료했습니다.');
   }else{toast('일정이 변경돼 이전 계산 결과는 적용하지 않았습니다.')}
 }catch(err){toast(`경로 계산 실패: ${err.message}`)}finally{state.loading=false;refresh()}
}
// — 장소 편집 / 지도 클릭 —
function openModal(kind,id=null){const d=day();const existing=kind==='origin'?d.origin:kind==='destination'?d.destination:d.stops.find(s=>s.id===id);
 state.modal={kind,id,lat:existing?.lat??null,lng:existing?.lng??null};$('modal-heading').textContent=kind==='origin'?'출발지 변경':kind==='destination'?'도착지 변경':id?'관광지 수정':'관광지 추가';
 $('input-name').value=existing?.name||'';$('input-stay').value=existing?.stayMinutes??60;$('stay-field').classList.toggle('hidden',kind!=='stop');$('address-query').value='';$('address-results').innerHTML='';$('input-lat').value=existing?.lat??'';$('input-lng').value=existing?.lng??'';selectModalTab('address');updateCoordLabel();$('place-modal').classList.remove('hidden');$('place-modal').setAttribute('aria-hidden','false');setTimeout(()=>$('input-name').focus(),40)
}
function closeModal(){if(state.mapPicking)return;state.modal=null;$('place-modal').classList.add('hidden');$('place-modal').setAttribute('aria-hidden','true')}
function selectModalTab(t){document.querySelectorAll('[data-modal-tab]').forEach(el=>el.classList.toggle('active',el.dataset.modalTab===t));['address','coordinate','example'].forEach(k=>$(`modal-${k}`).classList.toggle('hidden',k!==t));}
function updateCoordLabel(){const m=state.modal;$('selected-coord').textContent=m&&Number.isFinite(m.lat)&&Number.isFinite(m.lng)?`선택된 좌표: ${m.lat.toFixed(6)}, ${m.lng.toFixed(6)}`:'위치를 아직 선택하지 않았습니다.'}
function setModalCoords(lat,lng,name){if(!state.modal)return;state.modal.lat=Number(lat);state.modal.lng=Number(lng);$('input-lat').value=lat;$('input-lng').value=lng;if(name)$('input-name').value=name;updateCoordLabel()}
function saveModal(){if(!state.modal)return;const {kind,id}=state.modal;const name=$('input-name').value.trim();let lat=Number($('input-lat').value),lng=Number($('input-lng').value);if($('input-lat').value.trim()===''||$('input-lng').value.trim()===''){lat=state.modal.lat;lng=state.modal.lng}
 if(!name||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return toast('장소 이름과 올바른 위도·경도를 입력해 주세요.');const stay=Number($('input-stay').value);if(kind==='stop'&&(!Number.isInteger(stay)||stay<0||stay>720))return toast('체류시간은 0~720분으로 입력하세요.');
 const d=day();const oldDestination=clone(d.destination);const place={id:id||uid(),name,lat,lng,stayMinutes:kind==='stop'?stay:0,locked:false};
 if(kind==='origin'){place.id=d.origin.id;d.origin=place}else if(kind==='destination'){place.id=d.destination.id;d.destination=place;const nextDay=state.days[state.active+1];if(nextDay && nextDay.origin.name===oldDestination.name && nextDay.origin.lat===oldDestination.lat && nextDay.origin.lng===oldDestination.lng){nextDay.origin={...clone(place),id:nextDay.origin.id};nextDay.result=null}}else if(id){const ix=d.stops.findIndex(s=>s.id===id);if(ix===-1)return toast('수정할 관광지를 찾지 못했습니다.');place.locked=d.stops[ix].locked;d.stops[ix]=place}else{if(d.stops.length>=12)return toast('한 날짜에 관광지는 최대 12곳까지 추가할 수 있습니다.');d.stops.push(place)}
 state.modal=null;$('place-modal').classList.add('hidden');$('place-modal').setAttribute('aria-hidden','true');markDirty();toast('일정에 장소를 반영했습니다.')
}
async function searchAddress(){const query=$('address-query').value.trim();if(query.length<2)return toast('검색할 도로명·지번 주소를 입력해 주세요.');$('address-results').textContent='주소 검색 중…';
 try{const r=await fetch(`/api/geocode?q=${encodeURIComponent(query)}`),data=await r.json();if(!r.ok)throw new Error(data?.detail||'검색 실패');geocoderResults=data.results||[];const el=$('address-results');el.innerHTML=geocoderResults.length?geocoderResults.map((x,i)=>`<button class="address-result" data-address-index="${i}">${esc(x.address)} <span>↗</span></button>`).join(''):'검색 결과가 없습니다. 정확한 주소로 다시 검색하거나 지도에서 위치를 선택하세요.'}
 catch(err){$('address-results').textContent=`주소 검색 불가: ${err.message}`}
}
function startMapPick(){if(!map){toast('네이버 지도 연결 후 사용 가능합니다. 대신 좌표를 직접 입력할 수 있습니다.');selectModalTab('coordinate');return}state.mapPicking=true;$('place-modal').classList.add('hidden');$('place-modal').setAttribute('aria-hidden','true');$('map-select-notice').classList.remove('hidden');$('map-region').scrollIntoView({behavior:'smooth',block:'center'});toast('지도 위 원하는 위치를 눌러 선택하세요.')}
function cancelMapPick(){state.mapPicking=false;$('map-select-notice').classList.add('hidden');if(state.modal){$('place-modal').classList.remove('hidden');$('place-modal').setAttribute('aria-hidden','false')}}
// — 지도 —
function bootNaverMap(key){if(!key){$('map-placeholder').classList.remove('hidden');return}window.navermap_authFailure=()=>{toast('네이버 지도 인증 실패: 웹 서비스 URL과 Client ID를 확인하세요.');$('map-placeholder').classList.remove('hidden')};
 const script=document.createElement('script');script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(key)}`;script.async=true;script.onload=()=>{if(!window.naver?.maps){toast('네이버 지도 스크립트를 불러오지 못했습니다.');return}try{map=new naver.maps.Map('map',{center:new naver.maps.LatLng(33.39,126.55),zoom:10,minZoom:6,zoomControl:true,zoomControlOptions:{position:naver.maps.Position.TOP_RIGHT}});$('map-placeholder').classList.add('hidden');naver.maps.Event.addListener(map,'click',evt=>{if(!state.mapPicking||!state.modal)return;setModalCoords(evt.coord.lat(),evt.coord.lng());state.mapPicking=false;$('map-select-notice').classList.add('hidden');selectModalTab('coordinate');$('place-modal').classList.remove('hidden');$('place-modal').setAttribute('aria-hidden','false');toast('좌표를 선택했습니다. 장소 이름을 확인한 뒤 적용하세요.')});renderMap()}catch(e){toast(`지도 생성 실패: ${e.message}`)}};script.onerror=()=>toast('네이버 지도 스크립트 로드 실패. Client ID를 확인하세요.');document.head.appendChild(script)
}
function clearMap(){markers.forEach(x=>x.setMap(null));paths.forEach(x=>x.setMap(null));markers=[];paths=[]}
function fitMap(){if(!map)return;const d=day(),places=[d.origin,...d.stops,d.destination];const bounds=new naver.maps.LatLngBounds();places.forEach(q=>bounds.extend(new naver.maps.LatLng(q.lat,q.lng)));map.fitBounds(bounds,{top:65,right:60,bottom:65,left:60})}
function renderMap(){if(!map)return;clearMap();const d=day();const r=d.result;let renderOrder=d.stops;if(r?.orderIds){const byId=new Map(d.stops.map(x=>[x.id,x]));renderOrder=r.orderIds.map(x=>byId.get(x)).filter(Boolean)}const places=[d.origin,...renderOrder,d.destination];
 places.forEach((q,i)=>{const start=i===0,end=i===places.length-1;const bg=start?'#0f7668':end?'#e8874e':'#fff',textcolor=(start||end)?'#fff':'#126959';const icon=`<div style="min-width:30px;height:30px;padding:0 6px;border-radius:13px 13px 13px 3px;box-shadow:0 3px 13px #0002;display:flex;align-items:center;justify-content:center;border:2px solid #fff;background:${bg};color:${textcolor};font-size:11px;font-weight:900">${start?'S':end?'E':i}</div>`;markers.push(new naver.maps.Marker({position:new naver.maps.LatLng(q.lat,q.lng),map,icon:{content:icon,anchor:new naver.maps.Point(16,32)},title:q.name}))});
 if(r?.entries){r.entries.slice(1).forEach((entry,index)=>{const leg=entry.leg;if(!leg||!Array.isArray(leg.path))return;const path=leg.path.map(pair=>new naver.maps.LatLng(pair[1],pair[0]));paths.push(new naver.maps.Polyline({map,path,strokeColor:leg.source==='estimate'?'#db9c5e':'#138374',strokeWeight:5,strokeOpacity:.82,strokeStyle:leg.source==='estimate'?'shortdash':'solid'}))})}else{paths.push(new naver.maps.Polyline({map,path:places.map(q=>new naver.maps.LatLng(q.lat,q.lng)),strokeColor:'#9cc0b6',strokeOpacity:.75,strokeWeight:3,strokeStyle:'shortdash'}))}
 fitMap();
}
// — 이벤트 —
$('day-tabs').addEventListener('click',e=>{const btn=e.target.closest('[data-day]');if(btn){clearTimeout(pendingCalc);state.active=Number(btn.dataset.day);refresh();return}if(e.target.closest('#day-add'))addDay()});
$('btn-delete-day').addEventListener('click',deleteDay);
$('departure').addEventListener('change',e=>{day().departure=e.target.value;markDirty()});
$('editor-inner').addEventListener('click',e=>{const select=e.target.closest('[data-action]');if(select){openModal(select.dataset.action==='pick-origin'?'origin':'destination');return}});
$('btn-add-place').addEventListener('click',()=>openModal('stop'));
$('stops-list').addEventListener('click',e=>{const btn=e.target.closest('button[data-stop-id]');if(!btn)return;const id=btn.dataset.stopId;if(btn.classList.contains('remove-stop'))removeStop(id);else if(btn.classList.contains('stop-up'))moveStop(id,-1);else if(btn.classList.contains('stop-down'))moveStop(id,1);else if(btn.classList.contains('stop-edit'))openModal('stop',id)});
$('stops-list').addEventListener('change',e=>{const id=e.target.dataset.stopId,d=day(),item=d.stops.find(s=>s.id===id);if(!item)return;if(e.target.classList.contains('stop-stay'))item.stayMinutes=Number(e.target.value);else if(e.target.classList.contains('stop-locked'))item.locked=e.target.checked;markDirty()});
$('mode-auto').addEventListener('click',()=>{day().mode='auto';markDirty(false)});
$('mode-manual').addEventListener('click',()=>{day().mode='manual';markDirty(false)});
$('btn-route').addEventListener('click',()=>calculateRoute());
$('btn-map-fit').addEventListener('click',fitMap);
$('btn-reset').addEventListener('click',()=>{if(!confirm('현재 일정 전체를 예시 일정으로 바꾸시겠습니까?'))return;clearTimeout(pendingCalc);state.days=freshDays();state.active=0;refresh();toast('예시 일정을 불러왔습니다.')});
$('btn-export').addEventListener('click',()=>{const snapshot=state.days.map(({result,...rest})=>rest);const blob=new Blob([JSON.stringify({app:'yeohaenggil-v2',days:snapshot},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='여행길-일정백업.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('일정 JSON 파일을 저장했습니다.')});
$('btn-import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async(e)=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1024*200)throw Error('파일 크기가 너무 큽니다.');const obj=JSON.parse(await file.text());if(!validDays(obj.days))throw Error('여행길 일정 형식이 아닙니다.');if(!confirm('현재 일정을 백업 파일로 교체할까요?'))return;state.days=obj.days.map(x=>({...x,result:null}));state.active=0;refresh();toast('일정 백업을 불러왔습니다.')}catch(err){toast('불러오기 실패: '+err.message)}finally{e.target.value=''}});
$('modal-close').addEventListener('click',closeModal);$('btn-modal-cancel').addEventListener('click',closeModal);$('btn-modal-save').addEventListener('click',saveModal);$('place-modal').addEventListener('click',e=>{if(e.target===$('place-modal'))closeModal()});
document.querySelectorAll('[data-modal-tab]').forEach(x=>x.addEventListener('click',()=>selectModalTab(x.dataset.modalTab)));
$('btn-search-address').addEventListener('click',searchAddress);$('address-query').addEventListener('keydown',e=>{if(e.key==='Enter')searchAddress()});
$('address-results').addEventListener('click',e=>{const btn=e.target.closest('[data-address-index]');if(!btn)return;const item=geocoderResults[Number(btn.dataset.addressIndex)];if(!item)return;setModalCoords(item.lat,item.lng);if(!$('input-name').value.trim())$('input-name').value=item.address;toast('주소 좌표를 선택했습니다.')});
$('btn-pick-map').addEventListener('click',startMapPick);$('btn-pick-map-2').addEventListener('click',startMapPick);$('btn-cancel-map-pick').addEventListener('click',cancelMapPick);
$('input-lat').addEventListener('input',()=>{if(state.modal){const v=Number($('input-lat').value);state.modal.lat=$('input-lat').value.trim()===''?null:v;updateCoordLabel()}});
$('input-lng').addEventListener('input',()=>{if(state.modal){const v=Number($('input-lng').value);state.modal.lng=$('input-lng').value.trim()===''?null:v;updateCoordLabel()}});
$('preset-list').innerHTML=EXAMPLES.map((row,i)=>`<button data-preset="${i}">${esc(row[0])} ↗</button>`).join('');
$('preset-list').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(!b)return;const [name,lat,lng]=EXAMPLES[Number(b.dataset.preset)];setModalCoords(lat,lng,name);toast('예시 위치를 적용했습니다. 실제 입구 좌표는 확인해 주세요.')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(state.mapPicking)cancelMapPick();else if(!$('place-modal').classList.contains('hidden'))closeModal()}});
// 데스크톱 마우스와 모바일 터치에 공통으로 동작하는 Pointer Events 드래그 정렬.
$('stops-list').addEventListener('pointerdown',e=>{const handle=e.target.closest('.drag-handle');if(!handle||e.button!==0)return;const node=handle.closest('.stop-card');drag={handle,node,startY:e.clientY,moved:false};try{handle.setPointerCapture(e.pointerId)}catch{}e.preventDefault()});
$('stops-list').addEventListener('pointermove',e=>{if(!drag)return;if(Math.abs(e.clientY-drag.startY)>6){drag.moved=true;drag.node.classList.add('dragging')}if(!drag.moved)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.stop-card');if(!target||target===drag.node||target.parentElement!==$('stops-list'))return;const rect=target.getBoundingClientRect();if(e.clientY<rect.top+rect.height/2)target.before(drag.node);else target.after(drag.node)});
function endDrag(){if(!drag)return;const moved=drag.moved;drag.node.classList.remove('dragging');drag=null;if(!moved)return;const ids=[...$('stops-list').querySelectorAll('.stop-card')].map(x=>x.dataset.stopId);const byId=new Map(day().stops.map(x=>[x.id,x]));if(ids.length!==byId.size)return;day().stops=ids.map(id=>byId.get(id));day().mode='manual';markDirty();toast('방문 순서를 수정했습니다. 내 순서 유지로 전환했습니다.')}
$('stops-list').addEventListener('pointerup',endDrag);$('stops-list').addEventListener('pointercancel',endDrag);
$('stops-list').addEventListener('keydown',e=>{if(!e.target.classList.contains('drag-handle'))return;const id=e.target.closest('.stop-card')?.dataset.stopId;if(e.key==='ArrowUp'){e.preventDefault();moveStop(id,-1)}if(e.key==='ArrowDown'){e.preventDefault();moveStop(id,1)}});
async function boot(){refresh({mapView:false});try{const r=await fetch('/api/config'),c=await r.json();$('api-indicator').textContent=c.directionsReady?'네이버 경로 API 연결 설정됨':'API 키 미설정 · 추정 모드';$('api-indicator').className='api-indicator '+(c.directionsReady?'ready':'not-ready');bootNaverMap(c.mapsKeyId)}catch{$('api-indicator').textContent='서버 연결 확인 필요';$('api-indicator').className='api-indicator not-ready'}}
boot();
