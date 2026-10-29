/** Lightweight region-aware search utilities; no API credentials. */
export const REGIONS=['제주','서울','부산','강릉','경주','속초','여수','전주'];
export function cleanQuery(value){return String(value||'').replace(/https?:\/\/\S+/g,' ').replace(/(?:여기|우리|진짜|이번에)\s*/g,' ').replace(/(?:가보자|갈까|추천해|가고싶다|들르자)[!.?\s]*$/g,'').replace(/\s+/g,' ').trim().slice(0,80);}
export function searchTerms(query,region){const q=cleanQuery(query),r=String(region||'').trim();if(!q)return [];if(!r||q.includes(r)||/^\d{2,4}-\d{2,4}/.test(q))return [q];return [r+' '+q,q];}

export function distanceKm(a,b){
 if(!a||!b)return Infinity;
 const lat1=Number(a.lat),lng1=Number(a.lng),lat2=Number(b.lat),lng2=Number(b.lng);
 if(![lat1,lng1,lat2,lng2].every(Number.isFinite))return Infinity;
 const rad=Math.PI/180,dlat=(lat2-lat1)*rad,dlng=(lng2-lng1)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dlng/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
function addressRegion(address){
 const tokens=String(address||'').trim().split(/\s+/);
 if(tokens.length<2)return {city:'',district:''};
 const city=tokens[0].replace(/(?:특별자치도|특별시|광역시|특별자치시|도|시)$/,'');
 const district=tokens[1];
 return {city,district:/[시군구]$/.test(district)?district:''};
}
export function tripSearchAnchor(day){
 if(!day)return null;
 const usable=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&!/미설정/.test(String(p.name||''));
 const stops=(day.stops||[]).filter(usable);
 const points=stops.length?stops:[day.origin,day.destination].filter(usable);
 if(!points.length)return null;
 // A medoid in the densest local cluster is more reliable than the first stop or
 // a simple average when a multi-city itinerary includes a distant outlier.
 const choice=points.map(p=>{
  const distances=points.map(other=>distanceKm(p,other));
  return {point:p,local:distances.filter(km=>km<=30).length,
   total:distances.filter(km=>km<=30).reduce((sum,km)=>sum+km,0)};
 }).sort((a,b)=>b.local-a.local||a.total-b.total)[0].point;
 return {lat:Number(choice.lat),lng:Number(choice.lng),name:String(choice.name||'여행지'),
  ...addressRegion(choice.roadAddress||choice.address||choice.jibunAddress)};
}
export function isRegionQualified(query){return /(?:^|\s)(?:서울|부산|인천|대구|대전|광주|울산|세종|제주|경기|강원|충북|충남|전북|전남|경북|경남|수원|강릉|경주|속초|여수|전주|포항|춘천|청주|천안|안동|통영|거제|진주|목포|서귀포|제주시)(?:시|도|군|구|특별시|광역시|특별자치도)?(?:\s|$)/.test(String(query||''));}
const compact=t=>cleanQuery(t).replace(/\s/g,'').toLowerCase();
export function searchIntent(query){
 const t=compact(query);
 // Only a station name or an explicit transit word implies a station. Searching
 // "부평역 주차장" must still produce parking, not an unrelated subway station.
 if(/(?:주차장|주차타워|주차|빌라|카페|식당|호텔|웨딩|예식장|아파트|음식점)$/.test(t))return 'generic';
 if(/(?:역|지하철역|전철역|기차역)$/.test(t))return 'subway';
 return 'generic';
}
export function rankResults(items,region,anchor=null,query=''){
 const term=compact(query),intent=searchIntent(query),r=String(region||'').trim();
 const score=item=>{
  const n=compact(item.name),cat=String(item.category||'');
  const group=String(item.categoryGroupCode||item.category_group_code||'');
  const km=distanceKm(anchor,item),hasMatch=Boolean(term&&n.includes(term));
  let value=!term?0:n===term?300:n.startsWith(term)?120:hasMatch?60:-100;
  if(intent==='subway'){
   if(group==='SW8'||/(?:지하철역|전철역|기차역|철도역)/.test(cat))value+=240;
   else if(group==='PK6'||/(?:주차장|주차시설|주차타워)/.test(cat))value-=170;
   else value-=65;
   // Distinguish "부평역 1호선" from "부평역 빌라드마리".
   if(n.startsWith(term)&&/^(?:\d+호선|인천\d+호선|공항철도|경의중앙선|수인분당선|경춘선|경강선)/.test(n.slice(term.length)))value+=65;
  }
  const address=String(item.address||item.roadAddress||'');
  const {city,district}=addressRegion(address);
  if(anchor?.city&&city===anchor.city)value+=26;
  if(anchor?.district&&district===anchor.district)value+=34;
  if(r&&address.includes(r))value+=18;
  if(Number.isFinite(km)){
   if(km<=3)value+=48;
   else if(km<=12)value+=36;
   else if(km<=30)value+=22;
   else if(km<=75)value+=8;
  }
  return value;
 };
 return (Array.isArray(items)?items:[]).map((item,i)=>{
  const km=distanceKm(anchor,item);
  return {...item,_rank:i,_distanceKm:Number.isFinite(km)?km:null,
   _searchScore:score(item),_local:Boolean(r&&String(item.address||'').includes(r))};
 }).sort((a,b)=>b._searchScore-a._searchScore||a._rank-b._rank);
}
export function samePlace(a,b){if(!a||!b)return false;return Boolean(a.sourceId&&b.id&&String(a.sourceId)===String(b.id))||(a.name===b.name&&Number.isFinite(Number(a.lat))&&Number.isFinite(Number(a.lng))&&Math.abs(Number(a.lat)-Number(b.lat))<0.00003&&Math.abs(Number(a.lng)-Number(b.lng))<0.00003);}
export function splitPaste(text){return String(text||'').split(/\r?\n/).map(cleanQuery).filter(Boolean).slice(0,30);}
