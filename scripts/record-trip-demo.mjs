/**
 * Capture real Yeohaenggil browser interaction (no simulated maps, results or routes).
 * Run: YG_DEMO_URL=https://... node scripts/record-trip-demo.mjs
 * Requires: npm install --no-save playwright; npx playwright install chromium
 *
 * Uses an anonymous guest itinerary. If live place search or routing fails,
 * the recording fails rather than falsely portraying an unavailable feature.
 */
import { chromium } from 'playwright';
import { mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const base=process.env.YG_DEMO_URL || 'https://yeohaenggil-7ncxh7xzb-travel-alex.vercel.app/';
const output=process.env.YG_DEMO_OUTPUT || 'public/media/yeohaenggil-step1-guide.mp4';
const work=process.env.RUNNER_TEMP || '/tmp';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const ctx=await browser.newContext({
  viewport:{width:960,height:540},deviceScaleFactor:1,
  locale:'ko-KR',timezoneId:'Asia/Seoul',
  reducedMotion:'reduce',
  recordVideo:{dir:path.join(work,'yg-capture'),size:{width:960,height:540}}
});
const page=await ctx.newPage();
let rawVideo;
const sleep=ms=>page.waitForTimeout(ms);
const at=async selector=>page.locator(selector).first().waitFor({state:'visible',timeout:20000});
const checkpoints=[];
async function record(label,ms=500){
  checkpoints.push({label,at:new Date().toISOString()});
  console.log('CAPTURE:',label);
  await sleep(ms);
}
async function searchAndAdd(name,kind='stop'){
  const open=kind==='stop'?'#yg-add-visit':kind==='origin'?'#yg-origin-pick':'#yg-dest-pick';
  await page.locator(open).click();
  await at('#quick-input');
  await page.locator('#quick-input').fill(name);
  await page.locator('#quick-input').press('Enter');
  await at('#quick-results .quick-direct-add');
  await record(name+' 검색 결과',650);
  const result=page.locator('#quick-results .quick-result-row').filter({hasText:name}).first();
  const choose=await result.count()?result:page.locator('#quick-results .quick-result-row').first();
  await choose.locator('.quick-direct-add').click();
  if(kind==='stop'){
    await record(name+' 방문지 담기',850);
  }else{
    await at('#search-picked-add');
    await page.locator('#search-picked-add').click();
    await record(kind+' 설정',650);
  }
  if(await page.locator('#search-screen').isVisible())await page.locator('#search-screen-back').click();
  await sleep(300);
}
try{
  console.log('Opening live Preview:',base);
  const response=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  if(!response||response.status()>=400)throw new Error('Preview HTTP '+(response?.status()??'no response'));
  const t=await page.title();
  if(/Authentication Required|Vercel Authentication|Login to Vercel|Deployment Protection/i.test(t))throw new Error('Preview requires authentication; cannot record public user flow.');
  await at('#yg-start-date');
  await record('여행길 첫 화면',750);
  await page.locator('#yg-start-date').fill('2026-11-03');
  await page.locator('#yg-end-date').fill('2026-11-03');
  await sleep(450);
  await page.locator('#yg-next-places').click();
  await page.waitForFunction(()=>document.body.dataset.tripStep==='2',{timeout:15000});
  await record('여행 일정 설정',700);

  await searchAndAdd('경복궁');
  await searchAndAdd('북촌한옥마을');
  await searchAndAdd('광화문광장');
  await record('방문지 세 곳 담기',750);
  await searchAndAdd('광화문광장','origin');
  await searchAndAdd('서울역','destination');
  await page.locator('#yg-calculate').click();
  await page.waitForFunction(()=>document.body.dataset.tripStep==='3',{timeout:70000});
  await record('최적화된 동선과 지도',1600);
  console.log('LIVE_ROUTE_SUCCESS',await page.locator('body').getAttribute('data-trip-step'));
}catch(error){
  console.error('LIVE_CAPTURE_FAILED',error?.stack||String(error));
  await page.screenshot({path:path.join(work,'yg-capture-error.png'),fullPage:false}).catch(()=>{});
  process.exitCode=1;
}finally{
  rawVideo=await page.video()?.path().catch(()=>null);
  await ctx.close().catch(()=>{});
  await browser.close().catch(()=>{});
  console.log('CHECKPOINTS',JSON.stringify(checkpoints));
}
if(process.exitCode)process.exit(process.exitCode);
if(!rawVideo)throw new Error('No actual browser recording was captured.');
await mkdir(path.dirname(output),{recursive:true});
const ff=spawnSync('ffmpeg',[
  '-hide_banner','-loglevel','error','-y',
  '-i',rawVideo,'-vf','fps=15,scale=900:506:flags=lanczos,crop=900:400:0:53,setpts=0.70*(PTS-STARTPTS)',
  '-t','18','-an','-c:v','libx264','-crf','31','-preset','veryfast',
  '-pix_fmt','yuv420p','-movflags','+faststart',output
],{encoding:'utf8'});
if(ff.status!==0)throw new Error('ffmpeg transcode failed: '+ff.stderr);
console.log('VIDEO_CREATED',output);
