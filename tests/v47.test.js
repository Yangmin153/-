import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('네이버 자동차 및 카카오 장소 검색 엔드포인트 유지',async()=>{
 assert.match(await read('api/route.js'),/buildPlan/);assert.match(await read('api/places.js'),/searchPlaces/);
});
