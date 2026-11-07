import {getStore} from '@netlify/blobs';
import {authorized, json, sameOrigin, secret} from './traffic/lib/core.mjs';
import {LIVE_STORE, LIVE_KEY, liveConfig, publicLive, savedLiveLinks} from './_shared/live-state.mjs';
export function createHandler(storeFactory = () => getStore({name: LIVE_STORE, consistency: 'strong'}), env = process.env, clock = Date.now) {
  return async function handler(req) {
    if (!['GET', 'POST'].includes(req.method)) return json(405, {error: 'Method not allowed'}, {Allow: 'GET, POST'});
    const key = secret(env);
    if (!key) return json(503, {error: 'The private dashboard must be configured before using live controls.'});
    if (!authorized(req, key, clock())) return json(401, {error: 'Please sign in to the owner dashboard.'});
    if (req.method === 'POST' && !sameOrigin(req)) return json(403, {error: 'Invalid origin'});
    if (req.method === 'POST' && req.headers.get('content-type')?.split(';')[0] !== 'application/json') return json(415, {error: 'JSON is required.'});
    let input;
    if (req.method === 'POST') {
      try {
        const raw = await req.text();
        if (raw.length > 4096) return json(413, {error: 'Request too large'});
        input = JSON.parse(raw);
      } catch { return json(400, {error: 'Invalid request'}); }
    }
    let next;
    if (input !== undefined) {
      try { next = liveConfig(input, clock()); }
      catch (error) { return json(400, {error: error.message}); }
    }
    try {
      const store = storeFactory();
      if (next) {
        const previous = await store.getWithMetadata(LIVE_KEY, {type: 'json', consistency: 'strong'});
        const revision = previous?.data?.revision || 0;
        if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision !== revision) return json(409, {error: 'Live settings changed in another window. Reload this page for the latest settings before trying again.'});
        if (!next.enabled) Object.assign(next, savedLiveLinks(previous?.data));
        next.revision = revision + 1;
        const result = await store.setJSON(LIVE_KEY, next, previous ? {onlyIfMatch: previous.etag} : {onlyIfNew: true});
        if (!result.modified) return json(409, {error: 'Live settings changed in another window. Reload this page for the latest settings before trying again.'});
      }
      const state = next || await store.get(LIVE_KEY, {type: 'json', consistency: 'strong'});
      return json(200, {...publicLive(state, clock()), settings: savedLiveLinks(state), revision: state?.revision || 0, expiresAt: state?.expiresAt || 0, updatedAt: state?.updatedAt || 0});
    } catch { return json(503, {error: 'Live status could not be saved or checked. Refresh to verify before trying again.'}); }
  };
}
export default createHandler();
export const config = {rateLimit: {windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'], action: 'rate_limit'}};
