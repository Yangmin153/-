import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../api/config.js';
function withEnv(values,fn){
 const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY'];
 const old=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 for(const key of names){if(values[key]===undefined)delete process.env[key];else process.env[key]=values[key];}
 try{return fn();}finally{for(const key of names){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
}
const key='sb_publishable_'+'a'.repeat(36),url='https://halbesrgdvjdzrvmdyxy.supabase.co';
test('Supabase config becomes READY only if client has both valid URL and publishable key',()=>{
 withEnv({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key},()=>{
  const response=GET(),c=JSON.parse(response.body);
  assert.equal(c.supabaseReady,true);assert.equal(c.supabaseUrl,url);assert.equal(c.supabaseAnonKey,key);
 });
});
test('trailing slash or whitespace cannot produce a fake ready with blank supabaseUrl',()=>{
 withEnv({SUPABASE_URL:'  '+url+'/  ',SUPABASE_PUBLISHABLE_KEY:key},()=>{
  const c=JSON.parse(GET().body);
  assert.equal(c.supabaseReady,true);assert.equal(c.supabaseUrl,url);
 });
});
test('invalid URL is never passed to createClient as empty while ready=true',()=>{
 withEnv({SUPABASE_URL:'https://wrong-domain.example.com',SUPABASE_PUBLISHABLE_KEY:key},()=>{
  const c=JSON.parse(GET().body);
  assert.equal(c.supabaseReady,false);assert.equal(c.supabaseUrl,'');assert.match(c.supabaseError,/URL/);
 });
});
test('service-role and secret API keys cannot leak into frontend configuration',()=>{
 for(const dangerous of ['sb_secret_test_example','service_role_key','eyJnotajwt']){
  withEnv({SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:dangerous},()=>{
   const c=JSON.parse(GET().body);assert.equal(c.supabaseReady,false);
   assert.equal(c.supabaseAnonKey,'');assert.equal(c.supabaseUrl,'');
  });
 }
});
test('legacy anon JWT is accepted for backward compatibility, no publishable key required',()=>{
 const jwt=['eyJhbGciOiJIUzI1NiJ9','eyJyb2xlIjoiYW5vbiJ9','signature'].join('.');
 withEnv({SUPABASE_URL:url,SUPABASE_ANON_KEY:jwt},()=>{
  const c=JSON.parse(GET().body);assert.equal(c.supabaseReady,true);assert.equal(c.supabaseAnonKey,jwt);
 });
});
