// 개발용 로컬 서버 — 실제 Vercel 배포에는 사용되지 않습니다.
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fileURLToPath} from 'node:url';
const base=fileURLToPath(new URL('.',import.meta.url));
const envPath=join(base,'.env');
try{const env=await readFile(envPath,'utf8');for(const line of env.split(/\r?\n/)){const m=line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}}catch{}
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const host='127.0.0.1';const port=Number(process.env.PORT||3000);
const api={health:await import('./api/health.js'),config:await import('./api/config.js'),route:await import('./api/route.js'),geocode:await import('./api/geocode.js'),places:await import('./api/places.js'),recommendations:await import('./api/recommendations.js')};
createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${host}:${port}`);let response;
  if(url.pathname.startsWith('/api/')){
    const op=url.pathname.split('/')[2],handler=api[op]?.[req.method];
    if(!handler){res.writeHead(404);res.end('Not found');return;}
    const chunks=[];for���q�^