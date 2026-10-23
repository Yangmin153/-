import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cleanQuery,searchTerms,rankResults,samePlace,splitPaste} from '../public/static/region-search.js';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('지역 검색: 접두 중복 금지와 역외 검색 fallback',()=>{assert.deepEqual(searchTerms('우진해장국','제주'),['제주 우진해장국','우진해장국']);assert.deepEqual(searchTerms('제주 우진해장국','제주'),['제주 우진해장국']);assert.deepEqual(searchTerms('강릉 테라로사','강릉'),['강릉 테라로사']);});
test('선택 지역과 주소 일치하는 결과 우선',()=>{assert.equal(rankResults([{id:'1',address:'서울 강남',name:'X'},{id:'2',address:'제주 제주시',name:'X'}],'제주')[0].id,'2');});
test('붙여넣기 전처리: 한글과 다중 줄',()=>{assert.equal(cleanQuery('여기 우진해장국 가보자'),'우진해장국');assert.deepEqual(splitPaste('우진해장국\n성산일출봉\n\n카페 델문도'),['우진해장국','성산일출봉','카페 델문도']);});
test('동일 장소는 식별자 또는 동일 이름+좌표 기반',()=>{assert.equal(samePlace({name:'카페',lat:33,lng:126,sourceId:'123'},{id:'123',name:'카페',lat:34,lng:127}),true);assert.equal(samePlace({name:'카페',lat:33,lng:126},{name:'카페',lat:34,lng:127}),false);});
