/** 여행길 vNext · One day at a time.
 * Existing API /api/route and Kakao/Naver map integrations are unchanged. */
(function(){
'use strict';
const app=window.TripApp,$=id=>document.getElementById(id);
if(!app||!$('yg-step-one'))return;
const MS=86400000,MAX_DAYS=10,escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let currentStep=1,busy=false,sheetOpen=false,lastWarnings=[],dragStartY=0;
const days=()=>app.getDays(),day=()=>app.getDay(),stops=()=>day().stops;
function ms(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return NaN;
 const t=Date.parse(value+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===value?t:NaN;
}
function dateText(value,{short=false}={}){
 if(!Number.isFinite(ms(value)))return '날짜 미정';
 const t=new Date(ms(value));
 if(short)return (t.getUTCMonth()+1)+'.'+String(t.getUTCDate()).padStart(2,'0')+' ('+['일','월','화','수','목','금','토'][t.getUTCDay()]+')';
 return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}).format(ms(value)).replace(/\s+/g,' ');
}
function duration(start,end){const a=ms(start),b=ms(end);return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/MS)+1:0;}
function configured(p){return p&&!/미설정/.test(p.name||'')&&Number.isFinite(p.lat)&&Number.isFinite(p.lng);}
function error(message){$('yg-stage-one-error').textContent=message;$('yg-stage-one-error').hidden=!message;}
function renderDates(){
 const chosen=days().filter(d=>Number.isFinite(ms(d.date)));
 $('yg-day-cards').innerHTML=chosen.length===days().length
 ?chosen.map((d,i)=>'<span class="yg-date-pill"><b>'+dateText(d.date)+'</b><small>'+(i+1)+'일 차</small></span>').join(''):'';
}
function syncDateRange(){
 const start=$('yg-start-date').value,end=$('yg-end-date').value,count=duration(start,end);
 if(!start||!end){$('yg-duration').textContent='두 날짜를 선택해 주세요.';error('');return;}
 if(count<1){$('yg-duration').textContent='날짜를 확인해 주세요';error('돌아오는 날은 출발일보다 빠를 수 없어요.');return;}
 if(count>MAX_DAYS){$('yg-duration').textContent='최대 10일까지 선택할 수 있어요';error('여행 기간은 최대 10일까지 설정할 수 있습니다.');return;}
 const expected=Array.from({length:count},(_,i)=>new Date(ms(start)+i*MS).toISOString().slice(0,10)).join('|');
 if(days().map(d=>d.date).join('|')!==expected&&!app.setTravelDates(start,end)){error('여행 날짜를 변경할 수 없어요. 다시 시도해 주세요.');return;}
 error('');
 $('yg-duration').textContent=count===1?'당일치기 여행':(count-1)+'박 '+count+'일 여행';
 renderDates();renderDaily();
}
function renderDaily(){
 const list=days(),active=app.getActive(),d=day();
 if(!d)return;
 const select=$('yg-active-date'),key=list.map(x=>x.date).join('|');
 if(select.dataset.dates!==key){
  select.innerHTML=list.map((x,i)=>'<option value="'+i+'">'+dateText(x.date,{short:true})+'</option>').join('');
  select.dataset.dates=key;
 }
 select.value=String(active);
 const inherit=active>0&&d.originMode!=='custom';
 $('yg-day-inherit').hidden=active===0;
 document.querySelectorAll('[name="yg-origin-choice"]').forEach(el=>el.checked=el.value===(inherit?'inherit':'custom'));
 const previous=list[active-1]?.destination;
 $('yg-origin-display').textContent=inherit?(configured(previous)?'전날 마지막 도착지 · '+previous.name:'전날 도착지를 먼저 설정해 주세요'):(configured(d.origin)?d.origin.name:'출발지를 선택해 주세요');
 $('yg-origin-sub').textContent=inherit?'자동으로 연결된 출발지':(d.origin.address||'공항, 숙소 등 하루를 시작하는 장소');
 $('yg-origin-pick').disabled=inherit;
 $('yg-dest-display').textContent=configured(d.destination)?d.destination.name:'이날의 도착지를 설정해 주세요';
 $('yg-dest-sub').textContent=d.destination.address||'숙소, 공항 등 하루를 마치는 장소';
 $('yg-day-stop-count').textContent=d.stops.length+'곳';
 $('yg-day-stop-sub').textContent=d.stops.length?'오늘 방문지 '+d.stops.length+'곳을 담았어요.':'아직 담은 장소가 없어요.';
 $('yg-empty-inline').hidden=d.stops.length!==0;
 $('yg-stop-count').textContent=String(d.stops.length);
 $('yg-route-mode').value=d.mode==='manual'?'manual':'auto';
 if(sheetOpen)renderSheet();
}
function renderSheet(){
 const d=day(),items=stops(),count=items.length;
 $('yg-sheet-count').textContent=String(count);
 $('yg-stop-count').textContent=String(count);
 $('yg-sheet-date').textContent=dateText(d.date)+' · 방문 순서를 변경할 수 있어요';
 $('yg-sheet-list').innerHTML=items.length?items.map((p,i)=>{
  const meta=window.TripMeta?.meta?.(p),name=escape(p.name);
  const cat=meta?.label||p.category||'장소',icon=window.TripMeta?.icon?.(p,18)||'•';
  return '<div class="yg-place-row" data-place-id="'+escape(p.id)+'">'+
   '<span class="yg-place-order">'+(i+1)+'</span>'+
   '<span class="yg-place-category" aria-label="'+escape(cat)+'">'+icon+'</span>'+
   '<button class="yg-place-focus" type="button" data-focus-place="'+escape(p.id)+'"><strong>'+name+'</strong><small>'+escape(p.address||cat)+'</small></button>'+
   '<div class="yg-place-sort"><button type="button" data-stop-up="'+escape(p.id)+'" aria-label="'+name+' 순서 위로" '+(i===0?'disabled':'')+'>▲</button>'+
   '<button type="button" data-stop-down="'+escape(p.id)+'" aria-label="'+name+' 순서 아래로" '+(i===count-1?'disabled':'')+'>▼</button></div>'+
   '<button type="button" class="yg-place-remove" data-remove-place="'+escape(p.id)+'" aria-label="'+name+' 삭제">×</button></div>';
 }).join(''):'<div class="yg-empty-sheet"><strong>아직 담은 장소가 없어요.</strong><p>가고 싶은 장소를 검색해서 추가해 보세요.</p></div>';
}
function openSheet(){
 if(window.YeoSearch?.isOpen?.())return;
 sheetOpen=true;renderSheet();$('yg-place-sheet').hidden=false;document.body.classList.add('yg-sheet-open');
}
function closeSheet(){
 if(!sheetOpen)return;
 sheetOpen=false;$('yg-place-sheet').hidden=true;document.body.classList.remove('yg-sheet-open');
}
function go(next){
 if(next===2&&!days().every(d=>Number.isFinite(ms(d.date)))){error('출발일과 돌아오는 날을 먼저 선택해 주세요.');currentStep=1;document.body.dataset.tripStep='1';return;}
 if(next===3&&!days().some(d=>d.result)){app.toast('먼저 동선을 계산해 주세요.');return;}
 closeSheet();window.YeoSearch?.hide?.();
 currentStep=next;document.body.dataset.tripStep=String(next);
 document.querySelectorAll('[data-yg-step]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.ygStep)===next?'step':'false'));
 window.TripUX?.switchView?.(next===3?'map':'edit');
 if(next===1)renderDates();if(next===2||next===3)renderDaily();
 if(next===3)renderWarnings();
 try{localStorage.setItem('yeohaenggil.vnext.step',String(next));}catch{}
 window.scrollTo({top:0,behavior:'instant'});
 if(next===2||next===3)requestAnimationFrame(()=>setTimeout(()=>{app.resizeMap();app.refreshMap();},130));
}
function renderWarnings(){
 const notReady=days().filter(d=>!d.result).length;
 $('yg-assign-warning').textContent=notReady?'아직 동선을 만들지 않은 날짜가 '+notReady+'일 있어요. 해당 날짜의 출발지·도착지를 설정하면 계산할 수 있습니다.':'';
}
async function calculate(){
 if(busy)return;
 const full=days().map((d,i)=>({d,i})).filter(({d})=>configured(d.origin)&&configured(d.destination));
 const incomplete=days().find(d=>d.stops.length&&(!configured(d.origin)||!configured(d.destination)));
 if(incomplete){
  const index=days().indexOf(incomplete);app.setActive(index);go(2);
  app.toast(dateText(incomplete.date)+' 출발지와 도착지를 설정해 주세요.');return;
 }
 if(!full.length){
  app.toast('먼저 여행 날짜의 출발지·도착지를 설정해 주세요.');go(2);return;
 }
 const snapshot=JSON.stringify(days().map(d=>({date:d.date,origin:d.origin,destination:d.destination,stops:d.stops,mode:d.mode})));
 busy=true;for(const id of ['yg-calculate','yg-three-recalc'])$(id).disabled=true;
 $('yg-calc-progress').hidden=false;$('yg-calc-progress').textContent='날짜별 자동차 동선을 계산하는 중이에요…';
 try{
  const results=days().map(d=>({date:d.date,route:null}));let cursor=0;
  // Bound concurrent routing, honor manually ordered days, and retain day-specific assignments.
  await Promise.all(Array.from({length:Math.min(2,full.length)},async()=>{
   while(cursor<full.length){
    const {d,i}=full[cursor++];
    const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({origin:d.origin,destination:d.destination,stops:d.stops,mode:d.mode==='manual'?'manual':'auto',departure:d.departure||'09:00'})});
    const route=await response.json();
    if(!response.ok)throw Error(dateText(d.date)+': '+(route?.detail||'길찾기에 실패했어요.'));
    results[i]={date:d.date,route};
   }
  }));
  const now=JSON.stringify(days().map(d=>({date:d.date,origin:d.origin,destination:d.destination,stops:d.stops,mode:d.mode})));
  if(now!==snapshot)throw Error('계산 도중 장소가 바뀌었어요. 다시 계산해 주세요.');
  if(!app.applyDailyRoutes({days:results}))throw Error('계산 결과와 저장된 일정이 일치하지 않습니다.');
  lastWarnings=results.flatMap(x=>x.route?.warnings||[]);
  $('yg-calc-progress').hidden=true;go(3);
 }catch(e){
  app.toast('동선 계산 실패: '+e.message);$('yg-calc-progress').textContent=e.message;
 }finally{
  busy=false;for(const id of ['yg-calculate','yg-three-recalc'])$(id).disabled=false;
 }
}
function openSearch(){
 if(!days().every(d=>d.date)){app.toast('여행 날짜를 먼저 선택해 주세요.');return;}
 if(window.YeoSearch)window.YeoSearch.show();else app.openModal('stop');
}
// STEP 1: The native calendar is date-only, no endpoint inputs here.
$('yg-start-date').addEventListener('change',()=>{
 if(!$('yg-end-date').value)$('yg-end-date').value=$('yg-start-date').value;
 syncDateRange();
});
$('yg-end-date').addEventListener('change',syncDateRange);
// STEP 2: Selecting a date never recreates/stomps another day's stops.
$('yg-active-date').addEventListener('change',e=>app.setActive(Number(e.target.value)));
$('yg-origin-pick').addEventListener('click',()=>app.openModal('origin'));
$('yg-dest-pick').addEventListener('click',()=>app.openModal('destination'));
document.querySelectorAll('[name="yg-origin-choice"]').forEach(radio=>radio.addEventListener('change',()=>{
 if(!radio.checked)return;
 app.setDayOriginMode(app.getActive(),radio.value);
 if(radio.value==='custom')app.openModal('origin');
}));
$('yg-add-visit').addEventListener('click',openSearch);
$('yg-next-places').addEventListener('click',()=>go(2));
$('yg-back-dates').addEventListener('click',()=>go(1));
$('yg-back-places').addEventListener('click',()=>go(2));
$('yg-calculate').addEventListener('click',calculate);
$('yg-three-recalc').addEventListener('click',calculate);
$('yg-three-add').addEventListener('click',()=>{go(2);openSearch();});
$('yg-open-stops').addEventListener('click',openSheet);
$('yg-three-list').addEventListener('click',openSheet);
$('yg-route-mode').addEventListener('change',e=>{
 app.setRouteMode(e.target.value);renderDaily();app.toast('계산 방식을 변경했어요. 다시 계산해 주세요.');
});
$('yg-place-sheet').addEventListener('click',e=>{
 if(e.target.closest('[data-close-sheet]'))return closeSheet();
 const remove=e.target.closest('[data-remove-place]');
 if(remove){app.removeStop(remove.dataset.removePlace);renderDaily();return;}
 const up=e.target.closest('[data-stop-up]');
 if(up){app.reorderStop(up.dataset.stopUp,-1);renderDaily();return;}
 const down=e.target.closest('[data-stop-down]');
 if(down){app.reorderStop(down.dataset.stopDown,1);renderDaily();return;}
 const focus=e.target.closest('[data-focus-place]');
 if(focus){
  const p=stops().find(s=>s.id===focus.dataset.focusPlace);
  if(!p)return;closeSheet();go(2);openSearch();
  window.YeoSearch?.showSavedPlace?.(p);
 }
});
$('yg-sheet-map').addEventListener('click',()=>{closeSheet();openSearch();});
$('yg-delete-routes').addEventListener('click',()=>{
 if(!confirm('동선만 삭제할까요? 여행 날짜와 출발지, 도착지, 방문지는 그대로 남습니다.'))return;
 app.clearComputed();go(2);app.toast('계산 결과만 삭제했습니다.');
});
const sheetHeader=$('yg-place-sheet').querySelector('.yg-sheet-head');
sheetHeader.addEventListener('touchstart',e=>{dragStartY=e.touches[0]?.clientY||0;},{passive:true});
sheetHeader.addEventListener('touchend',e=>{if((e.changedTouches[0]?.clientY||0)-dragStartY>85)closeSheet();},{passive:true});
document.querySelectorAll('[data-yg-step]').forEach(btn=>btn.addEventListener('click',()=>go(Number(btn.dataset.ygStep))));
document.addEventListener('trip:endpoint-changed',()=>{renderDaily();renderWarnings();});
document.addEventListener('trip:day-changed',()=>{renderDaily();renderWarnings();});
document.addEventListener('trip:stops-changed',()=>{renderDaily();renderWarnings();});
document.addEventListener('trip:stop-added',()=>renderDaily());
document.addEventListener('trip:route-mode-changed',()=>renderDaily());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetOpen)closeSheet();});
function init(){
 document.body.classList.remove('region-needs-choice');document.body.classList.add('region-ready');
 const d=days();
 if(d.length&&d.every(x=>x.date)){
  $('yg-start-date').value=d[0].date;$('yg-end-date').value=d.at(-1).date;syncDateRange();
 }else{$('yg-duration').textContent='날짜를 선택해 주세요';renderDates();}
 const stored=(()=>{try{return Number(localStorage.getItem('yeohaenggil.vnext.step'))}catch{return 1}})();
 go(d.every(x=>x.date)&&(stored===2||stored===3)&&d.some(x=>x.result||stored===2)?stored:1);
 renderDaily();
}
window.YeoNext={go,calculate,renderDaily,renderSheet,openSheet,dateLabel:()=>dateText(day()?.date,{short:true}),searchRegion:()=>''};
init();
})();
