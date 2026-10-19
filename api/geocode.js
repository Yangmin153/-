import {geocode,err} from '../lib/core.js';
export async function GET(request){
  const u=new URL(request.url);
  return await geocode((u.searchParams.get('q')||'').trim(),process.env);
}
