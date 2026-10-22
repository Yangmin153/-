/** Travel location first, then place collection; keep all existing days and stops. */
(function(){
'use strict';
const $=id=>document.getElementById(id),app=()=>window.TripApp;
const input=$('trip-region'),panel=document.querySelector('.region-onboarding'),continueBtn=$('region-confirm'),state=$('region-selection-state');
if(!input||!panel||!continueBtn)return;
const centers=Object.freeze({
 제주:[33.489,126.498],제주도:[33.489,126.498],제주시:[33.5,126.53],서귀포:[33.254,126.559],
 서울:[37.5665,126.978],부산:[35.1796,129.0756],강릉:[37.7519,128.8761],
 경주:[35.8562,129.2247],속초:[38.207,128.5918],여수:[34.7604,127.6622],전주:[35.8242,127.148],
 인천:[37.4563,126.7052],대전:[36.3504,127.3845],대구:[35.8714,128.6014],광주:[35.1595,126.8526],
 울산:[35.5384,129.3114],수원:[37.2636,127.0286],춘천:[37.8813,127.7298],
 안동:[36.5684,128.7294],포항:[36.019,129.3435],통영:[34.8544,128.4332],거제:[34.8806,128.6211]
});
const choiceKey='yeohaenggil.region.selected.v51';
let chosen='',token=0,controller=null;
function normalize(value){return String(value||'').trim().replace(/\s+/g,' ').slice(0,28);}
function setStep(){
 const current=normalize(input.value);
 const ready=Boolean(current&&chosen===current);
 panel.classList.toggle('is-confirmed',ready);
 document.body.classList.toggle('region-needs-choice',!ready);
 state.textContent=ready?'✓ '+current+' 선택 완료 · 이제 장소를 담아보세요':'① 지역을 선택하고 아래 버튼을 눌러주세요.';
 continueBtn.textContent=ready?'이 지역 다시 지도에서 보기':'이 지역으로 여행 시작하기';
 document.querySelectorAll('[data-region-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.regionChoice===current)));
 return ready;
}
function ensureSelected(){
 if(setStep())return true;
 panel.classList.remove('region-attention');void panel.offsetWidth;panel.classList.add('region-attention');
 panel.scrollIntoView({behavior:'smooth',block:'start'});
 input.focus({preventScroll:true});
 app()?.toast?.('여행할 지역을 먼저 골라주세요.');
 return false;
}
async function focusMap(query){
 const region=normalize(query),seq=++token;
 if(controller)controller.abort();
 const known=centers[region];
 if(known){app()?.centerMapAtRegion?.({lat:known[0],lng:known[1]});return true;}
 controller=new AbortController();
 state.textContent=region+' 지도 위치를 찾고 있어요…';
 try{
  const response=await fetch('/api/geocode?q='+encodeURIComponent(region),{signal:controller.signal});
  const data=await response.json();
  if(seq!==token)return false;
  const point=(Array.isArray(data.results)?data.results:[]).find(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  if(response.ok&&point){app()?.centerMapAtRegion?.({lat:point.lat,lng:point.lng});return true;}
  state.textContent='✓ '+region+' 선택 완료 · 지도 위치는 찾지 못했어요.';
  return false;
 }catch(err){
  if(seq!==token||err?.name==='AbortError')return false;
  state.textContent='✓ '+region+' 선택 완료 · 지도를 옮기지 못했어요.';
  return false;
 }finally{if(seq===token)controller=null;}
}
function accept(value){
 const v=normalize(value);
 if(!v){state.textContent='여행할 지역 이름을 적어주세요.';input.focus();return false;}
 input.value=v;
 if(!app()?.setRegion(v)){state.textContent='지역을 선택할 수 없어요. 다시 입력해 주세요.';return false;}
 chosen=v;
 try{localStorage.setItem(choiceKey,v)}catch{}
 input.dispatchEvent(new Event('change',{bubbles:true}));
 setStep();
 void focusMap(v).then(ok=>{if(ok&&normalize(input.value)===v)state.textContent='✓ '+v+' 선택 완료 · 지도에서 확인해 보세요.';});
 app()?.toast?.(v+' 여행 준비가 됐어요. 이제 장소를 담아보세요.');
 return true;
}
continueBtn.addEventListener('click',()=>accept(input.value));
document.querySelectorAll('[data-region-choice]').forEach(b=>b.addEventListener('click',()=>accept(b.dataset.regionChoice)));
input.addEventListener('input',()=>{
 const v=normalize(input.value);
 if(v!==chosen)chosen='';
 setStep();
});
input.addEventListener('keydown',e=>{
 if(e.key==='Enter'){e.preventDefault();accept(input.value);input.blur();}
});
document.addEventListener('trip:days-updated',setStep);
document.addEventListener('trip:stop-added',event=>{const badge=$('place-count');if(badge){badge.classList.remove('yg-count-bounce');void badge.offsetWidth;badge.classList.add('yg-count-bounce');}if(event.detail?.count!=null&&$('search-screen-count'))$('search-screen-count').textContent=event.detail.count+'곳 담음';});
const restore=(()=>{try{return localStorage.getItem(choiceKey)}catch{return null}})();
if(restore===normalize(app()?.getRegion())||app()?.getDays()?.some(d=>d.stops?.length))chosen=normalize(app()?.getRegion());
setStep();
window.YeoRegion={ensureSelected,isReady:()=>setStep(),accept};
})();

