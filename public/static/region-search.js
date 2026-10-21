/** Lightweight region-aware search utilities; no API credentials. */
export const REGIONS=['제주','서울','부산','강릉','경주','속초','여수','전주'];
export function cleanQuery(value){return String(value||'').replace(/https?:\/\/\S+/g,' ').replace(/(?:여기|우리|진짜|이번에)\s*/g,' ').replace(/(?:가보자|갈까|추천해|가고싶다|들르자)[!.?\s]*$/g,'').replace(/\s+/g,' ').trim().slice(0,80);}
export function searchTerms(query,region){const q=cleanQuery(query),r=String(region||'').trim();if(!q)return [];if(!r||q.includes(r)||/^\d{2,4}-\d{2,4}/.test(q))return [q];return [r+' '+q,q];}
export function rankResults(items,region){const r=String(region||'').trim();return (Array.isArray(items)?items:[]).map((item,i)=>({...item,_rank:i,_local:Boolean(r&&(item.address||item.roadAddress||'').includes(r))})).sort((a,b)=>Number(b._local)-Number(a._local)||a._rank-b._rank);}
export function samePlace(a,b){if(!a||!b)return false;return Boolean(a.sourceId&&b.id&&String(a.sourceId)===String(b.id))||(a.name===b.name&&Number.isFinite(Number(a.lat))&&Number.isFinite(Number(a.lng))&&Math.abs(Number(a.lat)-Number(b.lat))<0.00003&&Math.abs(Number(a.lng)-Number(b.lng))<0.00003);}
export function splitPaste(text){return String(text||'').split(/\r?\n/).map(cleanQuery).filter(Boolean).slice(0,30);}
