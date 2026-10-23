/** Fullscreen mobile place collection. The same form/results DOM is reused, so requests are not duplicated. */
const $=id=>document.getElementById(id);
const screen=$('search-screen'),form=$('quick-form'),results=$('quick-results'),input=$('quick-input'),original=$('mobile-bottom-actions');
const count=$('search-screen-count'),feedback=$('search-screen-feedback');
let feedbackTimer=null;
let opened=false,historyEntry=false,previousFocus=null;
function mobile(){return matchMedia('(max-width: 768px)').matches}
function updateSize(){
 const viewport=window.visualViewport;
 const visible=viewport?viewport.height:innerHeight;
 screen.style.setProperty('--search-height',Math.round(visible)+'px');
 screen.style.setProperty('--search-top',Math.round(viewport?.offsetTop||0)+'px');
}
function show(){
 if(opened)return; // Reuse the same streamlined search for desktop bag mode, too.
 if(window.YeoRegion&&!window.YeoRegion.ensureSelected())return;
 opened=true;historyEntry=true;previousFocus=document.activeElement===input?$('mobile-route'):document.activeElement;
 feedback.hidden=true;feedback.textContent='';
 count.textContent=String(window.TripApp?.getDay?.()?.stops?.length||0)+'곳 담음';
 $('search-screen-region').textContent=window.TripApp?.getRegion?.()+' · 장소 검색';
 screen.hidden=false;
 screen.querySelector('#search-screen-form-mount').append(form);
 screen.querySelector('#search-screen-results-mount').append(results);
 document.body.classList.add('search-open');
 updateSize();
 history.pushState({...history.state,yeohaenggilSearch:true},'',location.href);
 requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function hide(fromPopstate=false){
 if(!opened)return;
 opened=false;
 document.body.classList.remove('search-open');
 original.insertBefore(results,original.firstChild);
 original.insertBefore(form,$('quick-feedback'));
 screen.hidden=true;
 input.blur();results.hidden=true;
 clearTimeout(feedbackTimer);feedback.hidden=true;
 if(!fromPopstate&&historyEntry&&history.state?.yeohaenggilSearch)history.back();
 historyEntry=false;
 (previousFocus?.isConnected&&previousFocus!==input?previousFocus:$('mobile-route'))?.focus({preventScroll:true});
}
function addSuccess(message){
 if(!opened)return;
 clearTimeout(feedbackTimer);
 feedback.textContent='✓ '+message;
 feedback.hidden=false;
 feedback.classList.remove('search-success-pop');
 void feedback.offsetWidth;
 feedback.classList.add('search-success-pop');
 count.textContent=String(window.TripApp?.getDay?.()?.stops?.length||0)+'곳 담음';
 feedbackTimer=setTimeout(()=>{feedback.hidden=true;feedback.classList.remove('search-success-pop');},3300);
 requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function init(){
 input.addEventListener('pointerdown',e=>{if(!opened&&mobile()){e.preventDefault();e.stopPropagation();show()}});
 input.addEventListener('focus',()=>{if(!opened&&mobile())show()});
 $('search-screen-back').onclick=()=>hide();
 window.addEventListener('popstate',()=>{if(opened)hide(true)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.stopPropagation();hide()}});
 window.visualViewport?.addEventListener('resize',updateSize);
 window.visualViewport?.addEventListener('scroll',updateSize);
 window.addEventListener('orientationchange',updateSize);
}
window.YeoSearch={isOpen:()=>opened,show,hide,addSuccess};
init();

