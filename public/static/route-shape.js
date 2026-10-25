/** Road path presentation only: never alter actual place coordinates or routing costs. */
(function(root){'use strict';
const valid=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
function metres(a,b){
 const rad=Math.PI/180,lat=(a[1]+b[1])/2*rad,dx=(a[0]-b[0])*111320*Math.cos(lat),dy=(a[1]-b[1])*111320;
 return Math.hypot(dx,dy);
}
function point(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)?[p.lng,p.lat]:null;}
function trimEnd(path,target,reverse=false){
 if(!target||path.length<3)return path;
 const pts=reverse?[...path].reverse():path;
 // Only discard an actual Naver geometry tip that bends back toward the waypoint
 // within its first 80 road-metres. Long access roads and real route loops stay.
 let travelled=0,bestIndex=0,bestDistance=metres(pts[0],target);
 for(let i=1;i<Math.min(pts.length-1,12);i++){
  travelled+=metres(pts[i-1],pts[i]);
  if(travelled>80)break;
  const distance=metres(pts[i],target);
  if(distance<bestDistance){bestDistance=distance;bestIndex=i;}
 }
 const firstDistance=metres(pts[0],target);
 if(bestIndex>0&&bestDistance<=30&&firstDistance-bestDistance>8){
  const remaining=pts.slice(bestIndex);
  return reverse?remaining.reverse():remaining;
 }
 return path;
}
function displayPath(source,from,to){
 if(!Array.isArray(source))return [];
 const path=[];
 for(const p of source){
  if(!valid(p))continue;
  if(!path.length||metres(path[path.length-1],p)>0.04)path.push([p[0],p[1]]);
 }
 if(path.length<2)return path;
 // Never fabricate a straight connector from map marker to snapped road.
 const start=trimEnd(path,point(from)),end=trimEnd(start,point(to),true);
 return end.length>=2?end:path;
}
root.YeoRoadShape=Object.freeze({displayPath,metres});
})(globalThis);
