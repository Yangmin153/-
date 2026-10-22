'use strict';
// 여행길 v4: GitHub + Vercel 정적 프런트엔드.
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,9)}`);
const clone = (x) => structuredClone(x);
const STORAGE_KEY = 'yeohaenggil.v2.days';
const RECALC_KEY = 'yeohaenggil.vercel.recalc';
const DEFAULT_REGION = '제주';
const readableMinutes=value=>{const n=Math.max(0,Math.round(Number(value)||0)),h=Math.floor(n/60),m=n%60;return h?`${h}시간${m?' '+m+'분':''}`:`${m}분`;};
const p = (name,lat,lng) => ({id:uid(),name,lat,lng,locked:false});
const EXAMPLES = [
  ['제주국제공항',33.5104,126.4913],['서귀포 예시 숙소',33.2539,126.5594],
  ['성산일출봉 부근',33.4581,126.9424],['섭지코지 부근',33.4236,126.9303],
  ['협재해수욕장 부근',33.3940,126.2396],['오설록 부근',33.3059,126.2895],
  ['애월 부근',33.4628,126.3092],['비자림 부근',33.4890,126.8096],
  ['함덕해수욕장 부근',33.5431,126.6697]
];
function freshDays(){
  const airport=p('제주국제공항 (예시 위치)',33.5104,126.4913);
  const hotel=p('서귀포 숙소 (예시 위치)',33.2539,126.5594);
  return [{id:uid(),origin:airport,destination:clone(hotel),departure:'09:30',mode:'auto',stops:[p('애월 부근',33.4628,126.3092),p('협재해수욕장 부귶��q�^