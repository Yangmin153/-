/** Modal-free, continuous place collection; existing itinerary schema stays intact. */
import {cleanQuery,searchTerms,rankResults,samePlace,splitPaste} from './region-search.js';
const $=id=>document.getElementById(id),app=window.TripApp;
const input=$('quick-input'),results=$('quick-results'),form=$('quick-form'),region=$('trip-region');
let selectedPreview=null,timer=null,abort=null,sequence=0,items=[],lastKey='',lastItems=[],dirty=false,feedbackTimer=0;
const cache=new Map(),TTL=25000,LIMIT=24,metrics={requests:0,cacheHits:0,aborts:0,latencies:[],renderCount:0};
function setMessage(text,retry=false){results.replaceChildren();const node=document.createElement('div');node.className='quick-result-message';node.textContent=text;if(retry){const b=document.createElement('button');b.textContent='다시 검색';b.type='button';b.addEventListener('click',()=>search(true));node.append(document.createElement('br'),b);}results.append(node);results.hidden=false;}
function syncRegion(){const v=app.getRegion();region.value=v;$('quick-region-label').textContent=v;}
function sync(){syncRegion();const disabled=$('btn-route').disabled;$('mobile-route').disabled=disabled;$('mobile-route').textContent=disabled?'동선 계산 중…':app.getDay().mode==='manual'?'이 순서로 계산하고 지도 보기':'동선 자동 정리하고 지도 보기';}
function setDirty(value){dirty=Boolean(value);document.body.classList.toggle('trip-route-dirty',dirty);}
function adjustViewport(){const viewport=w���q�^