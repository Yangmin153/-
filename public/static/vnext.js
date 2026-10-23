/** vNext wizard — previous day endpoint inheritance + global flexible visit pool + daily routes. */
(function(){
'use strict';
const app=window.TripApp,$=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
if(!app||!$('yg-step-one'))return;
const MS=86400000,MAX=10;
let step=1,computing=false,lastWarnings=[],sheetOpen=false;
const dates=()=>app.getDays().map(d=>d.date).filter(Boolean);
const stops=()=>app.allStops();
function ms(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return NaN;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?t:NaN;}
function fmt(s){const t=ms(s);return Number.isFinite(t)?new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}).format(t):s||'날짜 미정';}
function tripDuration(a,b){const start=ms(a),end=ms(b);return Number.isFinite(start)&&Number.isFinite(end)?Math.round((end-start)/MS)+1:0;}
function isSet(p){return p&&p.name&&!/미설정/.test(p.name)&&Number.isFinite(p.lat)&&Number.isFinite(p.lng);}
function showError(message){$('yg-stage-one-error').textContent=message;$('yg-stage-one-error').hidden=!message;}
function setDates(){
 const start=$('yg-start-date').value,end=$('yg-end-date').value,count=tripDuration(start,end);
 if(!start&&!end){$('yg-duration').textContent='출발일과 돌아오는 날을 선택하세요';return;}
 if(!end||!start){$('yg-duration').textContent='나머지 날짜도 선택해 주세요';return;}
 if(count<1){$('yg-duration').textContent='돌아오는 날은 출발일보다 빠를 수 없어요';showError('돌아오는 날을 출발일 이후로 선택해 주세요.');return;}
 if(count>MAX){$('yg-duration').textContent='최대 10일까지 계획할 수 있어요';showError('한 번에 최대 10일 여행을 지원합니다.');return;}
 showError('');
 $('yg-duration').textContent=count===1?'당일치기 여행':(count-1)+'박 '+count+'일 여행';
 if(app.getDays().map(d=>d.date).join('|')!==Array.from({length:count},(_,i)=>new Date(ms(start)+i*MS).toISOString().slice(0,10)).join('|')){
  app.setTravelDates(start,end);
 }
 renderDayCards();
}
function renderDayCards(){
 const days=app.getDays(),hasRange=dates().length===days.length;
 const area=$('yg-day-cards');
 if(!hasRange){area.innerHTML='';return;}
 area.innerHTML=days.map((d,i)=>{
  const previous=i>0?days[i-1].destination:null,inherit=i>0&&d.originMode!=='custom';
  const originLabel=inherit?(isSet(previous)?'전날 마지막 도착지 · '+previous.name:'전날 도착지를 먼저 지정해 주세요.'):(isSet(d.origin)?d.origin.name:'출발지를 선택해 주세요');
  return `<article class="yg-day-card" data-date="${escape(d.date)}">
    <h3>${fmt(d.date)}</h3>
    ${i>0?`<div class="yg-inherit"><label><input type="radio" name="yg-origin-mode-${i}" value="inherit" data-mode-day="${i}" ${inherit?'checked':''}> 전날 마지막 도착지에서 출발</label>
      <label><input type="radio" name="yg-origin-mode-${i}" value="custom" data-mode-day="${i}" ${!inherit?'checked':''}> 다른 장소에서 출발</label></div>`:''}
    <div class="yg-endpoint"><span>출발지</span><button type="button" data-endpoint-day="${i}" data-endpoint-kind="origin" ${inherit?'disabled':''}><strong>${escape(originLabel)}</strong><small>공항, 숙소 등 하루를 시작하는 장소</small></button></div>
    <div class="yg-endpoint"><span>최종 도착지</span><button type="button" data-endpoint-day="${i}" data-endpoint-kind="destination"><strong>${escape(isSet(d.destination)?d.destination.name:'마지막 도착지를 선택해 주세요')}</strong><small>숙소, 공항 등 하루를 마치는 장소</small></button></div>
  </article>`;
 }).join('');
}
function renderSheet(){
 const all=stops(),dayDates=dates(),valid=new Set(dayDates);
 $('yg-stop-count').textContent=String(all.length);$('yg-sheet-count').textContent=String(all.length);
 $('yg-sheet-list').innerHTML=all.length?all.map(stop=>{
  const invalid=stop.fixedDate&&!valid.has(stop.fixedDate);
  const selected=invalid?'__invalid__':stop.fixedDate||'';
  const info=window.TripMeta?.meta?.(stop);
  const options=['<option value="">자동 배정</option>',...dayDates.map(d=>`<option value="${d}" ${d===selected?'selected':''}>${fmt(d)}</option>`)];
  if(invalid)options.push(`<option value="__invalid__" selected>이전 지정 날짜 · ${escape(stop.fixedDate)} (재지정 필요)</option>`);
  return `<div class="yg-place-row" data-place-id="${escape(stop.id)}"><button type="button" class="yg-place-focus" data-focus-place="${escape(stop.id)}"><strong>${escape(stop.name)}</strong><small>${escape(info?.label||stop.category||'장소')}${stop.address?' · '+escape(stop.address):''}</small></button>
    <label>방문 날짜<select data-fixed-id="${escape(stop.id)}" ${invalid?'class="yg-date-invalid"':''}>${options.join('')}</select></label>
    <button type="button" class="yg-place-remove" data-remove-place="${escape(stop.id)}" aria-label="${escape(stop.name)} 삭제">×</button></div>`;
 }).join(''):'<p class="yg-empty">아직 담은 장소가 없어요. 지도를 열고 원하는 장소를 찾아보세요.</p>';
}
function openSheet(){
 renderSheet();$('yg-place-sheet').hidden=false;sheetOpen=true;document.body.classList.add('yg-sheet-open');
}
function closeSheet(){$('yg-place-sheet').hidden=true;sheetOpen=false;document.body.classList.remove('yg-sheet-open');}
function go(next){
 if(next===2&&!dates().length){showError('여행 날짜를 먼저 선택해 주세요.');return;}
 if(next===3&&!app.getDays().some(d=>d.result)){app.toast('먼저 최적 동선을 계산해 주세요.');return;}
 step=next;document.body.dataset.tripStep=String(step);
 document.querySelectorAll('[data-yg-step]').forEach(b=>{b.setAttribute('aria-current',String(b.dataset.ygStep)===String(next)?'step':'false');});
 if(next===3){window.TripUX?.switchView?.('map');app.setActive(0);requestAnimationFrame(()=>setTimeout(()=>{app.resizeMap();app.fitMap();},120));}
 else{window.TripUX?.switchView?.('edit');}
 if(next===1)renderDayCards();
 if(next===2){app.setActive(0);renderSheet();}
 if(next===3){renderWarnings();}
 try{localStorage.setItem('yeohaenggil.vnext.step',String(next));}catch{}
 window.scrollTo({top:0,behavior:'instant'});
}
function renderWarnings(){
 const invalid=stops().filter(s=>s.fixedDate&&!dates().includes(s.fixedDate));
 $('yg-assign-warning').textContent=[...lastWarnings,invalid.length?'지정한 날짜가 여행 기간 밖인 방문지 '+invalid.length+'곳이 있습니다. 날짜를 수정해 주세요.':''].filter(Boolean).join(' ');
}
async function calculate(){
 if(computing)return;
 const days=app.getDays(),all=stops();
 if(!days.every(d=>d.date&&isSet(d.origin)&&isSet(d.destination))){app.toast('각 날짜의 출발지와 마지막 도착지를 먼저 지정해 주세요.');go(1);return;}
 const invalid=all.filter(s=>s.fixedDate&&!days.some(d=>d.date===s.fixedDate));
 if(invalid.length){app.toast('여행 기간 밖으로 고정된 방문 날짜를 다시 지정해 주세요.');openSheet();return;}
 const body={days:days.map(d=>({date:d.date,origin:d.origin,destination:d.destination})),stops:all};
 const snapshot=JSON.stringify(body);
 computing=true;for(const id of ['yg-calculate','yg-three-recalc'])$(id).disabled=true;
 $('yg-calc-progress').hidden=false;$('yg-calc-progress').textContent='날짜별 방문지 배분과 자동차 동선을 계산하고 있어요…';
 try{
  const response=await fetch('/api/multi-route',{method:'POST',headers:{'content-type':'application/json'},body:snapshot});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error(data?.detail||'동선 계산 요청이 실패했어요.');
  const latest=JSON.stringify({days:app.getDays().map(d=>({date:d.date,origin:d.origin,destination:d.destination})),stops:stops()});
  if(latest!==snapshot)throw Error('계산 중 장소 또는 여행 날짜가 변경되었습니다. 다시 계산해 주세요.');
  if(!app.applyMultiRoutes(data))throw Error('계산 결과와 저장된 장소가 일치하지 않습니다.');
  lastWarnings=data.warnings||[];renderSheet();go(3);
 }catch(err){app.toast('동선 계산 실패: '+err.message);$('yg-calc-progress').textContent=err.message;$('yg-calc-progress').hidden=false;}
 finally{computing=false;for(const id of ['yg-calculate','yg-three-recalc'])$(id).disabled=false;if(app.getDays().some(d=>d.result))$('yg-calc-progress').hidden=true;}
}
$('yg-start-date').addEventListener('change',()=>{if(!$('yg-end-date').value)$('yg-end-date').value=$('yg-start-date').value;setDates();});
$('yg-end-date').addEventListener('change',setDates);
$('yg-day-cards').addEventListener('click',e=>{
 const btn=e.target.closest('[data-endpoint-day]');if(!btn)return;
 app.setActive(Number(btn.dataset.endpointDay));app.openModal(btn.dataset.endpointKind);
});
$('yg-day-cards').addEventListener('change',e=>{
 const radio=e.target.closest('[data-mode-day]');if(!radio)return;
 const i=Number(radio.dataset.modeDay),d=app.getDays()[i];
 if(radio.value==='inherit'){d.originMode='inherit';app.syncLinkedOrigins(i);}
 else d.originMode='custom';
 app.clearComputed();renderDayCards();
});
$('yg-next-places').addEventListener('click',()=>go(2));
$('yg-back-dates').addEventListener('click',()=>go(1));
$('yg-back-places').addEventListener('click',()=>go(2));
$('yg-calculate').addEventListener('click',calculate);
$('yg-three-recalc').addEventListener('click',calculate);
$('yg-three-add').addEventListener('click',()=>{go(2);window.YeoSearch?.show?.();});
$('yg-open-stops').addEventListener('click',openSheet);
$('yg-three-list').addEventListener('click',openSheet);
$('yg-place-sheet').addEventListener('click',e=>{
 if(e.target.closest('[data-close-sheet]'))closeSheet();
 const remove=e.target.closest('[data-remove-place]');if(remove){app.removeStop(remove.dataset.removePlace);renderSheet();}
 const focus=e.target.closest('[data-focus-place]');
 if(focus){const p=stops().find(s=>s.id===focus.dataset.focusPlace);if(!p)return;closeSheet();go(2);window.YeoSearch?.show?.();window.YeoSearch?.preview?.(p);}
});
$('yg-place-sheet').addEventListener('change',e=>{
 const sel=e.target.closest('[data-fixed-id]');if(!sel)return;
 if(sel.value==='__invalid__')return;
 if(app.setStopFixedDate(sel.dataset.fixedId,sel.value)){app.clearComputed();renderSheet();renderWarnings();}
});
$('yg-sheet-map').addEventListener('click',()=>{closeSheet();window.YeoSearch?.show?.();});
$('yg-delete-routes').addEventListener('click',()=>{
 if(!confirm('계산된 동선만 삭제할까요? 여행 날짜, 장소, 지정한 날짜는 그대로 남습니다.'))return;
 app.clearComputed();lastWarnings=[];go(2);app.toast('동선 계산 결과만 삭제했습니다.');
});
document.querySelectorAll('[data-yg-step]').forEach(btn=>btn.addEventListener('click',()=>go(Number(btn.dataset.ygStep))));
document.addEventListener('trip:endpoint-changed',()=>{renderDayCards();renderWarnings();});
document.addEventListener('trip:day-changed',()=>{renderDayCards();renderSheet();});
document.addEventListener('trip:stops-changed',()=>{renderSheet();if(app.getDays().some(d=>d.result)){app.clearComputed();app.toast('장소가 변경됐어요. 최적 동선을 다시 계산해 주세요.');}});
document.addEventListener('trip:stop-added',()=>{renderSheet();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheetOpen)closeSheet();});
function init(){
 const d=app.getDays();
 if(d.every(x=>x.date)&&d.length){$('yg-start-date').value=d[0].date;$('yg-end-date').value=d.at(-1).date;}
 else{const today=new Date();const local=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);$('yg-start-date').value='';$('yg-end-date').value='';}
 if($('yg-start-date').value)setDates();else renderDayCards();
 const saved=Number((()=>{try{return localStorage.getItem('yeohaenggil.vnext.step')}catch{return null}})());
 go(d.every(x=>x.date)&&[1,2].includes(saved)?saved:1);
 renderSheet();
}
window.YeoNext={go,calculate,renderDayCards,renderSheet,openSheet};
init();
})();
