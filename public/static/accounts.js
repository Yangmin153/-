/* Email auth & owner-scoped travel plans; never handles raw passwords outside Supabase SDK. */
const $=id=>document.getElementById(id),app=()=>window.TripApp;
let api=null,session=null,user=null,activeId=null,config=null,lastId=null,busy=false;
const panel=$('account-panel'),feedback=$('account-feedback'),travelList=$('account-trips');
const notice=(msg,error=false)=>{feedback.textContent=msg;feedback.dataset.error=String(error)};
const loggedIn=()=>Boolean(user&&session?.access_token);
function currentDays(){return app().getDays().map(({result,...day})=>structuredClone(day));}
async function initApi(){
 if(api)return api;
 config=config||await (await fetch('/api/config')).json();
 if(!config.supabaseReady||!config.supabaseUrl||!config.supabaseAnonKey)throw Error(config.supabaseError||'회원가입 서버 설정을 확인할 수 없습니다. 나중에 다시 시도해 주세요.');
 if(!window.supabase?.createClient)await new Promise((resolve,reject)=>{const el=document.createElement('script');el.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';el.onload=resolve;el.onerror=()=>reject(Error('로그인 라이브러리를 불러오지 못했습니다.'));document.head.append(el)});
 if(!window.supabase?.createClient)throw Error('로그인 라이브러리를 사용할 수 없습니다.');
 api=window.supabase.createClient(config.supabaseUrl,config.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 api.auth.onAuthStateChange((event,newSession)=>queueMicrotask(()=>applySession(newSession)));
 return api;
}
function applySession(next){
 const id=next?.user?.id||null;
 if(lastId!==null&&id!==lastId){activeId=null;travelList.replaceChildren();app().restoreGuestDays();}
 lastId=id;session=next;user=next?.user||null;
 $('account-button').textContent=user?'내 여행':'로그인';
 $('account-user').textContent=user?.email||'비회원으로도 자유롭게 여행을 계획할 수 있어요.';
 $('account-auth-form').hidden=loggedIn();
 $('account-signed').hidden=!loggedIn();
 $('cloud-save').hidden=!loggedIn();
 // The former account-guest element was removed from the current 3-step layout.
}
function open(){panel.hidden=false;document.body.classList.add('account-open');if(loggedIn())void loadTrips();}
function close(){panel.hidden=true;document.body.classList.remove('account-open');}
async function request(path,method='GET',payload){
 if(!loggedIn())throw Error('로그인이 필요합니다.');
 const r=await fetch('/api/trips'+path,{method,headers:{Authorization:'Bearer '+session.access_token,...(payload?{'content-type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'여행 데이터를 처리할 수 없습니다.');return data;
}
function payload(name,days=currentDays(),fingerprint=null){
 return {name:String(name||'').trim(),region:String(days[0]?.region||app().getRegion()).slice(0,80),days,import_fingerprint:fingerprint};
}
function tripRow(trip){
 const row=document.createElement('div');row.className='account-trip-row';
 const openBtn=document.createElement('button');openBtn.type='button';openBtn.className='account-trip-open';
 const name=document.createElement('strong');name.textContent=trip.name;
 const sub=document.createElement('small');sub.textContent=[trip.region,new Date(trip.updated_at).toLocaleDateString('ko-KR')+' 수정'].filter(Boolean).join(' · ');
 openBtn.append(name,sub);openBtn.onclick=()=>{if(!confirm('이 여행을 열까요? 화면의 현재 여행은 교체됩니다. 브라우저에 저장된 비회원 일정은 유지됩니다.'))return;if(!app().importDays(trip.days))return notice('저장된 데이터가 올바르지 않습니다.',true);activeId=trip.id;$('account-trip-name').value=trip.name;close();};
 const edit=document.createElement('button');edit.type='button';edit.textContent='이름';edit.onclick=async()=>{const value=prompt('여행 이름 변경',trip.name);if(value===null)return;const name=value.trim();if(!name||name.length>90)return notice('이름을 1~90자로 입력해 주세요.',true);try{await request('?id='+trip.id,'PATCH',payload(name,trip.days,trip.import_fingerprint));if(activeId===trip.id)$('account-trip-name').value=name;await loadTrips();notice('변경 완료');}catch(e){notice(e.message,true)}};
 const del=document.createElement('button');del.type='button';del.className='danger';del.textContent='삭제';del.onclick=async()=>{if(!confirm('여행 '+trip.name+'을(를) 삭제할까요?'))return;try{await request('?id='+trip.id,'DELETE');if(activeId===trip.id)activeId=null;await loadTrips();notice('삭제 완료')}catch(e){notice(e.message,true)}};
 const opts=document.createElement('div');opts.className='account-trip-ops';opts.append(edit,del);row.append(openBtn,opts);return row;
}
async function loadTrips(){if(!loggedIn())return;try{const {trips}=await request('');travelList.replaceChildren(...trips.map(tripRow));if(!trips.length){const p=document.createElement('p');p.textContent='저장된 여행이 없습니다. 아래에서 첫 여행을 저장해 보세요.';travelList.append(p)}}catch(e){notice(e.message,true)}}
async function saveCloud(){
 if(!loggedIn()){open();notice('다른 기기에서 이어서 보려면 로그인해 주세요.');return;}
 const name=$('account-trip-name').value.trim();if(!name||name.length>90)throw Error('여행 이름은 1~90자로 입력해 주세요.');
 const data=await request(activeId?'?id='+activeId:'',activeId?'PATCH':'POST',payload(name));
 activeId=data.trip.id;notice('서버 저장이 완료됐습니다.');app().toast('클라우드에 저장했어요.');await loadTrips();
}
async function importLocal(){
 if(!loggedIn())throw Error('먼저 로그인해 주세요.');
 const raw=localStorage.getItem('yeohaenggil.v2.days');if(!raw)throw Error('가져올 브라우저 여행이 없습니다.');
 let days;try{days=JSON.parse(raw)}catch{throw Error('브라우저 일정 형식이 올바르지 않습니다.')}
 if(!app().validateDays(days))throw Error('저장된 여행 데이터가 올바르지 않습니다.');
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(days)));
 const hash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
 const marker='yeohaenggil.imported.'+user.id+'.'+hash;
 if(localStorage.getItem(marker))return notice('이미 가져온 여행입니다.');
 const data=await request('','POST',payload('기존 브라우저 여행',days,hash));
 localStorage.setItem(marker,data.trip.id);notice('여행을 가져왔습니다. 브라우저 원본은 유지됩니다.');await loadTrips();
}
async function perform(action){
 if(busy)return;busy=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
  if(['signup','signin','reset'].includes(action)){
   await initApi();const email=$('account-email').value.trim(),password=$('account-password').value;
   if(!email.includes('@'))throw Error('올바른 이메일을 입력해 주세요.');
   if(action==='reset'){const {error}=await api.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;notice('비밀번호 재설정 이메일을 확인해 주세요.');}
   else{
    if(password.length<8||password.length>128)throw Error('비밀번호는 8~128자여야 합니다.');
    const {data,error}=action==='signup'?await api.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}}):await api.auth.signInWithPassword({email,password});
    if(error)throw error;if(data.session){applySession(data.session);await loadTrips();notice('로그인했습니다.');}else notice('이메일 인증 후 로그인해 주세요.');
    $('account-password').value='';
   }
  }else if(action==='save')await saveCloud();
  else if(action==='list')await loadTrips();
  else if(action==='import')await importLocal();
  else if(action==='new'){if(confirm('새 여행을 시작할까요? 기존 클라우드 여행은 별도로 저장해야 합니다.')){activeId=null;app().newTrip();$('account-trip-name').value='새 여행';close();}}
  else if(action==='signout'){const {error}=await api.auth.signOut();if(error)throw error;applySession(null);close();}
  else if(action==='password'){const password=prompt('새 비밀번호 (8자 이상)');if(password===null)return;if(password.length<8)throw Error('비밀번호는 8자 이상이어야 합니다.');const {error}=await api.auth.updateUser({password});if(error)throw error;notice('비밀번호가 변경됐습니다.');}
  else if(action==='delete'){if(prompt('계정 삭제와 여행 데이터 영구 삭제에 동의한다면 DELETE를 입력하세요.')!=='DELETE')return;const response=await fetch('/api/account',{method:'DELETE',headers:{authorization:'Bearer '+session.access_token}});const body=await response.json();if(!response.ok)throw Error(body.error||'계정 삭제를 완료하지 못했습니다.');await api.auth.signOut();applySession(null);close();}
 }catch(e){notice(e.message||'요청 실패',true)}finally{busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false)}
}
function init(){
 $('account-button').onclick=open;$('cloud-save').onclick=()=>{open();void perform('save')};$('account-close').onclick=close;
 panel.addEventListener('click',e=>{if(e.target===panel)close();const btn=e.target.closest('[data-account-action]');if(btn)void perform(btn.dataset.accountAction)});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
 fetch('/api/config').then(r=>r.json()).then(async c=>{config=c;if(!c.supabaseReady)return;await initApi();const {data}=await api.auth.getSession();applySession(data.session)}).catch(()=>{});
}
window.YeoAccount={isSignedIn:loggedIn,open,loadTrips};
init();

