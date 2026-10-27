import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('GPS button is directly below STEP3 result map and before route metrics, not STEP2',async()=>{
 const html=await read('public/index.html');
 const at=x=>html.indexOf('id="'+x+'"');
 assert.ok(at('map-region')<at('yg-live-controls')&&at('yg-live-controls')<at('route-results'));
 assert.match(html,/id="yg-live-optimize"/);
 assert.match(html,/src="\/static\/live-route\.js\?v=7\.2\.1"/);
 assert.match(html,/id="yg-live-reset"[^>]*hidden/);
 assert.doesNotMatch(html,/방문 완료/);
});
test('current position is requested only on user action and is used as origin of a real route request',async()=>{
 const src=await read('public/static/live-route.js');
 assert.match(src,/navigator\.geolocation\.getCurrentPosition\(/);
 assert.match(src,/enableHighAccuracy:true,timeout:12000/);
 assert.match(src,/mode:'auto',departure/);
 assert.match(src,/fetch\('\/api\/route'/);
 assert.match(src,/body:JSON\.stringify\(body\)/);
 assert.match(src,/app\(\)\.applyLiveRoute\(id,gps,route\)/);
 assert.match(src,/root\.TripNavigation\?\.open\?\.\(\)/);
 assert.doesNotMatch(src,/completedStops|visitedStops|markVisited|autoComplete/);
});
test('original planned stops, origin and route are preserved separately from the live computed route',async()=>{
 const app=await read('public/static/app.js');
 assert.match(app,/const liveRoutes=new Map\(\)/);
 assert.match(app,/liveRoutes\.set\(d\.id,\{originalRoute:d\.result\}\)/);
 assert.match(app,/d\.liveOrigin=structuredClone\(gps\)/);
 assert.match(app,/d\.result=\{\.\.\.route,isLiveRoute:true\}/);
 assert.match(app,/d\.result=old\.originalRoute/);
 assert.match(app,/function restorePlannedRoute/);
 assert.match(app,/liveRoutes\.clear\(\)/);
});
test('NAVER and Kakao navigation respect temporary live GPS as route start and sorted saved visits',async()=>{
 const [navi,app]=await Promise.all([read('public/static/navigation.js'),read('public/static/app.js')]);
 assert.match(navi,/const expectedOrigin=day\.liveOrigin\|\|day\.origin/);
 assert.match(navi,/return \[\.\.\.visits,currentDestination\]/);
 assert.match(app,/\[d\.liveOrigin\|\|d\.origin,\.\.\.sorted,d\.destination\]/);
});
test('auth user can save and reopen calculated route as well as dates and visits',async()=>{
 const [app,account,server,html]=await Promise.all([
  read('public/static/app.js'),read('public/static/accounts.js'),read('lib/trips.js'),read('public/index.html')]);
 assert.match(app,/function exportCloudDays\(\)/);
 assert.match(app,/const \{liveOrigin,result,\.\.\.rest\}=d/);
 assert.match(app,/output\.result=structuredClone\(original\)/);
 assert.match(app,/function validSavedRoute\(d\)/);
 assert.match(app,/clean\.result=validSavedRoute\(clean\)/);
 assert.match(account,/app\(\)\.exportCloudDays\?\.\(\)/);
 assert.match(account,/app\(\)\.importDays\(trip\.days\)/);
 assert.match(account,/window\.YeoNext\.go\(3\)/);
 assert.match(account,/id="yg-route-save"|\$\('yg-route-save'\)/);
 assert.match(server,/750000/);
 assert.match(html,/id="yg-route-save"/);
 assert.match(html,/id="yg-route-load"/);
});

test('Vercel trip route passes actual environment rather than platform execution context',async()=>{
 const entry=await read('api/trips.js');
 assert.match(entry,/const route=request=>handleTrips\(request,process\.env\)/);
 assert.doesNotMatch(entry,/GET=handleTrips/);
});
