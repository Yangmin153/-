/** Lightweight region-aware search utilities; no API credentials. */
export const REGIONS=['제주','서울','부산','강릉','경주','속초','여수','전주'];
export function cleanQuery(value){return String(value||'').replace(/https?:\/\/\S+/g,' ').replace(/(?:여기|우리|진짜|이번에)\s*/g,' ').replace(/(?:가보자|갈까|추천해|가고싶다|들르자)[!.?\s]*$/g,'').replace(/\s+/g,' ').trim().slice(0,80);}
export function searchTerms(query,region){const q=cleanQuery(query),r=String(region||'').trim();if(!q)return [];if(!r||q.includes(r)||/^\d{2,4}-\d{2,4}/.test(q))return [q];return [r+' '+q,q];}

export function tripSearchAnchor(day){
 if(!day)return null;
 const usable=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&!/미설정/.test(String(p.name||''));
 const points=[...(day.stops||[]).filter(usable),day.origin,day.destination].filter(usable);
 if(!points.length)return null;
 // Anchor to collected locations, rather than an unrelated nationwide/default map center.
 const focus=points[0];return {lat:Number(focus.lat),lng:Number(focus.lng),name:String(focus.name||'여행지')};
}
export function distanceKm(a,b){
 if(!a||!b)return Infinity;
 const lat1=Number(a.lat),lng1=Number(a.lng),lat2=Number(b.lat),lng2=Number(b.lng);
 if(![lat1,lng1,lat2,lng2].every(Number.isFinite))return Infinity;
 const rad=Math.PI/180,dlat=(lat2-lat1)*rad,dlng=(lng2-lng1)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dlng/2)**2;
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export function isRegionQualified(query){return /(?:^|\s)(?:서울|부산|인천|대구|대전|광주|울산|세종|제주|경기|강원|충북|충남|전북|전남|경북|경남|수원|강릉|경주|속초|여수|전주|포항|춘천|청주|천안|안동|통영|거제|진주|목포|서귀포|제주시)(?:시|도|군|구|특별시|광역시|특별자치도)?(?:\s|$)/.test(String(query||''));}
export function rankResults(items,region,anchor=null,query=''){
 const r=String(region||'').trim(),term=cleanQuery(query).replace(/\s/g,'').toLowerCase();
 const relevance=name=>{
  const n=String(name||'').replace(/\s/g,'').toLowerCase();
  return !term?0:n===term?3:n.startsWith(term)?2:n.includes(term)?1:0;
 };
 return (Array.isArray(items)?items:[]).map((item,i)=>{
  const km=distanceKm(anchor,item);
  return {...item,_rank:i,_local:Boolean(r&&(item.address||item.roadAddress||'').includes(r)),
   _distanceKm:Number.isFinite(km)?km:null,_textMatch:relevance(item.name)};
 }).sort((a,b)=>{
  // Don't put a nearby unrelated shop above an exact nationwide name match.
  if(a._textMatch!==b._textMatch)return b._textMatch-a._textMatch;
  if(a._local!==b._local)return Number(b._local)-Number(a._local);
  if(anchor){
   const aNear=a._distanceKm!==null&&a._distanceKm<=75,bNear=b._distanceKm!==null&&b._distanceKm<=75;
   if(aNear!==bNear)return Number(bNear)-Number(aNear);
   if(aNear&&bNear)return a._distanceKm-b._distanceKm||a._rank-b._rank;
  }
  return a._rank-b._rank;
 });
}
export function samePlace(a,b){if(!a||!b)return false;return Boolean(a.sourceId&&b.id&&String(a.sourceId)===String(b.id))||(a.name===b.name&&Number.isFinite(Number(a.lat))&&Number.isFinite(Number(a.lng))&&Math.abs(Number(a.lat)-Number(b.lat))<0.00003&&Math.abs(Number(a.lng)-Number(b.lng))<0.00003);}
export function splitPaste(text){return String(text||'').split(/\r?\n/).map(cleanQuery).filter(Boolean).slice(0,30);}
