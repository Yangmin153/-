import {json,ready} from '../lib/core.js';
export function GET(){const env=process.env;return json({mapsKeyId:env.NAVER_MAPS_JS_KEY_ID||env.NAVER_MAPS_CLIENT_ID||'',directionsReady:ready(env),geocodeReady:ready(env),transitReady:Boolean(env.ODSAY_API_KEY),version:'4.0.0'});}
