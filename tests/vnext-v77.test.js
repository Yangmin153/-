import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rankResults} from '../public/static/region-search.js';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const place=(id,name,lat,lng)=>({id,name,lat,lng,address:'대한민국'});
test('nationwide search ranks exact name higher than a geographically close unrelated shop',()=>{
 const anchor={lat:37.57,lng:126.98};
 const nearby=place('1','하림각제과점',37.58,126.97);
 const exact=place('2','하림각',35.17,129.07);
 const found=rankResults([nearby,exact],'',anchor,'하림각');
 assert.equal(found[0].id,'2');
});
test('identical nationwide business names prefer a nearby result without excluding remote names',()=>{
 const anchor={lat:37.57,lng:126.98};
 const far=place('remote','하림각',35.17,129.07),near=place('near','하림각',37.57,126.99);
 const sorted=rankResults([far,near],'',anchor,'하림각');
 assert.deepEqual(sorted.map(p=>p.id),['near','remote']);
});
test('quick search does not send distance restriction and loads additional nationwide page',async()=>{
 const script=await read('public/static/quick-add.js');
 assert.match(script,/new URLSearchParams\(\{q:term,page:String\(page\)\}\)/);
 assert.doesNotMatch(script,/params\.set\('bias'/);
 assert.doesNotMatch(script,/params\.set\('nearby'/);
 assert.match(script,/if\(first\.hasNext\)/);
 assert.match(script,/request\(q,signal,2\)/);
 assert.match(script,/next\.slice\(0,30\)/);
});
test('map mode styles are scoped to bottom dock, never full-screen search',async()=>{
 const [oldCss,css,html]=await Promise.all(['public/static/mobile-v49.css','public/static/vnext.css','public/index.html'].map(read));
 assert.doesNotMatch(oldCss,/body\[data-mobile-view="map"\] \.quick-results\{display:flex!important/);
 assert.match(oldCss,/body\[data-mobile-view="map"\] \.mobile-bottom-actions \.quick-results/);
 assert.match(css,/body\.search-open #search-screen #search-screen-results-mount #quick-results/);
 assert.match(css,/display:block!important;position:static!important/);
 assert.match(css,/overflow-y:auto!important;overflow-x:hidden!important/);
 assert.match(html,/quick-add\.js\?v=7\.7\.0/);
});
test('full screen search freezes unrelated underlying UI and restores previous inert state',async()=>{
 const js=await read('public/static/search-screen.js');
 assert.match(js,/function lockBackground\(\)/);
 assert.match(js,/backgroundInert\.push\(\[node,node\.inert\]\);node\.inert=true/);
 assert.match(js,/function unlockBackground\(\)/);
 assert.match(js,/node\.inert=prior/);
 assert.match(js,/YGScrollLock\?\.lock\('search-screen'\)/);
 assert.match(js,/YGScrollLock\?\.unlock\('search-screen'\)/);
 assert.match(js,/touchmove/);
 assert.match(js,/passive:false,capture:true/);
});
