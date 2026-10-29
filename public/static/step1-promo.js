/* STEP 1 real-screen recording slot. No synthetic footage or mandatory video dependency. */
(function(){
 'use strict';
 const panel=document.getElementById('yg-step1-promo');
 const video=document.getElementById('yg-step1-video');
 const fallback=document.getElementById('yg-step1-video-fallback');
 const toggle=document.getElementById('yg-step1-video-toggle');
 if(!panel||!video||!fallback||!toggle)return;
 const src=panel.dataset.videoSrc;
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 const saveData=Boolean(navigator.connection?.saveData);
 let sourceChecked=false,available=false,loaded=false,userPaused=false,inView=false;
 const onStepOne=()=>document.body.dataset.tripStep==='1';
 function pause(){if(!video.paused)video.pause();}
 function sync(){
  if(!available||!loaded){toggle.hidden=true;return;}
  const shouldPlay=inView&&onStepOne()&&!document.hidden&&!reducedMotion?.matches&&!saveData&&!userPaused;
  if(!shouldPlay){pause();toggle.textContent='영상 재생';return;}
  const result=video.play();
  if(result?.catch)result.catch(()=>{pause();toggle.textContent='영상 재생';});
  toggle.textContent='일시정지';
 }
 function useFallback(){
  available=false;loaded=false;video.hidden=true;fallback.hidden=false;toggle.hidden=true;
  pause();video.removeAttribute('src');video.load();
 }
 video.addEventListener('error',useFallback);
 video.addEventListener('loadeddata',()=>{
  loaded=true;video.hidden=false;fallback.hidden=true;
  toggle.hidden=false;
  sync();
 });
 video.addEventListener('pause',()=>{if(loaded)toggle.textContent='영상 재생';});
 video.addEventListener('playing',()=>{if(loaded)toggle.textContent='일시정지';});
 toggle.addEventListener('click',()=>{
  if(!loaded)return;
  userPaused=!video.paused;
  if(!video.paused){userPaused=true;pause();}
  else {userPaused=false;const p=video.play();if(p?.catch)p.catch(()=>{userPaused=true;pause();});}
 });
 async function checkSource(){
  if(sourceChecked||!src||!onStepOne())return;
  sourceChecked=true;
  try{
   const response=await fetch(src,{method:'HEAD',cache:'no-cache'});
   const mime=(response.headers.get('content-type')||'').toLowerCase();
   if(!response.ok||(mime&&!(mime.startsWith('video/')||mime.startsWith('application/octet-stream'))))return;
   available=true;
   // Attach media only when the actual recording exists.
   video.src=src;
   video.load();
  }catch{
   // Missing/blocked video is optional: the static explanation remains visible.
  }
 }
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
   inView=Boolean(entries[0]?.isIntersecting);
   if(inView)void checkSource();
   sync();
  },{threshold:.1});
  observer.observe(panel);
 }else{inView=true;void checkSource();}
 document.addEventListener('visibilitychange',sync);
 document.querySelectorAll('[data-yg-step]').forEach(button=>
  button.addEventListener('click',()=>requestAnimationFrame(()=>{if(onStepOne())void checkSource();sync();})));
 reducedMotion?.addEventListener?.('change',sync);
 window.addEventListener('pageshow',sync);
 // A paused/failed clip must never block the date selectors or the next-step CTA.
})();
