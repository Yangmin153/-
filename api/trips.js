import {handleTrips} from '../lib/trips.js';
// Vercel supplies a platform context as the second argument, not environment variables.
// Always pass process.env explicitly. Never treat the Vercel context as credentials.
const route=request=>handleTrips(request,process.env);
export const GET=route,POST=route,PATCH=route,DELETE=route;
