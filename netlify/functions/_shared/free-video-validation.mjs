export const RIGHTS_VERSION = 'free-video-2026-11-06';
export const MAX_BYTES = 8192;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const HOSTS = new Set(['youtube.com','www.youtube.com','music.youtube.com','youtu.be','soundcloud.com','www.soundcloud.com','on.soundcloud.com','open.spotify.com','music.apple.com','audiomack.com','www.audiomack.com','drive.google.com','www.dropbox.com','dropbox.com']);

export function songUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || CONTROL.test(raw) || /\s|\\/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !HOSTS.has(url.hostname) || url.pathname === '/') return null;
    // Store a link for manual review. Never fetch, embed or follow its redirects.
    return url.href;
  } catch { return null; }
}

export function timestamp(raw) {
  if (typeof raw !== 'string' || !/^\d{1,3}:[0-5]\d$/.test(raw)) return null;
  const [minutes, seconds] = raw.split(':').map(Number);
  const value = minutes * 60 + seconds;
  return value <= 35985 ? value : null;
}

export function validate(body, {hasAudio = false} = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {error: 'invalid_request'};
  const allowed = new Set(['requestId','artistName','email','songUrl','startTime','rightsConsent','website']);
  if (Object.keys(body).some(key => !allowed.has(key))) return {error: 'invalid_request'};
  if (body.website !== undefined && body.website !== '') return {error: 'invalid_request'};
  const artist = typeof body.artistName === 'string' ? body.artistName.trim() : '';
  if (artist.length < 1 || artist.length > 80 || CONTROL.test(artist)) return {error: 'artistName'};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@<>]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(email) || email.includes('..') || CONTROL.test(email)) return {error: 'email'};
  const url = songUrl(body.songUrl);
  if ((!hasAudio || body.songUrl) && !url) return {error: 'songUrl'};
  const start = timestamp(body.startTime);
  if (start === null) return {error: 'startTime'};
  if (body.rightsConsent !== true) return {error: 'rightsConsent'};
  if (typeof body.requestId !== 'string' || !UUID.test(body.requestId)) return {error: 'invalid_request'};
  return {value: {requestId: body.requestId.toLowerCase(), artistName: artist, email, songUrl: url, startSeconds: start, rightsVersion: RIGHTS_VERSION}};
}

export const reply = (status, body, extra = {}) => new Response(JSON.stringify(body), {status, headers: {
  'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra
}});

export async function limitedBytes(request, limit = MAX_BYTES) {
  if (Number(request.headers.get('content-length')) > limit) throw new Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('empty');
  let size = 0, chunks = [];
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function limitedJson(request) {
  return JSON.parse((await limitedBytes(request)).toString('utf8'));
}

