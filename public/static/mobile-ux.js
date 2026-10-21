/** Mobile-first UI controller. Never touches /api/route or /api/places data contracts. */
import {encodeTrip,decodeTrip,naverRouteLinks,tripSnapshot,MOBILE_BREAKPOINT} from './trip-utils.js';
const $=id=>document.getElementById(id);
const app=window.TripApp;
const media=window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
let activeView='edit';
let routeLaunchTimer=null;
let modalFocus=null;
let lastModalOpen=false;
let pendingRouteSwitch=false;

function switchView(next) {
  if(next!=='edit'&&next!=='map')return;
  activeView=next;
  document.body.dataset.mobileView=activeView;
  document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.view===activeView)));
  if(media.matches){window.scrollTo({top:0,behavior:'instant'}); if(next==='map')requestAnimationFrame(()=>setTimeout(()=>app.resizeMap(),70));}
}

function render() {
  if(!app)return;
  if(pendingRouteSwitch){pendingRouteSwitch=false;switchView('map');}
  const day=app.getDay(),days=app.getDays();
  const hasPlaces=days.some(d=>d.stops.length>0);
  document.body.classList.toggle('has-places',hasPlaces);
  $('mobile-route').disabled=document.querySelector('#btn-route')?.disabled||false;
  $('mobile-route').textContent=day.mode==='manual'?'이 순서로 계산하기':'동선 계산하기';
  $('btn-inherit-origin').hidden=app.getActive()===0;
  // These controls are intentionally separate from the original editor render path.
  document.querySelectorAll('.stop-card').forEach(card=>{
    if(card.querySelector('.stop-nav'))return;
    const id=card.dataset.stopId;
    const actions=card.querySelector('.stop-actions');
    if(!actions)return;
    const btn=document.createElement('button');btn.type='button';btn.className='stop-nav';btn.dataset.navigateStop=id;btn.textContent='길안내';btn.setAttribute('aria-label','이 장소까지 네이버 지도 길안내');
    actions.prepend(btn);
  });
  document.querySelectorAll('.timeline-entry').forEach((card,i)=>{
    const entries=day.result?.entries;
    if(!entries?.[i]||i===0||card.querySelector('.timeline-nav'))return;
    const action=document.createElement('button');action.type='button';action.className='timeline-nav';action.dataset.navigateIndex=String(i);action.textContent='네이버 지도 길안내 ↗';
    card.querySelector('.timeline-info')?.append(action);
  });
}

function beforeModal(){modalFocus=document.activeElement;lastModalOpen=true;document.body.classList.add('modal-visible');}
function onModalClosed(){lastModalOpen=false;document.body.classList.remove('modal-visible');modalFocus?.focus?.({preventScroll:true});}
function syncModalVisible(){
  const open=!$('place-modal').classList.contains('hidden');
  if(!open&&lastModalOpen)onModalClosed();
}
function onRouteCalculated(){pendingRouteSwitch=media.matches;}

function navigate(from,to){
  if(!from||!to)return app.toast('길안내할 장소를 찾을 수 없습니다.');
  let urls;
  try{urls=naverRouteLinks(from,to,location.origin);}catch(error){app.toast(error.message);return;}
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if(!mobile){window.open(urls.web,'_blank','noopener,noreferrer');return;}
  // A native-scheme launch cannot be detected reliably by the browser.
  // Fall back only if this page remains visible after the launch attempt.
  const fallback=()=>{clearTimeout(routeLaunchTimer);routeLaunchTimer=null;document.removeEventListener('visibilitychange',onVisibility);if(!document.hidden)location.assign(urls.web);};
  const onVisibility=()=>{if(document.hidden){clearTimeout(routeLaunchTimer);routeLaunchTimer=null;document.removeEventListener('visibilitychange',onVisibility);}};
  document.addEventListener('visibilitychange',onVisibility);
  routeLaunchTimer=setTimeout(fallback,1700);
  try{location.href=urls.app;}catch{fallback();}
}
function navigateStop(id){const d=app.getDay(),index=d.stops.findIndex(x=>x.id===id);if(index<0)return;const prev=index===0?d.origin:d.stops[index-1];navigate(prev,d.stops[index]);}
function navigateTimeline(index){const entries=app.getDay().result?.entries;if(!entries||index<=0||index>=entries.length)return; navigate(entries[index-1].place,entries[index].place);}

async function shareTrip(){
  let url;
  try{const encoded=encodeTrip(app.getDays());url=new URL(location.href);url.hash=`trip=${encoded}`;}
  catch(e){app.toast(e.message);return;}
  try{
    if(navigator.share){await navigator.share({title:'여행길 일정',text:'함께 여행 동선을 확인해 보세요. 공유 링크의 장소와 일정은 링크를 가진 사람이 볼 수 있습니다.',url:url.href});return;}
  }catch(err){if(err.name==='AbortError')return;}
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(url.href);}
    else {const input=document.createElement('textarea');input.value=url.href;input.style.position='fixed';input.style.opacity='0';document.body.append(input);input.select();if(!document.execCommand('copy'))throw Error('복사 실패');input.remove();}
    app.toast('일정 공유 링크를 복사했습니다.');
  }catch{app.toast('링크 복사가 지원되지 않습니다. 일정 저장 파일을 사용해 주세요.');}
}

function loadSharedTrip(){
  const hash=location.hash.slice(1);
  if(!hash.startsWith('trip='))return;
  const removeHash=()=>history.replaceState(null,'',location.pathname+location.search);
  try{
    const days=decodeTrip(hash.slice(5));
    if(!window.confirm('공유받은 여행 일정으로 현재 일정을 교체할까요? 현재 일정이 덮어써집니다.')){removeHash();return;}
    if(!app.importDays(days))throw Error('일정 데이터가 올바르지 않습니다.');
    app.toast('공유 일정을 불러왔습니다.');removeHash();
  }catch(e){removeHash();app.toast(`공유 일정 불러오기 실패: ${e.message}`);}
}
function onClick(event){
  const viewButton=event.target.closest('[data-view]');if(viewButton){switchView(viewButton.dataset.view);return;}
  const navStop=event.target.closest('[data-navigate-stop]');if(navStop){event.stopPropagation();navigateStop(navStop.dataset.navigateStop);return;}
  const navIndex=event.target.closest('[data-navigate-index]');if(navIndex){navigateTimeline(Number(navIndex.dataset.navigateIndex));return;}
}
function init(){
  if(!app)return;
  document.body.dataset.mobileView='edit';
  document.addEventListener('click',onClick);
  $('mobile-add-place').addEventListener('click',()=>app.openModal('stop'));
  $('mobile-route').addEventListener('click',()=>app.calculateRoute());
  $('btn-share').addEventListener('click',shareTrip);
  $('btn-inherit-origin').addEventListener('click',()=>{
    const index=app.getActive(),days=app.getDays();if(index===0)return;
    const current=days[index],source=days[index-1].destination;
    current.origin={...structuredClone(source),id:current.origin.id};
    app.markDirty(false);app.toast('전날 도착지를 오늘 출발지로 연결했어요.');
  });
  $('place-address-fallback').addEventListener('click',()=>{
    $('place-query').focus();
    $('place-query').select();
  });
  $('place-modal').addEventListener('click',()=>queueMicrotask(syncModalVisible));
  document.addEventListener('keydown',event=>{
    if(event.key!=='Tab'||$('place-modal').classList.contains('hidden'))return;
    const all=[...$('place-modal').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(el=>el.getClientRects().length>0);
    if(!all.length)return;const first=all[0],last=all.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  media.addEventListener?.('change',()=>{if(media.matches){switchView(activeView);}else{document.body.dataset.mobileView='edit';app.resizeMap();}});
  window.TripUX={render, switchView,beforeModal,onModalClosed,onRouteCalculated};
  render();loadSharedTrip();
}
init();
