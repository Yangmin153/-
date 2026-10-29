import {json,ready} from '../lib/core.js';
export function GET(){
 const env=process.env;
 const url=String(env.SUPABASE_URL||'').trim().replace(/\/+$/,'');
 // Client-side credentials must never include a service-role or secret key.
 const rawKey=String(env.SUPABASE_PUBLISHABLE_KEY||env.SUPABASE_ANON_KEY||'').trim();
 const validUrl=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
 const publicKey=/^(sb_publishable_[a-zA-Z0-9_-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)$/.test(rawKey);
 const configured=validUrl&&publicKey;
 return json({
  mapsKeyId:env.NAVER_MAPS_JS_KEY_ID||env.NAVER_MAPS_CLIENT_ID||'',
  directionsReady:ready(env),geocodeReady:ready(env),
  supabaseUrl:configured?url:'',
  supabaseAnonKey:configured?rawKey:'',
  supabaseReady:configured,
  supabaseError:configured?'':!validUrl?'Supabase 프로젝트 URL 설정을 확인해 주세요.':'Supabase 공개용 API 키 설정을 확인해 주세요.',
  // Kakao JavaScript key is a public browser key, NOT the server-side REST API key.
  // Configure allowed web domains in Kakao Developers before enabling KakaoNavi.
  kakaoJsKey:String(env.KAKAO_JAVASCRIPT_KEY||env.KAKAO_JS_KEY||'').trim(),
  version:'6.8.0'
 });
}
