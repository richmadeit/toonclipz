import {getStore} from '@netlify/blobs';
import {json} from './traffic/lib/core.mjs';
import {LIVE_STORE, LIVE_KEY, publicLive} from './_shared/live-state.mjs';
export function createHandler(storeFactory = () => getStore({name: LIVE_STORE, consistency: 'strong'}), clock = Date.now) {
  return async function handler(req) {
    if (req.method !== 'GET') return json(405, {error: 'Method not allowed'}, {Allow: 'GET'});
    try {
      const state = await storeFactory().get(LIVE_KEY, {type: 'json', consistency: 'strong'});
      return json(200, publicLive(state, clock()));
    } catch { return json(503, {isLive: false, channels: [], expiresInMs: 0}); }
  };
}
export default createHandler();
export const config = {rateLimit: {windowLimit: 120, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rate_limit'}};
