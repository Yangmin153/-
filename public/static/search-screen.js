/** Fullscreen mobile place collection. The same form/results DOM is reused, so requests are not duplicated. */
const $=id=>document.getElementById(id);
const screen=$('search-screen'),form=$('quick-form'),results=$('quick-results'),input=$('quick-input'),original=$('mobile-bottom-actions');
let opened=false,historyEntry=false;
function mobile(){return matchMedia('(max-width: 768px)').matches}
function updateSize(){
 const viewport=window.visualViewport;
 const visible=viewport?viewport.height:innerHeight;
 screen.style.setProperty('--search-height',Math.round(visible)+'px');
 screen.style.setProperty('--search-top',Math.round(viewport?.offsetTop||0)+'px');
}
function show(){
 if(opened||!mobile())return;
 opened=true;historyEntry=true;
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
 if(!fromPopstate&&historyEntry&&history.state?.yeohaenggilSearch)history.back();
 historyEntry=false;
 $('mobile-route').focus({preventScroll:true});
}
function addSuccess(message){
 if(!opened)return;
 $('search-screen-feedback').textContent=message;
 input.focus({preventScroll:true});
}
function init(){
 input.addEventListener('pointerdown',e=>{if(!opened&&mobile()){e.preventDefault();show()}});
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

