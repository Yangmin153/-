import {authenticated} from '../lib/trips.js';
import {json} from '../lib/core.js';
export async function DELETE(request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'다른 사이트에서 계정을 삭제할 수 없습니다.'},403);
 const env=process.env;
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:'계정 삭제를 사용할 수 없습니다. 관리자에게 문의해 주세요.'},503);
 const ctx=await authenticated(request,env);if(ctx.failure)return ctx.failure;
 try{
  const response=await fetch(ctx.url+'/auth/v1/admin/users/'+ctx.userId,{
   method:'DELETE',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY},
   signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)return json({error:'계정 삭제가 완료되지 않았습니다. 다시 시도해 주세요.'},502);
  return json({deleted:true});
 }catch{return json({error:'계정 삭제 요청이 실패했습니다.'},502);}
}

