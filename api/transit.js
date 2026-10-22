import {transitPlan} from '../lib/transit.js';
const reply=(message,status)=>new Response(JSON.stringify({detail:message}),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function POST(request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return reply('다른 출처에서의 요청은 허용하지 않습니다.',403);
 if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return reply('JSON 요청만 허용합니다.',415);
 const size=Number(request.headers.get('content-length')||0);if(!Number.isFinite(size)||size>32768)return reply('일정 데이터가 너무 큽니다.',413);
 let body;try{const raw=await request.text();if(raw.length>32768)return reply('일정 데이터가 너무 큽니다.',413);body=JSON.parse(raw);}catch{return reply('일정 JSON 형식을 확인하세요.',400);}
 try{return await transitPlan(body,process.env);}catch(error){return reply('대중교통 경로 조회 중 오류가 발생했습니다.',502);}
}