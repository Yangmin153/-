/** Export a route overview as a genuine PNG using the already-calculated NAVER road geometry.
 * No map tile copying, screenshots, CORS circumvention, or extra API calls.
 * This is a route diagram, not a NAVER basemap image.
 */
(function(root){'use strict';
 const palette=['#2563eb','#d97706','#0891b2','#7c3aed','#059669','#be185d','#4338ca','#dc2626','#0f766e','#6d28d9'];
 const good=(p)=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 const world=(point)=>{const lng=point[0],lat=Math.max(-85,Math.min(85,point[1])),r=lat*Math.PI/180;return [(lng+180)/360,(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2];};
 const routeLines=(day)=>{
  if(!Array.isArray(day?.result?.entries))return [];
  const lines=[];for(const e of day.result.entries.slice(1)){const path=e.leg?.path;if(!Array.isArray(path))continue;const pts=path.filter(good).map(world);if(pts.length>1)lines.push({pts,estimate:e.leg.source==='estimate'});}return lines;
 };
 function model(days,scope='day',index=0){
  if(scope!=='day'&&scope!=='all')throw Error('저장 범위를 확인해 주세요.');
  const selected=scope==='all'?days.map((day,i)=>({day,i})):days[index]?[{day:days[index],i:index}]:[];
  if(!selected.length)throw Error('해당 날짜가 없습니다.');
  const batches=selected.map(({day,i})=>{if(!day.result?.entries?.length)throw Error(`${i+1}일 차 동선을 먼저 계산해 주세요.`);return {i,day,lines:routeLines(day),dots:day.result.entries.map(e=>({kind:e.kind,name:e.place.name,point:good([e.place.lng,e.place.lat])?world([e.place.lng,e.place.lat]):null})).filter(x=>x.point)};});
  if(!batches.some(x=>x.lines.length))throw Error('저장할 경로 선이 없습니다.');
  const coords=batches.flatMap(x=>x.lines.flatMap(s=>s.pts).concat(x.dots.map(y=>y.point)));
  const xs=coords.map(v=>v[0]),ys=coords.map(v=>v[1]);let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const dx=Math.max(.00002,maxX-minX),dy=Math.max(.00002,maxY-minY);
  minX-=dx*.08;maxX+=dx*.08;minY-=dy*.08;maxY+=dy*.08;
  return {batches,bounds:{minX,maxX,minY,maxY},scope};
 }
 function draw(ctx,m,width=1200,height=900){
  const {batches,bounds}=m;ctx.fillStyle='#f5f8fd';ctx.fillRect(0,0,width,height);
  ctx.fillStyle='#152640';ctx.font='700 40px system-ui';ctx.fillText('여행길 · 여행 동선',62,68);
  ctx.font='23px system-ui';ctx.fillStyle='#66798f';ctx.fillText(m.scope==='all'?'전체 여행 동선':`${batches[0].i+1}일 차 동선`,62,108);
  const box={x:58,y:138,w:width-116,h:height-274};ctx.fillStyle='white';ctx.fillRect(box.x,box.y,box.w,box.h);
  ctx.strokeStyle='#e9eef5';ctx.lineWidth=1;for(let i=1;i<7;i++){ctx.beginPath();ctx.moveTo(box.x+i*box.w/7,box.y);ctx.lineTo(box.x+i*box.w/7,box.y+box.h);ctx.stroke();ctx.beginPath();ctx.moveTo(box.x,box.y+i*box.h/7);ctx.lineTo(box.x+box.w,box.y+i*box.h/7);ctx.stroke();}
  const scale=Math.min((box.w-150)/(bounds.maxX-bounds.minX),(box.h-160)/(bounds.maxY-bounds.minY));const cx=(bounds.minX+bounds.maxX)/2,cy=(bounds.minY+bounds.maxY)/2;
  const pos=([x,y])=>[box.x+box.w/2+(x-cx)*scale,box.y+box.h/2+(y-cy)*scale];
  batches.forEach(({i,day,lines,dots})=>{const color=palette[i%palette.length];
   for(const seg of lines){ctx.save();ctx.strokeStyle=seg.estimate?'#d18a50':color;ctx.setLineDash(seg.estimate?[10,8]:[]);ctx.lineWidth=7;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();seg.pts.forEach((p,j)=>{const [x,y]=pos(p);if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.stroke();ctx.restore();}
   dots.forEach((dot,j)=>{const [x,y]=pos(dot.point),start=dot.kind==='origin',end=dot.kind==='destination';ctx.fillStyle=start?'#107c64':end?'#26394f':'white';ctx.strokeStyle=start||end?'white':color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 16px system-ui';ctx.fillStyle=start||end?'white':color;ctx.fillText(start?'S':end?'E':String(j),x,y+1);});
  });
  const legends=batches.map(({i,day})=>`${i+1}일 차 · ${Math.round(day.result.drivingMinutes)}분 · ${(day.result.totalDistanceMeters/1000).toFixed(1)}km`);ctx.fillStyle='#273b58';ctx.font='700 18px system-ui';ctx.textAlign='left';ctx.fillText(legends.join('   /   ').slice(0,100),62,height-88);
  ctx.font='16px system-ui';ctx.fillStyle='#75869a';ctx.fillText('NAVER Cloud Maps 도로 경로 데이터 기반 · 지도 배경이 없는 경로 도식 · 추정 구간은 점선',62,height-47);
 }
 async function save(days,scope,index=0){const m=model(days,scope,index);const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지 생성 기능을 사용할 수 없습니다.');draw(ctx,m);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG 변환에 실패했습니다.');const url=URL.createObjectURL(blob);
 try{const link=document.createElement('a');link.href=url;link.download=`여행길_${scope==='all'?'전체동선':`${index+1}일차`}_경로도식.png`;document.body.append(link);link.click();link.remove();}finally{setTimeout(()=>URL.revokeObjectURL(url),5000)}return blob.size;
 }
 root.TripExport=Object.freeze({model,draw,save,routeLines});
})(globalThis);
