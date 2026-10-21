/** Proximity suggestions for the current leg. They are NOT guaranteed to be on the driving road. */
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const valid=(x,min,max)=>Number.isFinite(Number(x))&&Number(x)>=min&&Number(x)<=max;
export function distanceFromSegment(point,a,b){const dy=(b[0]-a[0])*111000,dx=(b[1]-a[1])*88000;const py=(point[0]-a[0])*111000,px=(point[1]-a[1])*88000;const den=dx*dx+dy*dy;const t=den?Math.max(0,Math.min(1,(px*dx+py*dy)/den)):0;return Math.hypot(px-t*dx,py-t*dy);}
export async function recommendations(request,env=process.env,fetcher=fetch){
 const u=new URL(request.url);const coords=['aLat','aLng','bLat','bLng'].map(k=>u.searchParams.get(k));
 if(!valid(coords[0],-90,90)||!valid(coords[1],-180,180)||!valid(coords[2],-90,90)||!valid(coords[3],-180,180))return json({detail:'두 장소의 위치가 올바르지 않습니다.'},400);
 if(!env.KAKAO_REST_API_KEY)return json({detail:'장소 추천 연결이 필요합니다.'},503);
 const a=[Number(coords[0]),Number(coords[1])],b=[Number(coords[2]),Number(coords[3])],lat=(a[0]+b[0])/2,lng=(a[1]+b[1])/2;
 const q=['카페','관광지','음식점'];const hits=[];
 try{
  const rs=await Promise.all(q.map(async keyword=>{const u=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');u.searchParams.set('query',keyword);u.searchParams.set('x',String(lng));u.searchParams.set('y',String(lat));u.searchParams.set('radius','10000');u.searchParams.set('size','5');u.searchParams.set('sort','distance');const response=await fetcher(u,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`},signal:AbortSignal.timeout(4800)});return response.ok?(await response.json()).documents||[]:[];}));
  for(const doc of rs.flat()){const p=[Number(doc.y),Number(doc.x)];if(!valid(p[0],-90,90)||!valid(p[1],-180,180)||!doc.place_name)continue;const dist=distanceFromSegment(p,a,b);if(dist>4500||hits.some(x=>x.id===String(doc.id)))continue;hits.push({id:String(doc.id),name:String(doc.place_name).slice(0,90),address:String(doc.road_address_name||doc.address_name||'').slice(0,160),category:String(doc.category_name||'').slice(0,120),lat:p[0],lng:p[1],offRouteMeters:Math.round(dist)});}
  hits.sort((x,y)=>x.offRouteMeters-y.offRouteMeters);return json({items:hits.slice(0,3),note:'이동 구간 주변 장소 추천이며 실제 도로 경유 여부와 추가 이동시간은 보장하지 않습니다.'});
 }catch{return json({detail:'추천 정보를 가져오지 못했습니다.'},502)}
}
