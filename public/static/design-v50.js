/** Travel design interactions: region shortcuts, beginner guidance and add feedback. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const app=()=>window.TripApp;
 const region=$('trip-region'),recommendations=$('region-shortcuts');
 if(!region||!recommendations)return;
 const buttons=()=>[...recommendations.querySelectorAll('[data-region-choice]')];
 const paintRegion=()=>buttons().forEach(button=>{
   const chosen=region.value.trim()===button.dataset.regionChoice;
   button.classList.toggle('is-selected',chosen);
   button.setAttribute('aria-pressed',String(chosen));
 });
 recommendations.addEventListener('click',event=>{
   const button=event.target.closest('[data-region-choice]');
   if(!button)return;
   const choice=button.dataset.regionChoice;
   region.value=choice;
   const changed=app()?.setRegion(choice);
   if(changed){paintRegion();app()?.toast?.(choice+' 여행으로 바꿨어요. 기존 장소는 그대로 있어요.');}
 });
 region.addEventListener('change',paintRegion);
 region.addEventListener('input',paintRegion);
 document.addEventListener('trip:stop-added',event=>{
   const badge=$('place-count');
   if(badge){
     badge.classList.remove('yg-count-bounce');
     void badge.offsetWidth;
     badge.classList.add('yg-count-bounce');
   }
   const regionIndicator=$('search-screen-count');
   if(regionIndicator&&event.detail?.count!=null)regionIndicator.textContent=event.detail.count+'곳 담음';
 });
 paintRegion();
})();

