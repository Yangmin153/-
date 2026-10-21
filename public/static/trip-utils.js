/** Browser-neutral presentation helpers. Core routing and API payloads are unchanged. */
export const MOBILE_BREAKPOINT = 768;
export const MAX_SHARED_CHARS = 10000;

export function tripSnapshot(days) {
  return days.map(({result, ...rest}) => rest);
}

export function encodeTrip(days) {
  const payload = JSON.stringify({v:1,days:tripSnapshot(days)});
  const bytes = new TextEncoder().encode(payload);
  if (bytes.length > 7200) throw new Error('일정이 길어 링크에 담을 수 없습니다. 일정 저장 파일을 이용해 주세요.');
  let binary=''; for(const byte of bytes) binary+=String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if(encoded.length>MAX_SHARED_CHARS) throw new Error('공유 링크가 너무 깁니다. JSON 파일로 공유해 주세요.');
  return encoded;
}

export function decodeTrip(encoded) {
  if(typeof encoded!=='string'||!encoded||encoded.length>MAX_SHARED_CHARS||!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('유효하지 않은 일정 공유 링크입니다.');
  const b64=encoded.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(b64+'='.repeat((4-b64.length%4)%4));
  const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(parsed?.v!==1||!Array.isArray(parsed?.days))throw new Error('지원하지 않는 일정 형식입니다.');
  return parsed.days;
}

function finiteLocation(place){return place&&Number.isFinite(Number(place.lat))&&Number.isFinite(Number(place.lng))&&Math.abs(Number(place.lat))<=90&&Math.abs(Number(place.lng))<=180;}
export function naverRouteLinks(from,to,appname='https://example.com') {
  if(!finiteLocation(from)||!finiteLocation(to))throw new Error('길안내에 사용할 좌표가 없습니다.');
  const query = new URLSearchParams({slat:String(from.lat),slng:String(from.lng),sname:String(from.name||'출발지'),dlat:String(to.lat),dlng:String(to.lng),dname:String(to.name||'도착지'),appname});
  const webQuery=new URLSearchParams({slat:String(from.lat),slng:String(from.lng),stext:String(from.name||'출발지'),elat:String(to.lat),elng:String(to.lng),etext:String(to.name||'도착지'),menu:'route',pathType:'1'});
  return {app:`nmap://route/car?${query.toString()}`,web:`https://map.naver.com/p/directions?${webQuery.toString()}`};
}
