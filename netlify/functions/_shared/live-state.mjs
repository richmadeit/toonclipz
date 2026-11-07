export const LIVE_STORE = 'toonclipz-live-v1';
export const LIVE_KEY = 'current';
export const DURATIONS = [1, 2, 4, 6];
const HOSTS = {instagram: ['instagram.com', 'www.instagram.com'], tiktok: ['tiktok.com', 'www.tiktok.com']};
export function liveUrl(value, platform) {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (value.length > 1024) throw new Error('Live link is too long.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a complete https:// live or profile link.'); }
  if (url.protocol !== 'https:' || !HOSTS[platform]?.includes(url.hostname) || url.username || url.password || url.port || url.pathname === '/') {
    throw new Error('Use a complete ' + platform + ' live or profile link on its official website.');
  }
  return url.href;
}
export function liveConfig(input, now = Date.now()) {
  if (!input || typeof input.enabled !== 'boolean') throw new Error('Choose whether the live button is on or off.');
  if (!input.enabled) return {enabled: false, instagram: '', tiktok: '', expiresAt: 0, updatedAt: now};
  const instagram = liveUrl(input.instagram, 'instagram');
  const tiktok = liveUrl(input.tiktok, 'tiktok');
  if (!instagram && !tiktok) throw new Error('Add at least one broadcast link before turning on the button.');
  const hours = Number(input.hours);
  if (!DURATIONS.includes(hours)) throw new Error('Choose 1, 2, 4 or 6 hours.');
  return {enabled: true, instagram, tiktok, expiresAt: now + hours * 3600000, updatedAt: now};
}
export function publicLive(state, now = Date.now()) {
  const off = {isLive: false, channels: [], expiresInMs: 0};
  if (!state || state.enabled !== true || !Number.isFinite(state.expiresAt) || state.expiresAt <= now || state.expiresAt > now + 6 * 3600000) return off;
  try {
    const channels = ['instagram', 'tiktok'].flatMap(platform => {
      const url = liveUrl(state[platform], platform);
      return url ? [{platform, url}] : [];
    });
    return channels.length ? {isLive: true, channels, expiresInMs: state.expiresAt - now} : off;
  } catch { return off; }
}

export function savedLiveLinks(state) {
  return Object.fromEntries(['instagram', 'tiktok'].map(platform => {
    try { return [platform, liveUrl(state?.[platform], platform)]; } catch { return [platform, '']; }
  }));
}
