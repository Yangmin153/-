'use strict';

const SAMPLE = [
  {id:'sample-woojin',name:'우진해장국',lat:33.5114,lng:126.5202,category:'식당',stay:60},
  {id:'sample-aewol',name:'애월 카페거리',lat:33.4629,lng:126.3089,category:'카페',stay:75},
  {id:'sample-hyeopjae',name:'협재해수욕장',lat:33.3935,lng:126.2396,category:'관광지',stay:75},
  {id:'sample-osulloc',name:'오설록 티뮤지엄',lat:33.3059,lng:126.2895,category:'관광지',stay:80},
  {id:'sample-olle',name:'서귀포 매일올레시장',lat:33.2490,lng:126.5637,category:'시장',stay:65},
  {id:'sample-seongsan',name:'성산일출봉',lat:33.4581,lng:126.9425,category:'관광지',stay:95},
  {id:'sample-seopji',name:'섭지코지',lat:33.4239,lng:126.9307,category:'관광지',stay:60},
  {id:'sample-hamdeok',name:'함덕해수욕장',lat:33.5432,lng:126.6693,category:'관광지',stay:60}
];
const startSample = {id:'origin-airport',name:'제주국제공항',lat:33.5104,lng:126.4914,category:'출발지',stay:0};
const hotelSample = {id:'stay-jungmun',name:'중문관광단지',lat:33.2493,lng:126.4118,category:'숙소',stay:0};
const state = {
  places:SAMPLE.map(p=>({...p})), origin:{...startSample}, lodging:{...hotelSample},
  config:null, map:null, markers:[], lines:[], infoWindow:null, lastPlan:null,
  modalTarget:'place', mapPick:false, searchAbort:null, searchTimer:null, requestId:0, toastTimer:null,
};
const el = id => document.getElementById(id);

function toast(message){
  const node=el('toast');node.textContent=message;node.classList.add('visible');
  if(state.toastTimer) clearTimeout(state.toastTimer);
  state.toastTimer=setTimeout(()=>node.classList.remove('visible'),3200);
}
function node(tag,attrs={},text){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs)) {
    if(k==='class') n.className=v;
    else if(k==='type') n.type=v;
    else n.setAttribute(k,v);
  }
  if(text!==undefined)n.textContent=text;
  return n;
}
function stripHTML(s){
  return String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}
function uniqueId(p){return `${p.name}|${Number(p.lat).toFixed(5)}|${Number(p.lng).toFixed(5)}`;}
function safeCoord(x,axis){
  const f=Number(x);if(!Number.isFinite(f))return null;
  const v=Math.abs(f)>1000?f/10000000:f;
  if(axis==='lat')return v>=32&&v<=39?v:null;
  return v>=124&&v<=132?v:null;
}
function count(){return state.places.length;}
function editStay(index,delta){
  const p=state.places[index];if(!p)return;
  p.stay=Math.max(10,Math.min(360,p.stay+delta));renderPlaces();invalidatePlan();
}
function invalidatePlan(){
  if(!state.lastPlan)return;
  state.lastPlan=null;el('copyButton').disabled=true;
  el('routeStatus').className='route-status warn';
  el('routeStatus').textContent='장소 또는 여행 조건이 바뀌었습니다. 아래 버튼을 눌러 동선을 다시 만들어주세요.';
  el('dayOutput').replaceChildren();el('statDistance').textContent='—';el('statTime').textContent='—';
  renderMap();
}
function addPlace(p){
  if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng))return toast('좌표가 확인된 장소만 추가할 수 있습니다.');
  if(state.places.some(x=>uniqueId(x)===uniqueId(p)))return toast('이미 추가한 장소입니다.');
  if(count()>=15)return toast('방문 장소는 최대 15곳까지 선택할 수 있습니다.');
  state.places.push({...p,stay:p.stay||60});
  renderPlaces();renderMap();invalidatePlan();toast(`${p.name} 추가 완료`);
}
function renderPlaces(){
  const list=el('places');list.replaceChildren();
  if(!count())list.append(node('p',{class:'empty-search'},'추가한 장소가 없습니다. 검색해서 장소를 담아주세요.'));
  state.places.forEach((place,i)=>{
    const card=node('div',{class:'place-card'});
    card.append(node('span',{class:'place-order'},String(i+1)));
    const info=node('div',{class:'place-info'});
    info.append(node('strong',{},place.name),node('small',{},place.category||'방문 장소'));
    card.append(info);
    const dwell=node('div',{class:'dwell'});
    const minus=node('button',{type:'button','aria-label':`${place.name} 체류시간 10분 줄이기`},'−');
    const plus=node('button',{type:'button','aria-label':`${place.name} 체류시간 10분 늘리기`},'+');
    minus.addEventListener('click',()=>editStay(i,-10));plus.addEventListener('click',()=>editStay(i,10));
    dwell.append(minus,node('span',{},`${place.stay}분`),plus);
    const remove=node('button',{type:'button',class:'remove-place','aria-label':`${place.name} 제거`},'×');
    remove.addEventListener('click',()=>{state.places.splice(i,1);renderPlaces();renderMap();invalidatePlan();});
    card.append(dwell,remove);list.append(card);
  });
  el('placeCount').textContent=`${count()}곳`;
  el('stickyCount').textContent=String(count());
  el('statPlaces').innerHTML='';
  el('statPlaces').append(document.createTextNode(count()),node('small',{},'곳'));
}
function openSearch(target='place',term=''){
  state.modalTarget=target;
  el('searchPurpose').textContent=target==='place'?'ADD PLACES':'CHANGE LOCATION';
  el('searchTitle').textContent=target==='origin'?'출발 장소 찾기':target==='lodging'?'숙소 위치 찾기':'어디로 떠나고 싶으세요?';
  el('searchModal').hidden=false;el('searchBackdrop').hidden=false;
  document.body.style.overflow='hidden';
  el('searchInput').value=term;
  el('searchResults').replaceChildren(node('p',{class:'empty-search'},'장소명을 검색하세요. 네이버 검색 결과가 표시됩니다.'));
  window.setTimeout(()=>{el('searchInput').focus();if(term)performSearch();},50);
}
function closeSearch(){
  if(state.searchAbort){state.searchAbort.abort();state.searchAbort=null;}
  clearTimeout(state.searchTimer);el('searchModal').hidden=true;el('searchBackdrop').hidden=true;
  document.body.style.overflow='';
}
function externalNaverUrl(place){
  if(/^https:\/\//i.test(place.link||''))return place.link;
  return `https://map.naver.com/p/search/${encodeURIComponent(stripHTML(place.title||place.name))}`;
}
function naverResultToPoint(p){
  const lng=safeCoord(p.mapx,'lng'), lat=safeCoord(p.mapy,'lat');
  if(lng===null||lat===null)return null;
  return {id:`naver-${String(p.mapx)}-${String(p.mapy)}-${stripHTML(p.title)}`,name:stripHTML(p.title),
    category:String(p.category||'방문 장소'),lat,lng,stay:60};
}
async function performSearch(){
  const q=el('searchInput').value.trim();
  if(q.length<2){el('searchResults').replaceChildren(node('p',{class:'empty-search'},'검색어를 두 글자 이상 입력하세요.'));return;}
  if(state.searchAbort)state.searchAbort.abort();
  const ctrl=new AbortController();state.searchAbort=ctrl;
  el('searchResults').replaceChildren(node('p',{class:'empty-search'},'네이버에서 검색 중입니다…'));
  try{
    const res=await fetch(`/api/search?q=${encodeURIComponent(q)}`,{signal:ctrl.signal});
    const data=await res.json();
    if(!res.ok)throw new Error(data.detail||'검색에 실패했습니다.');
    if(state.searchAbort!==ctrl)return;
    const results=el('searchResults');results.replaceChildren();
    if(!data.items?.length){results.append(node('p',{class:'empty-search'},'검색 결과가 없습니다. 장소 이름이나 지역명을 바꿔보세요.'));return;}
    // Preserve API item ordering. Show the source and a provider link to each result.
    for(const item of data.items){
      const row=node('div',{class:'search-result'}),info=node('div',{class:'search-result-data'});
      const naverLink=node('a',{class:'result-link',href:externalNaverUrl(item),target:'_blank',rel:'noopener noreferrer'},'네이버에서 원본 보기 ↗');
      info.append(node('strong',{},stripHTML(item.title)),node('small',{},item.roadAddress||item.address||'주소 없음'),node('small',{},item.category||''),naverLink);
      const point=naverResultToPoint(item);
      const button=node('button',{type:'button',class:'result-add'},'선택');button.disabled=!point;
      if(point)button.addEventListener('click',()=>{
        if(state.modalTarget==='origin'){state.origin={...point,stay:0};el('originName').textContent=point.name;invalidatePlan();renderMap();toast('출발지가 변경되었습니다.');}
        else if(state.modalTarget==='lodging'){state.lodging={...point,stay:0};el('lodgingName').textContent=point.name;invalidatePlan();renderMap();toast('숙소가 변경되었습니다.');}
        else addPlace(point);
        closeSearch();
      });
      row.append(info,button);results.append(row);
    }
  }catch(err){if(err.name==='AbortError')return;el('searchResults').replaceChildren(node('p',{class:'empty-search'},err.message||'검색 서버를 확인해주세요.'));}
}
function chooseMapPick(){
  closeSearch();if(!state.map){toast('네이버 지도를 연결한 뒤 위치를 선택할 수 있습니다.');return;}
  state.mapPick=true;toast('지도에서 원하는 위치를 한 번 눌러주세요.');
  switchTab('map');el('mapPanel').scrollIntoView({behavior:'smooth',block:'center'});
}
function fromMapClick(lat,lng){
  if(!state.mapPick)return;
  state.mapPick=false;
  const label=prompt('장소 이름을 입력하세요.', '지도에서 선택한 장소');
  if(!label||!label.trim()){toast('위치 추가를 취소했습니다.');return;}
  const p={id:`user-${Date.now()}`,name:label.trim().slice(0,120),category:'직접 선택',lat,lng,stay:60};
  if(state.modalTarget==='origin'){state.origin={...p,stay:0};el('originName').textContent=p.name;invalidatePlan();renderMap();}
  else if(state.modalTarget==='lodging'){state.lodging={...p,stay:0};el('lodgingName').textContent=p.name;invalidatePlan();renderMap();}
  else addPlace(p);
}
function switchTab(tab){
  const map=tab==='map';
  el('tabMap').classList.toggle('active',map);el('tabList').classList.toggle('active',!map);
  el('tabMap').setAttribute('aria-selected',String(map));el('tabList').setAttribute('aria-selected',String(!map));
  el('mapPanel').hidden=!map;
  // Keep text itinerary visible in either tab; list view hides only the map to save mobile scrolling.
  if(map&&state.map){requestAnimationFrame(()=>{
    state.map.setSize(new naver.maps.Size(el('map').clientWidth,el('map').clientHeight));fitMap();
  });}
}
function showMapError(text){el('mapFallback').hidden=false;el('mapFallback').querySelector('strong').textContent=text;el('recenterButton').hidden=true;}
async function initMap(config){
  if(!config.naverMapClientId){showMapError('지도 API 키가 설정되지 않았습니다.');return;}
  window.navermap_authFailure=()=>showMapError('지도 인증 실패: 도메인 및 키를 확인하세요.');
  const script=document.createElement('script');
  script.src=`https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(config.naverMapClientId)}`;
  script.async=true;
  script.onerror=()=>showMapError('네이버 지도를 불러오지 못했습니다.');
  script.onload=()=>{
    if(!window.naver?.maps){showMapError('네이버 지도 SDK 초기화 실패');return;}
    const maps=naver.maps;
    state.map=new maps.Map('map',{center:new maps.LatLng(33.39,126.53),zoom:10,zoomControl:true,zoomControlOptions:{position:maps.Position.RIGHT_TOP},scaleControl:false});
    state.infoWindow=new maps.InfoWindow({backgroundColor:'#fff',borderColor:'#dce8e2',pixelOffset:new maps.Point(0,-8)});
    maps.Event.addListener(state.map,'click',event=>{if(state.mapPick){fromMapClick(event.coord.lat(),event.coord.lng());}});
    el('mapFallback').hidden=true;el('recenterButton').hidden=false;renderMap();
  };
  document.head.append(script);
}
function clearMap(){
  for(const m of state.markers)m.setMap(null);
  for(const l of state.lines)l.setMap(null);
  state.markers=[];state.lines=[];
}
function markerHTML(number,kind){
  const color=kind==='origin'?'#293d45':kind==='hotel'?'#73878f':'#08ab69';
  return `<div style="display:grid;place-items:center;min-width:29px;height:29px;border-radius:10px;background:${color};color:#fff;font:800 13px sans-serif;padding:0 4px;border:2px solid #fff;box-shadow:0 2px 6px #0003">${number}</div>`;
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderMap(){
  if(!state.map)return;
  clearMap();const maps=naver.maps;
  const points=[{...state.origin,marker:'S',kind:'origin'},...state.places.map((p,i)=>({...p,marker:String(i+1),kind:'place'})),{...state.lodging,marker:'H',kind:'hotel'}];
  points.forEach(p=>{
    const marker=new maps.Marker({position:new maps.LatLng(p.lat,p.lng),map:state.map,title:p.name,
      icon:{content:markerHTML(p.marker,p.kind),anchor:new maps.Point(16,16)}});
    maps.Event.addListener(marker,'click',()=>{
      state.infoWindow.setContent(`<div style="padding:11px 14px;min-width:100px;font:600 13px sans-serif">${escapeHTML(p.name)}</div>`);
      state.infoWindow.open(state.map,marker);
    });
    state.markers.push(marker);
  });
  if(state.lastPlan){
    const colors=['#08a968','#297dd4','#e68b38','#a066ce','#da6178'];
    state.lastPlan.days.forEach((day,i)=>{
      day.legs.forEach(leg=>{
        const path=leg.path.map(coords=>new maps.LatLng(coords[0],coords[1]));
        if(path.length>=2){
          state.lines.push(new maps.Polyline({map:state.map,path,strokeColor:colors[i%colors.length],strokeWeight:4,strokeOpacity:.88,strokeStyle:leg.actual?'solid':'shortdash'}));
        }
      });
    });
  }
  fitMap();
}
function fitMap(){
  if(!state.map)return;
  const values=[state.origin,...state.places,state.lodging];
  const bounds=new naver.maps.LatLngBounds();
  values.forEach(p=>bounds.extend(new naver.maps.LatLng(p.lat,p.lng)));
  state.map.fitBounds(bounds,{top:36,right:32,bottom:36,left:32});
}
function minsText(value){if(!Number.isFinite(value))return '—';const h=Math.floor(value/60),m=value%60;return h?`${h}시간 ${m}분`:`${m}분`;}
function renderPlan(plan){
  state.lastPlan=plan;el('copyButton').disabled=false;
  el('statDistance').textContent=`${plan.distance_km}km`;
  el('statTime').textContent=minsText(plan.drive_minutes);
  const status=el('routeStatus');
  const accurate=plan.legs_actual===plan.legs_total;
  status.className=`route-status ${accurate?'good':'warn'}`;
  status.textContent=accurate
    ?'네이버 자동차 길찾기의 실제 도로 경로 및 소요시간입니다. 방문 순서는 거리 기반 추천으로 계산했습니다.'
    :`총 ${plan.legs_total}구간 중 ${plan.legs_actual}구간 도로 경로 확인. 나머지는 직선거리 기반 추정치입니다. 자세한 주행시간은 출발 전에 네이버 지도로 확인하세요.`;
  const container=el('dayOutput');container.replaceChildren();
  plan.days.forEach(day=>{
    const card=node('article',{class:'day-card'}),head=node('div',{class:'day-head'});
    const title=node('div');title.append(node('span',{class:'day-pill'},`DAY ${day.day}`),node('strong',{},` ${day.day}일차 여행`));
    head.append(title,node('span',{},`${day.stops.length-2}곳 · ${day.end_time} 종료`));card.append(head);
    day.stops.forEach((s,i)=>{
      const row=node('div',{class:'stop-line'}),rail=node('div',{class:'stop-rail'});
      rail.append(node('span',{class:`dot ${s.kind==='end'?'terminal':''}`}),node('span',{class:'rail-line'}));
      const info=node('div',{class:'stop-content'}),detail=s.kind==='start'?'여행 출발':s.kind==='end'?'하루 여행 마무리':`체류 ${s.stay}분 · 이전 장소에서 ${s.travel_min}분 이동${s.actual?'':' (추정)'}`;
      info.append(node('strong',{},s.place.name),node('small',{},detail));
      row.append(rail,info,node('span',{class:'stop-time'},s.arrival));card.append(row);
    });
    if(day.overloaded)card.append(node('div',{class:'day-flag'},'21시 이후 종료 예상 · 방문 장소를 줄이거나 출발 시간을 조정해 주세요.'));
    container.append(card);
  });
  renderMap();switchTab('map');
}
async function createPlan(){
  if(!count())return toast('방문 장소를 한 곳 이상 추가해주세요.');
  const button=el('planButton');if(button.disabled)return;
  button.disabled=true;el('planLabel').textContent='동선 계산 중…';
  el('routeStatus').className='route-status';el('routeStatus').textContent='장소를 지역별로 묶고 이동 경로를 계산하고 있습니다.';
  try{
    const req={places:state.places,origin:state.origin,lodging:state.lodging,
      days:Number(el('days').value),pace:el('pace').value,start_time:el('startTime').value||'09:30',return_origin:el('returnOrigin').value==='true'};
    const response=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});
    const data=await response.json();
    if(!response.ok){const msg=typeof data.detail==='string'?data.detail:'입력값을 확인해주세요.';throw new Error(msg);}
    renderPlan(data);toast('여행 동선이 생성되었습니다.');
    el('routeStatus').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(err){el('routeStatus').className='route-status warn';el('routeStatus').textContent=`동선 생성 실패: ${err.message}`;toast('동선 생성에 실패했습니다.');}
  finally{button.disabled=false;el('planLabel').textContent='동선 다시 만들기';}
}
async function copyTrip(){
  if(!state.lastPlan)return;
  const lines=['여행길 · 여행 동선',`총 ${state.lastPlan.distance_km}km · 이동 ${minsText(state.lastPlan.drive_minutes)}`];
  for(const day of state.lastPlan.days){lines.push('',`DAY ${day.day}`);for(const stop of day.stops)lines.push(`${stop.arrival} ${stop.place.name}`);}
  lines.push('','※ 실제 운행시간·영업시간은 출발 전에 다시 확인하세요.');
  const text=lines.join('\n');
  try{await navigator.clipboard.writeText(text);toast('일정이 클립보드에 복사되었습니다.');}
  catch{if(navigator.share){try{await navigator.share({title:'나의 여행 동선',text});}catch{}}else toast('브라우저 복사를 지원하지 않습니다. HTTPS에서 이용해 주세요.');}
}
function bind(){
  el('searchLaunch').addEventListener('click',()=>openSearch());
  el('originButton').addEventListener('click',()=>openSearch('origin'));
  el('lodgingButton').addEventListener('click',()=>openSearch('lodging'));
  el('closeSearch').addEventListener('click',closeSearch);el('searchBackdrop').addEventListener('click',closeSearch);
  el('searchForm').addEventListener('submit',e=>{e.preventDefault();performSearch();});
  el('searchInput').addEventListener('input',()=>{clearTimeout(state.searchTimer);const q=el('searchInput').value.trim();if(q.length>=2)state.searchTimer=setTimeout(performSearch,450);});
  el('mapPickButton').addEventListener('click',chooseMapPick);
  el('planButton').addEventListener('click',createPlan);
  el('copyButton').addEventListener('click',copyTrip);
  el('tabMap').addEventListener('click',()=>switchTab('map'));
  el('tabList').addEventListener('click',()=>switchTab('list'));
  el('recenterButton').addEventListener('click',fitMap);
  document.querySelectorAll('[data-quick]').forEach(b=>b.addEventListener('click',()=>openSearch('place',b.dataset.quick)));
  ['days','pace','startTime','returnOrigin'].forEach(id=>el(id).addEventListener('change',invalidatePlan));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el('searchModal').hidden)closeSearch();});
}
async function init(){
  bind();renderPlaces();
  try{
    const response=await fetch('/api/config');if(!response.ok)throw new Error('설정 조회 실패');
    state.config=await response.json();initMap(state.config);
    if(!state.config.searchConfigured)console.info('실시간 검색을 사용하려면 NAVER API HUB 키를 서버에 등록하세요.');
  }catch{showMapError('백엔드 서버에 연결하지 못했습니다.');toast('서버 설정을 확인해 주세요.');}
}
init();
