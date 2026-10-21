/** Unified place/address result helpers. API credentials remain server-side. */
(function(root){'use strict';
 const addressPattern=/(?:[가-힣A-Za-z0-9]+(?:대로|번길|로|길)\s*\d|[가-힣]+(?:동|읍|면|리)\s*\d|\d{1,4}-\d{1,4}|(?:특별시|광역시|특별자치시|특별자치도)\s*.+\d)/;
 function looksLikeAddress(query){const q=String(query??'').trim();return addressPattern.test(q)||/\d+번지/.test(q);}
 function normalizeAddresses(results){return (Array.isArray(results)?results:[]).filter(x=>Number.isFinite(x.lat)&&Number.isFinite(x.lng)&&x.address).map((x,i)=>({id:`naver-address-${i}-${x.lat.toFixed(6)}-${x.lng.toFixed(6)}`,name:x.address,address:x.address,category:'주소',lat:x.lat,lng:x.lng,source:'naver-address',jibunAddress:'',url:''}));}
 function combine(items,addresses){const result=[...(Array.isArray(items)?items:[])];for(const address of normalizeAddresses(addresses))if(!result.some(x=>Math.abs(x.lat-address.lat)<0.00015&&Math.abs(x.lng-address.lng)<0.00015))result.push(address);return result;}
 root.TripSearch=Object.freeze({looksLikeAddress,normalizeAddresses,combine});
})(globalThis);
