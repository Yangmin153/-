import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

function harness({videoFound=false,saveData=false,reduced=false}={}){
 const handlers={};const listeners={};const nodes={};
 const element=id=>({
  hidden:id==='yg-step1-video'||id==='yg-step1-video-toggle',
  dataset:id==='yg-step1-promo'?{videoSrc:'/media/yeohaenggil-step1-guide.mp4'}:{},
  textContent:'',paused:true,src:'',
  addEventListener(event,fn){(listeners[id+':'+event]??=[]).push(fn);},
  pause(){this.paused=true;},
  play(){this.paused=false;this.playCount=(this.playCount||0)+1;return Promise.resolve();},
  removeAttribute(){this.src='';},
  load(){this.loadCount=(this.loadCount||0)+1;if(this.src&&videoFound)for(const cb of listeners['yg-step1-video:loadeddata']||[])cb();}
 });
 for(const id of ['yg-step1-promo','yg-step1-video','yg-step1-video-fallback','yg-step1-video-toggle'])nodes[id]=element(id);
 nodes['yg-step1-video-fallback'].hidden=false;
 const body={dataset:{tripStep:'1'}};
 let observed=null,headCount=0;
 class Observer{constructor(cb){this.callback=cb;}observe(el){observed=this;}}
 const button={addEventListener(){}};
 const doc={body,hidden:false,getElementById:id=>nodes[id],querySelectorAll:()=>[button],addEventListener(event,fn){handlers[event]=fn;}};
 const win={matchMedia:()=>({matches:reduced,addEventListener(){}}),IntersectionObserver:Observer,addEventListener(){}};
 const env={
  document:doc,window:win,navigator:{connection:{saveData}},IntersectionObserver:Observer,
  fetch:async (url,opts)=>{headCount++;assert.equal(url,'/media/yeohaenggil-step1-guide.mp4');assert.equal(opts.method,'HEAD');return {ok:videoFound,headers:{get:()=>videoFound?'video/mp4':'text/html'}};},
  requestAnimationFrame:fn=>fn(),
  console
 };
 return {env,nodes,body,doc,trigger:(visible=true)=>observed.callback([{isIntersecting:visible}]),get headCount(){return headCount;}};
}
async function mount(h){
 const script=await read('public/static/step1-promo.js');
 vm.runInNewContext(script,h.env,{timeout:1000});
 return h;
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};

test('STEP1 keeps its real date form, accessible promo panel, and normal navigation',async()=>{
 const html=await read('public/index.html');
 const before=html.indexOf('id="yg-step1-promo"'),date=html.indexOf('id="yg-start-date"');
 assert.ok(before>0&&date>before);
 for(const id of ['yg-start-date','yg-end-date','yg-next-places','yg-step1-video','yg-step1-video-fallback'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/data-video-src="\/media\/yeohaenggil-step1-guide.mp4"/);
 assert.match(html,/video id="yg-step1-video"[^>]*muted playsinline loop preload="none" hidden/);
 assert.doesNotMatch(html,/video[^>]*src="/);
 assert.match(html,/step1-promo.css\?v=1.0.0/);
 assert.match(html,/step1-promo.js\?v=1.0.0/);
});
test('missing recording falls back without broken video or errors',async()=>{
 const h=await mount(harness());h.trigger(true);await flush();
 assert.equal(h.headCount,1);
 assert.equal(h.nodes['yg-step1-video'].hidden,true);
 assert.equal(h.nodes['yg-step1-video-fallback'].hidden,false);
 assert.equal(h.nodes['yg-step1-video-toggle'].hidden,true);
});
test('available real recording shows video and starts muted playback when visible',async()=>{
 const h=await mount(harness({videoFound:true}));h.trigger(true);await flush();
 assert.equal(h.headCount,1);
 assert.equal(h.nodes['yg-step1-video'].hidden,false);
 assert.equal(h.nodes['yg-step1-video-fallback'].hidden,true);
 assert.equal(h.nodes['yg-step1-video-toggle'].hidden,false);
 assert.ok(h.nodes['yg-step1-video'].playCount>=1);
 h.body.dataset.tripStep='2';h.trigger(false);
 assert.equal(h.nodes['yg-step1-video'].paused,true);
});
test('reduced motion and data saver never force autoplay',async()=>{
 for(const option of [{reduced:true},{saveData:true}]){
  const h=await mount(harness({...option,videoFound:true}));h.trigger(true);await flush();
  assert.equal(h.nodes['yg-step1-video'].hidden,false);
  assert.equal(h.nodes['yg-step1-video'].playCount||0,0);
  assert.equal(h.nodes['yg-step1-video-toggle'].textContent,'영상 재생');
 }
});
test('fallback layout remains compact and does not interfere with STEP2 or STEP3',async()=>{
 const css=await read('public/static/step1-promo.css');
 assert.match(css,/body\[data-trip-step="1"\] #yg-step-one .yg-step1-promo/);
 assert.match(css,/min-height:0!important;justify-content:flex-start!important/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/\.yg-step1-promo \[hidden\]\{display:none!important\}/);
 const html=await read('public/index.html');
 assert.ok(html.indexOf('id="yg-step1-promo"')<html.indexOf('id="yg-step-two-intro"'));
});
