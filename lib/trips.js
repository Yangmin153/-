import {json} from './core.js';

const isUuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function checkDays(days){
 const point=p=>p&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=100&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lng))<=180;
 return Array.isArray(days)&&days.length>=1&&days.length<=10&&days.every(d=>d&&point(d.origin)&&point(d.destination)&&Array.isArray(d.stops)&&d.stops.length<=30&&d.stops.every(point)&&['auto','manual'].includes(d.mode)&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(d.departure||''));
}
const error=(message,status=400)=>json({error:message},status);
const options=env=>({url:String(env.SUPABASE_URL||'').replace(/\/$/,''),key:env.SUPABASE_ANON_KEY||env.SUPABASE_PUBLISHABLE_KEY||''});
const fetchJson=async(url,opts,fetcher)=>{const resp=await fetcher(url,opts);let body=null;try{body=await resp.json()}catch{}return {resp,body};};
export async function authenticated(request,env=process.env,fetcher=fetch){
 const {url,key}=options(env);
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)return {failure:error('회원 기능이 아직 연결되지 않았습니다.',503)};
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~-]+$/.test(authorization)||authorization.length>8192)return {failure:error('로그인이 필요합니다.',401)};
 const {resp,body}=await fetchJson(url+'/auth/v1/user',{headers:{apikey:key,authorization},signal:AbortSignal.timeout(9000)},fetcher);
 if(!resp.ok||!isUuid(body?.id))return {failure:error('로그인이 만료되었습니다. 다시 로그인해 주세요.',401)};
 return {userId:body.id,url,key,authorization};
}
export function validateTripPayload(body){
 if(!body||typeof body!=='object')return '여행 데이터를 확인해 주세요.';
 if(typeof body.name!=='string'||body.name.trim().length<1||body.name.trim().length>90)return '여행 이름은 1~90자로 입력해 주세요.';
 if(typeof body.region!=='string'||body.region.length>80)return '지역 정보가 올바르지 않습니다.';
 if(!checkDays(body.days))return '날짜별 출발지·도착지·방문지를 확인해 주세요.';
 if(body.import_fingerprint!=null&&!/^[0-9a-f]{64}$/.test(String(body.import_fingerprint)))return '가져오기 식별 정보가 올바르지 않습니다.';
 return null;
}
const asDb=(ctx,method,path,data,fetcher)=>fetchJson(ctx.url+'/rest/v1/trips'+path,{
 method,headers:{apikey:ctx.key,authorization:ctx.authorization,'content-type':'application/json',prefer:'return=representation'},
 ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(12000)
},fetcher);
function denyOrigin(req){const origin=req.headers.get('origin');return origin&&origin!==new URL(req.url).origin;}
export async function handleTrips(request,env=process.env,fetcher=fetch){
 const method=request.method||'GET';
 if(!['GET','POST','PATCH','DELETE'].includes(method))return error('지원하지 않는 요청입니다.',405);
 if(method!=='GET'&&denyOrigin(request))return error('다른 사이트에서 요청할 수 없습니다.',403);
 try{
  const ctx=await authenticated(request,env,fetcher);if(ctx.failure)return ctx.failure;
  const url=new URL(request.url),id=url.searchParams.get('id');
  if(id!==null&&!isUuid(id))return error('여행 식별자가 올바르지 않습니다.');
  if(method!=='POST'&&!id&&method!=='GET')return error('수정하거나 삭제할 여행을 선택해 주세요.');
  let payload;
  if(['POST','PATCH'].includes(method)){
   if(Number(request.headers.get('content-length')||0)>110000)return error('여행 데이터가 너무 큽니다.',413);
   const source=await request.text();if(source.length>110000)return error('여행 데이터가 너무 큽니다.',413);
   try{payload=JSON.parse(source)}catch{return error('JSON 형식이 올바르지 않습니다.');}
   const problem=validateTripPayload(payload);if(problem)return error(problem);
  }
  const path='?select=id,name,region,days,created_at,updated_at,import_fingerprint'+(method==='POST'?'':'&owner_id=eq.'+ctx.userId+(id?'&id=eq.'+id:''))+(method==='GET'?'&order=updated_at.desc&limit=60':'');
  const data=payload?{name:payload.name.trim(),region:payload.region.trim(),days:payload.days,import_fingerprint:payload.import_fingerprint||null,...(method==='POST'?{owner_id:ctx.userId}:{})}:null;
  const {resp,body}=await asDb(ctx,method,path,data,fetcher);
  if(resp.status===409)return error('이미 가져온 여행이거나 충돌이 발생했습니다.',409);
  if(!resp.ok)return error(resp.status===401||resp.status===403?'이 여행에 접근할 권한이 없습니다.':'여행 데이터를 저장하거나 불러오지 못했습니다.',resp.status>=500?502:resp.status);
  if(method==='GET')return json({trips:Array.isArray(body)?body:[]});
  if(method==='DELETE')return Array.isArray(body)&&body.length===1?json({deleted:true}):error('여행을 찾을 수 없습니다.',404);
  if(!Array.isArray(body)||body.length!==1)return error('여행을 찾을 수 없습니다.',404);
  return json({trip:body[0]});
 }catch(err){
  if(err?.name==='TimeoutError'||err?.name==='AbortError')return error('데이터베이스 응답이 지연되고 있습니다.',504);
  return error('로그인 또는 데이터베이스 연결 오류가 발생했습니다.',502);
 }
}

