import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Exercise the real search controller against a minimal DOM, without network APIs.
async function controller(){
 const nodes=new Map(),listeners=new Map(),classes=new Set();
 let cancelled=0,back=0;
 const document={activeElement:null,body:{classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)}},addEventListener:(name,fn)=>listeners.set(name,fn),getElementById:id=>node(id)};
 function node(id){
  if(nodes.has(id))return nodes.get(id);
  const el={id,hidden:true,isConnected:true,textContent:'',style:{setProperty(){}},classList:{add(){},remove(){}},addEventListener(name,fn){this[name]=fn},append(){},insertBefore(){},querySelector:s=>node(s.slice(1)),focus(){document.activeElement=this},blur(){document.activeElement=null}};
  nodes.set(id,el);return el;
 }
 const media={matches:true,addEventListener(name,fn){this[name]=fn}};
 const history={state:null,pushState(s){this.state=s},back(){back++;this.state=null}};
 const window={TripApp:{getDay:()=>({stops:[{},{}]}),getRegion:()=> '제주'},TripQuickAdd:{closeSearch(){cancelled++;classes.delete('quick-search-active')}},addEventListener:(name,fn)=>listeners.set(name,fn)};
 const sandbox={document,window,history,location:{href:'https://example.test/'},matchMedia:()=>media,innerHeight:844,requestAnimationFrame:fn=>fn(),setTimeout,clearTimeout};
 vm.runInNewContext(await readFile(new URL('../public/static/search-screen.js',import.meta.url),'utf8'),sandbox);
 return {api:window.YeoSearch,node,classes,listeners,media,counts:()=>({cancelled,back})};
}
test('completion closes search, cancels pending search and restores calculation controls',async()=>{
 const c=await controller();c.api.show();c.classes.add('quick-search-active');
 assert.equal(c.api.isOpen(),true);
 assert.equal(c.node('search-screen-count').textContent,'2곳 · 완료');
 c.node('search-screen-count').onclick();
 assert.equal(c.api.isOpen(),false);
 assert.equal(c.node('search-screen').hidden,true);
 assert.equal(c.classes.has('quick-search-active'),false);
 assert.deepEqual(c.counts(),{cancelled:1,back:1});
 c.api.hide();assert.equal(c.counts().cancelled,1);
});
test('browser back closes search without navigating back twice',async()=>{
 const c=await controller();c.api.show();c.listeners.get('popstate')();
 assert.equal(c.api.isOpen(),false);
 assert.deepEqual(c.counts(),{cancelled:1,back:0});
});
test('switching to desktop releases the fullscreen search',async()=>{
 const c=await controller();c.api.show();c.media.change({matches:false});
 assert.equal(c.api.isOpen(),false);assert.equal(c.counts().cancelled,1);
});
