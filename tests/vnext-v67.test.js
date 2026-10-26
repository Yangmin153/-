import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('STEP3 route-day picker uses a visible mobile button and preserves one hidden original select',async()=>{
 const [html,workspace]=await Promise.all([read('public/index.html'),read('public/static/map-workspace.js')]);
 for(const id of ['yg-result-day-toggle','yg-result-day-label','yg-result-day-menu','map-day-select'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.equal((html.match(/id="map-day-select"/g)||[]).length,1);
 assert.match(workspace,/function renderDatePicker\(\)/);
 assert.match(workspace,/app\(\)\.setActive\(value\)/);
 assert.match(workspace,/native\.value=String\(active\)/);
 assert.match(workspace,/menu\.querySelectorAll\('\[data-result-day\]'\)/);
});
test('picker closes after date selection, with Escape, outside click and keyboard arrows',async()=>{
 const workspace=await read('public/static/map-workspace.js');
 assert.match(workspace,/closeDateMenu\(\);app\(\)\.setActive\(value\)/);
 assert.match(workspace,/if\(e\.key==='Escape'\)/);
 assert.match(workspace,/if\(e\.key==='ArrowDown'\|\|e\.key==='ArrowUp'\)/);
 assert.match(workspace,/e\.target\.closest\('#yg-result-date'\)/);
});
test('mobile route picker CSS ignores legacy native select styling and keeps menu above timeline',async()=>{
 const css=await read('public/static/vnext.css');
 assert.match(css,/#yg-result-day-menu\[hidden\]\{display:none!important\}/);
 assert.match(css,/#map-day-select\.yg-result-day-native/);
 assert.match(css,/min-height:48px/);
 assert.match(css,/z-index:1000/);
});
test('Google Kakao buttons only appear when reported enabled by Supabase public settings',async()=>{
 const [html,auth]=await Promise.all([read('public/index.html'),read('public/static/accounts.js')]);
 for(const p of ['google','kakao'])assert.match(html,new RegExp('data-oauth-provider="'+p+'"'));
 assert.match(auth,/settings\.external\?\.google===true/);
 assert.match(auth,/settings\.external\?\.kakao===true/);
 assert.match(auth,/\$\('account-oauth-google'\)\.hidden=!google/);
 assert.match(auth,/\$\('account-oauth-kakao'\)\.hidden=!kakao/);
 assert.match(auth,/if\(!enabledOAuth\[provider\]\)throw Error/);
});
test('OAuth uses Supabase Auth PKCE compatible client and browser return URL, never exposes client secrets',async()=>{
 const auth=await read('public/static/accounts.js');
 assert.match(auth,/api\.auth\.signInWithOAuth\(\{/);
 assert.match(auth,/provider,options:\{redirectTo:location\.origin\+location\.pathname\}/);
 assert.match(auth,/persistSession:true,autoRefreshToken:true,detectSessionInUrl:true/);
 assert.doesNotMatch(auth,/client_secret|service_role|sb_secret_/);
});
