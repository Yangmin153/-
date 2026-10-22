import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('fullscreen search no longer loses results on the input pointerdown',async()=>{
 const ui=await read('public/static/search-screen.js'),quick=await read('public/static/quick-add.js');
 assert.match(ui,/e\.preventDefault\(\);e\.stopPropagation\(\);show\(\)/);
 assert.match(quick,/if\(window\.YeoSearch\?\.isOpen\?\.\(\)\)return/);
 assert.match(ui,/previousFocus!==input/);
 assert.match(ui,/input\.focus\(\{preventScroll:true\}\)/);
});

test('added place shows an accessible success confirmation and updated place count',async()=>{
 const html=await read('public/index.html'),ui=await read('public/static/search-screen.js'),quick=await read('public/static/quick-add.js'),css=await read('public/static/mobile-v49.css');
 assert.match(html,/id="search-screen-feedback" role="status" aria-live="polite"/);
 assert.match(ui,/feedback\.textContent='✓ '\+message/);
 assert.match(ui,/count\.textContent=String\(window\.TripApp\?\.getDay/);
 assert.match(quick,/item\.name\+' 추가 완료 · 총 '\+total/);
 assert.match(css,/search-success-pop/);
 assert.match(css,/\.search-screen-results-mount \.quick-results\{\s*position:static!important;\s*max-height:none!important;/);
 assert.match(quick,/const isFullSearch=Boolean\(window\.YeoSearch\?\.isOpen\?\.\(\)\)/);
});

test('first-time visit has clear search entry points using one fullscreen search',async()=>{
 const html=await read('public/index.html'),ux=await read('public/static/mobile-ux.js'),app=await read('public/static/app.js');
 assert.match(html,/id="quick-add-guide-action"/);
 assert.match(html,/결과에서 <b>추가<\/b>를 누르세요/);
 assert.match(html,/placeholder="여기를 눌러 여행 장소 추가"/);
 assert.match(ux,/guide\.hidden=day\.stops\.length>0/);
 assert.match(ux,/window\.YeoSearch\.show\(\)/);
 assert.match(app,/window\.YeoSearch\.show\(\)/);
});

test('route calculation only changes to results tab after successful response',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/let calculationSucceeded=false/);
 assert.match(app,/dest\.result=result;calculationSucceeded=true/);
 assert.match(app,/if\(calculationSucceeded&&day\(\)\.result&&day\(\)\.id===dayId\)/);
 assert.match(app,/window\.TripUX\?\.switchView\?\.\('map'\)/);
});

