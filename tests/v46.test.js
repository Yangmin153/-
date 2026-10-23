import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=async p=>readFile(new URL('../'+p,import.meta.url),'utf8'),p=(id,lat,lng,locked=false)=>({id,name:id,lat,lng,locked});
test('네이버 자동차 API 보존',async()=>{const core=await read('lib/core.js');assert.match(core,/DIRECTION_API/);});
