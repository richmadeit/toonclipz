import {createHmac, createHash, randomBytes} from 'node:crypto';
import {validate, reply, limitedJson} from './_shared/free-video-validation.mjs';
import {multipartInput} from './_shared/free-video-audio.mjs';

const SITE_ORIGIN = 'https://toonclipz.netlify.app';
const STORE_NAME = 'toonclipz-free-video-intake';

export async function productionStore() {
  // Credentials are supplied by Netlify at runtime, never minted or sent to clients.
  const {getStore} = await import('@netlify/blobs');
  return getStore({name: STORE_NAME, consistency: 'strong'});
}

async function hashingSalt(store) {
  let salt = await store.get('system/hash-salt');
  if (!salt) {
    // A private random salt for pseudonymous keys, not an authentication credential.
    await store.set('system/hash-salt', randomBytes(32).toString('hex'), {onlyIfNew: true});
    salt = await store.get('system/hash-salt');
  }
  if (typeof salt !== 'string' || !/^[a-f0-9]{64}$/.test(salt)) throw new Error('storage_unavailable');
  return salt;
}

export async function saveSubmission(store, value, time = new Date(), audio = null, photo = null) {
  const salt = await hashingSalt(store);
  const hash = input => createHmac('sha256', salt).update(input).digest('hex');
  const fingerprint = hash('request:' + JSON.stringify({...value, audio:audio?.descriptor || null,photo:photo?.descriptor || null}));
  const recordKey = 'submissions/' + value.requestId;
  const verifyStoredFiles = async () => {
    for(const [kind,file] of [['audio',audio],['photo',photo]]) {
      if(!file)continue;
      const saved=await store.get(kind+'/'+value.requestId,{type:'arrayBuffer'});
      if(!(saved instanceof ArrayBuffer))throw new Error('storage_unavailable');
      const bytes=Buffer.from(saved);
      if(bytes.length!==file.descriptor.size || createHash('sha256').update(bytes).digest('hex')!==file.descriptor.sha256)throw new Error('storage_unavailable');
    }
  };
  const existing = await store.get(recordKey, {type: 'json'});
  if (existing) {
    if(existing.fingerprint!==fingerprint)return 'conflict';
    await verifyStoredFiles();
    return 'accepted';
  }

  // Atomic per-email hour claim prevents races across function instances.
  // Failed writes can be resumed with the same id, including after a client timeout.
  const hour = Math.floor(time.getTime() / 3600000);
  const claimKey = `limits/${hour}/${hash('contact:' + value.email)}`;
  const claim = {requestId: value.requestId, fingerprint};
  const {modified: claimed} = await store.setJSON(claimKey, claim, {onlyIfNew: true});
  if (!claimed) {
    const previous = await store.get(claimKey, {type: 'json'});
    if (!previous) throw new Error('storage_unavailable');
    if (previous.requestId !== value.requestId) return 'rate_limited';
    if (previous.fingerprint !== fingerprint) return 'conflict';
  }
  const files={audio:null,photo:null};
  for(const [kind,file] of [['audio',audio],['photo',photo]]) {
    if(!file)continue;
    const key=kind+'/'+value.requestId;
    const {modified}=await store.set(key,new Blob([file.bytes],{type:file.descriptor.type}),{onlyIfNew:true,metadata:{...file.descriptor,reference:value.requestId}});
    if(!modified) {
      const previous=await store.getWithMetadata(key,{type:'arrayBuffer'});
      if(previous?.metadata?.sha256!==file.descriptor.sha256)return 'conflict';
    }
    files[kind]={key,...file.descriptor};
  }
  await verifyStoredFiles();
  const record = {
    reference: value.requestId, createdAt: time.toISOString(), status: 'received',
    artistName: value.artistName, email: value.email, songUrl: value.songUrl,
    startSeconds: value.startSeconds, clipSeconds: 15, audio:files.audio, photo:files.photo,
    rightsVersion: value.rightsVersion, rightsConsentedAt: time.toISOString(), fingerprint
  };
  await store.setJSON(recordKey, record, {onlyIfNew: true, metadata: {createdAt: record.createdAt, status: 'received'}});
  const saved = await store.get(recordKey, {type: 'json'});
  if (!saved) throw new Error('storage_unavailable');
  return saved.fingerprint === fingerprint ? 'accepted' : 'conflict';
}

export function createHandler({env = process.env, openStore = productionStore, now = () => new Date()} = {}) {
  return async function handler(request) {
    if (!['GET','POST'].includes(request.method)) return reply(405, {status: 'invalid_request'}, {'Allow':'GET, POST'});
    const allowed = env.FREE_VIDEO_ENABLED !== 'false' && new URL(request.url).origin === SITE_ORIGIN;
    if (!allowed) return request.method === 'GET' ? reply(200, {enabled:false}) : reply(503, {status:'unavailable'});
    if (request.method === 'GET') {
      try {
        const store = await openStore();
        // Read-only readiness probe. A missing key is fine; missing storage is not.
        await store.get('system/readiness');
        return reply(200, {enabled:true});
      } catch { return reply(200, {enabled:false}); }
    }
    // Anti-CSRF. The public endpoint is rate-limited, not a public database API.
    if (request.headers.get('origin') !== SITE_ORIGIN || ['cross-site','none'].includes(request.headers.get('sec-fetch-site'))) return reply(403, {status:'invalid_request'});
    const contentType=request.headers.get('content-type') || '';
    let body,audio=null,photo=null;
    try {
      if(/^multipart\/form-data\s*;/i.test(contentType)) {
        const parsed=await multipartInput(request);
        if(parsed.error)return reply(400,{status:'invalid_request',field:parsed.error});
        body=parsed.body;audio=parsed.audio;photo=parsed.photo;
      } else if(/^application\/json(?:\s*;|$)/i.test(contentType)) body=await limitedJson(request);
      else return reply(415,{status:'invalid_request'});
    } catch (error) { return reply(error.message === 'too_large' ? 413 : 400, {status:'invalid_request'}); }
    const input = validate(body,{hasAudio:Boolean(audio),hasPhoto:Boolean(photo)});
    if (input.error) return reply(400, {status:'invalid_request',field:input.error});
    try {
      const outcome = await saveSubmission(await openStore(), input.value, now(), audio, photo);
      if (outcome === 'accepted') return reply(201, {status:'received',reference:input.value.requestId});
      if (outcome === 'rate_limited') return reply(429, {status:'rate_limited'}, {'Retry-After':'3600'});
      if (outcome === 'conflict') return reply(409, {status:'conflict'});
    } catch { /* Never expose records, provider errors or secrets. */ }
    return reply(503, {status:'unavailable'});
  };
}

// Netlify enforces this before invocation; no raw IP is stored by the application.
export const config = {rateLimit: {windowLimit: 20, windowSize: 60, aggregateBy: ['ip','domain']}};
export default createHandler();
