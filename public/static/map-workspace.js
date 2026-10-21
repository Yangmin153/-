/** Map-first workspace, day switch, sheet, and map gesture controls. */
(function(){'use strict';const $=id=>document.getElementById(id);const app=()=>window.TripApp;let fullscreen=false,sheetOpen=false;
const media=window.matchMedia('(max-width: 768px)');
function days(){return app()?.getDays()||[];}
function current(){return app()?.getDay();}
function render(){const d=current();if(!d)return;
 $('map-day-select').innerHTML=days().map((day,i)=>`<option value="${i}" ${i===app().getActive()?'selected':''}>${i+1}일 차</option>`).join('');
 const stops=d.result?.orderIds?.length?d.result.orderIds.map(id=>d.stops.find(x=>x.id===id)).filter(Boolean):d.stops;
 const places=[d.origin,...stops,d.destination];
 $('map-sheet-list').innerHTML=places.map((p,i)=>`<button class="map-sheet-place" type="button" data-map-place="${escapeHTML(p.id)}"><span class="map-sheet-order">${i===0?'S':i===places.length-1?'E':i}</span><span class="map-sheet-place-name">${escapeHTML(p.name)}</span><span class="map-sheet-category">${i===0?'출발':i===places.length-1?'도착':window.TripMeta.meta(p).label}</span></button>`).join('');
 const locked=Boolean(window.__tripMapLocked);$('map-lock').textContent=locked?'잠금 해제':'지도 잠금';$('map-lock').setAttribute('aria-pressed',String(locked));
 $('map-maximize').textContent=fullscreen?'축소 보기':'전체 화면';$('map-maximize').setAttribute('aria-pressed',String(fullscreen));
 $('map-sheet-toggle').setAttribute('aria-expanded',String(sheetOpen));$('map-sheet').classList.toggle('is-open',sheetOpen);
}
function escapeHTML(t){return String(t||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
function resize(){requestAnimationFrame(()=>{app()?.resizeMap();});}
function lock(next){window.__tripMapLocked=next;app()?.setMapLocked(next);render();}
function expanded(next){fullscreen=next;document.body.classList.toggle('map-immersive',next);$('map-full-close').hidden=!next;if(next){sheetOpen=false;render();}resize();}
function mapPlace(id){if(!id)return;sheetOpen=false;render();app()?.focusPlace(id);}
function initialize(){if(!app())return;
 window.__tripMapLocked=media.matches;app().setMapLocked(media.matches);
 const fit=()=>app()?.fitMap();$('map-fit-overlay').addEventListener('click',fit);
 $('map-lock').addEventListener('click',()=>lock(!window.__tripMapLocked));
 $('map-maximize').addEventListener('click',()=>expanded(!fullscreen));$('map-full-close').addEventListener('click',()=>expanded(false));
 $('btn-sidebar-toggle').addEventListener('click',()=>{const isCollapsed=document.body.classList.toggle('sidebar-collapsed');$('btn-sidebar-toggle').textContent=isCollapsed?'목록 열기':'목록 접기';$('btn-sidebar-toggle').setAttribute('aria-pressed',String(isCollapsed));resize();});
 $('map-day-select').addEventListener('change',e=>app().setActive(Number(e.target.value)));
 $('map-sheet-toggle').addEventListener('click',()=>{sheetOpen=!sheetOpen;render();resize();});
 $('map-sheet-list').addEventListener('click',e=>{const btn=e.target.closest('[data-map-place]');if(btn)mapPlace(btn.dataset.mapPlace);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&fullscreen)expanded(false)});
 media.addEventListener?.('change',()=>{if(!fullscreen)lock(media.matches);resize()});
 window.MapWorkspace={refresh:render};render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize);else initialize();
})();
