/** Shared iOS/Android background scroll lock for overlays and dialogs. */
(function(root){
 'use strict';
 const owners=new Set();let snapshot=null;
 const doc=()=>root.document;
 function lock(owner){
  if(!owner||owners.has(owner))return;
  const d=doc();if(!d)return;
  if(!owners.size){
   const body=d.body,html=d.documentElement;
   snapshot={y:root.scrollY||0,
    bodyPosition:body.style.position,bodyTop:body.style.top,
    bodyLeft:body.style.left,bodyRight:body.style.right,
    bodyWidth:body.style.width,bodyOverflow:body.style.overflow,
    htmlOverflow:html.style.overflow,htmlScrollBehavior:html.style.scrollBehavior};
   body.style.position='fixed';body.style.top='-'+snapshot.y+'px';
   body.style.left='0';body.style.right='0';body.style.width='100%';
   body.style.overflow='hidden';html.style.overflow='hidden';
  }
  owners.add(owner);
 }
 function unlock(owner){
  if(!owners.delete(owner)||owners.size)return;
  const saved=snapshot;snapshot=null;
  if(!saved)return;
  const body=doc().body,html=doc().documentElement;
  body.style.position=saved.bodyPosition;body.style.top=saved.bodyTop;
  body.style.left=saved.bodyLeft;body.style.right=saved.bodyRight;
  body.style.width=saved.bodyWidth;body.style.overflow=saved.bodyOverflow;
  html.style.overflow=saved.htmlOverflow;
  // Override site-wide smooth scrolling for exact restoration; restore original style.
  const prev=html.style.scrollBehavior;html.style.scrollBehavior='auto';
  try{root.scrollTo({top:saved.y,behavior:'instant'});}
  finally{html.style.scrollBehavior=saved.htmlScrollBehavior;}
 }
 function active(){return owners.size>0;}
 root.YGScrollLock=Object.freeze({lock,unlock,active});
})(globalThis);
