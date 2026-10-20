import {searchPlaces} from '../lib/place-search.js';
export async function GET(request){return searchPlaces(request,process.env);}
