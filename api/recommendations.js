import {recommendations} from '../lib/recommend.js';
export async function GET(request){return recommendations(request,process.env);}
