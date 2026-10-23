import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('v5.2 origin/destination searches have one search tab with no popularity or suggestions',async()=>{
 const html=await read('public/index.html'),app=await read('public/static/app.js');
 assert.match(html,/data-modal-tab="place"/);
 assert.doesNotMatch(html,/추천 장소|많이 찾는 장소|id="modal-example"|id="preset-list"|id="search-suggestions"/);
 assert.doesNotMatch(app,/\$\('search-suggestions'\)|\$\('preset-list'\)/);
 assert.match(html,/id="btn-pick-map-primary"/);
 assert.match(app,/\$\('btn-pick-map-primary'\)\.addEventListener\('click',startMapPick\)/);
});

test('v5.2 map-only tab hides region selection while itinerary editor still contains it',async()=>{
 const css=await read('public/static/design-v52.css'),html=await read('public/index.html');
 assert.match(css,/body\[data-mobile-view="map"\] \.region-onboarding\{display:none!important\}/);
 assert.match(html,/class="region-onboarding"/);
 assert.match(html,/내 여행길 보기/);
});

test('v5.2 search rows are compact, scroll independently and respond to the visible viewport',async()=>{
 const css=await read('public/static/design-v52.css'),app=await read('public/static/app.js'),html=await read('public/index.html');
 assert.match(html,/design-v52\.css/);
 assert.match(css,/\.place-results\{flex:1;min-height:92px;max-height:none!important;overflow-y:auto/);
 assert.match(css,/\.place-hit-main\{display:flex;align-items:center/);
 assert.match(css,/\.modal-body\{min-height:0;flex:1;display:flex;flex-direction:column;overflow:hidden/);
 assert.match(css,/--yg-place-viewport-height/);
 assert.match(app,/function syncModalViewport\(\)/);
 assert.match(app,/window\.visualViewport\?\.addEventListener\('resize',syncModalViewport\)/);
});

test('v5.2 guard against saving a stale selection after query or scope change',async()=>{
 const js=await read('public/static/app.js');
 assert.match(js,/if\(state\.modal\.searchPendingSelection\)return toast/);
 assert.match(js,/state\.modal\.searchPendingSelection=Boolean\(query\)/);
 assert.match(js,/state\.modal\.searchPendingSelection=true;\$\('btn-modal-save'\)\.disabled=true/);
 assert.match(js,/state\.modal\.searchPendingSelection=false;\$\('btn-modal-save'\)\.disabled=false/);
 assert.match(js,/state\.modal\.selectedAddress=null;state\.modal\.searchPendingSelection=false/);
 assert.match(js,/\$\('input-name'\)\.value='';\$\('modal-name-details'\)\.open=true/);
});

test('v5.2 main application script has valid JavaScript syntax',()=>{
 const path=new URL('../public/static/app.js',import.meta.url);
 assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',path.pathname],{stdio:'pipe'}));
});
