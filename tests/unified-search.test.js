import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
await import('../public/static/search-utils.js');
const {looksLikeAddress,normalizeAddresses,combine}=globalThis.TripSearch;
test('장소명과 주소를 구분',()=>{for(const x of ['하림각','성산일출봉','스타벅스 제주'])assert.equal(looksLikeAddress(x),false);for(const x of ['제주시 공항로 2','종로구 자하문로 255','부암동 1'])assert.equal(looksLikeAddress(x),true);});
test('네이버 주소 결과 정규화',()=>{const [x]=normalizeAddresses([{address:'제주시 공항로 2',lat:33.5104,lng:126.4913}]);assert.equal(x.source,'naver-address');assert.equal(x.category,'주소');});
test('카카오 좌표와 중복되는 주소만 제거',()=>{const x=combine([{id:'1',name:'공항',lat:33.5104,lng:126.4913}],[{address:'제주시 공항로 2',lat:33.51041,lng:126.49131},{address:'제주시 노형동 1',lat:33.5,lng:126.52}]);assert.equal(x.length,2);});
