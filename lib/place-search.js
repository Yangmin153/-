/** Kakao Local keyword search. All credentials and requests stay server-side. */
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const error=(message,status)=>response({detail:message},status);
const validNumber=(v,min,max)=>{const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
export function normalizeKakao(doc){
 const lat=validNumber(doc?.y,-90,90),lng=validNumber(doc?.x,-180,180);
 if(lat===null||lng===null||!doc?.place_name||!doc?.id)return null;
 const link=String(doc.place_url||'');
 return {id:String(doc.id).slice(0,64),name:String(doc.place_name).slice(0,100),category:String(doc.category_name||'').slice(0,140),categoryGroupCode:String(doc.category_group_code||'').slice(0,5),address:String(doc.road_address_name||doc.address_name||'').slice(0,200),roadAddress:String(doc.road_address_name||'').slice(0,200),jibunAddress:String(doc.address_name||'').slice(0,200),lat,lng,phone:String(doc.phone||'').slice(0,45),url:/^https?:\/\/(?:place\.map\.kakao\.com|map\.kakao\.com)\//.test(link)?link:'',source:'kakao'};
}
export async function searchPlaces(request,env=process.env,fetcher=fetch){
 const u=new URL(request.url),q=(u.searchParams.get('q')||'').trim();
 if(q.length<2||q.length>80||/[\u0000-\u001f]/.test(q))return error('검색어는 2~80자로 입력해 주세요.',400);
 const page=Number(u.searchParams.get('page')||1);
 if(!Number.isInteger(page)||page<1||page>3)return error('페이지는 1~3까지만 조회할 수 있습니다.',400);
 const nearby=u.searchParams.get('nearby')==='1';
 const bias=u.searchParams.get('bias')==='1';
 const category=u.searchParams.get('category')||'';
 if(category&&category!=='SW8')return error('지원하지 않는 장소 카테고리입니다.',400);
 const lat=validNumber(u.searchParams.get('lat'),-90,90),lng=validNumber(u.searchParams.get('lng'),-180,180);
 if((nearby||bias)&&(lat===null||lng===null))return error('주변 검색을 위한 출발지 좌표가 없습니다.',400);
 if(!env.KAKAO_REST_API_KEY)return error('상호명 검색을 사용하려면 Vercel에 KAKAO_REST_API_KEY를 설정해 주세요.',503);
 const endpoint=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
 endpoint.searchParams.set('query',q);endpoint.searchParams.set('size','15');endpoint.searchParams.set('page',String(page));
 if(category)endpoint.searchParams.set('category_group_code',category);
 if(nearby||bias){endpoint.searchParams.set('x',String(lng));endpoint.searchParams.set('y',String(lat));if(nearby)endpoint.searchParams.set('radius','20000');endpoint.searchParams.set('sort','distance');}
 try{
  const res=await fetcher(endpoint,{headers:{Authorization:`KakaoAK ${env.KAKAO_REST_API_KEY}`,'Accept':'application/json'},signal:AbortSignal.timeout(6000)});
  if(!res.ok){if(res.status===401||res.status===403)return error('카카오 API 키 또는 카카오맵 API 사용 권한을 확인해 주세요.',502);if(res.status===429)return error('검색 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',429);return error('장소 검색 서비스에서 오류가 발생했습니다.',502);}
  const body=await res.json();if(!Array.isArray(body?.documents))return error('장소 검색 결과 형식이 올바르지 않습니다.',502);
  return response({items:body.documents.map(normalizeKakao).filter(Boolean),page,hasNext:!body.meta?.is_end&&page<3,total:Number(body.meta?.total_count)||0,source:'kakao'});
 }catch{return error('검색 서비스 연결이 지연되고 있습니다. 다시 시도해 주세요.',504);}
}
