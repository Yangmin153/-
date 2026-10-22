import test from 'node:test';import assert from 'node:assert/strict';
import {geographicOrder,parseTransit,transitPlan} from '../lib/transit.js';
const p=(id,lat,lng)=>({id,name:id,lat,lng});
test('ODsay 검증된 분만 추출',()=>{assert.equal(parseTransit({result:{path:[{info:{totalTime:75,trafficDistance:12000,totalWalk:400}},{info:{totalTime:82}}]}}).durationMinutes,75);assert.throws(()=>parseTransit({result:{path:[]}}));});
test('지리적 후보 순서 정렬은 장소를 유지',()=>{const x=[p('a',37,127),p('b',37.5,127.3)];assert.deepEqual(new Set(geographicOrder(p('s',37,126),x,p('e',38,128)).map(y=>y.id)),new Set(['a','b']));});
test('대중교통 키 없을 때 임의 이동시간을 생성하지 않음',async()=>{const r=await transitPlan({origin:p('s',37,126),destination:p('e',38,127),stops:[],mode:'auto'},{});assert.equal(r.status,503);assert.equal((await r.json()).detail.includes('ODSAY_API_KEY'),true);});
