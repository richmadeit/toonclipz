(() => {
  const host = document.createElement('aside');
  host.className = 'tc-live'; host.hidden = true; host.setAttribute('aria-label', 'Watch ToonClipz live');
  const picker = document.createElement('details');
  const toggle = document.createElement('summary');
  const dot = document.createElement('span'); dot.className = 'tc-live-dot'; dot.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span'); label.textContent = 'LIVE NOW';
  toggle.append(dot, label); toggle.setAttribute('aria-label', 'Live now: choose where to watch');
  const menu = document.createElement('div'); menu.className = 'tc-live-menu';
  const title = document.createElement('strong'); title.textContent = 'Watch me create live';
  const links = document.createElement('div'); links.className = 'tc-live-links';
  const note = document.createElement('small'); note.textContent = 'Opens in a new tab. You can keep your place here.';
  menu.append(title, links, note); picker.append(toggle, menu); host.append(picker); document.body.append(host);
  let busy = false, controller, expiry, sequence = 0, currentLinks = '';
  function hide() { host.hidden = true; picker.open = false; currentLinks = ''; links.replaceChildren(); clearTimeout(expiry); }
  function render(data) {
    const names = {instagram: 'Instagram', tiktok: 'TikTok'};
    const channels = Array.isArray(data?.channels) ? data.channels : [];
    const valid = data?.isLive === true && Number.isFinite(data.expiresInMs) && data.expiresInMs > 0 && data.expiresInMs <= 21600000 && channels.length > 0 && channels.length <= 2 && channels.every(channel => {
      try { const url = new URL(channel.url); return names[channel.platform] && url.protocol === 'https:' && [channel.platform + '.com', 'www.' + channel.platform + '.com'].includes(url.hostname) && !url.username && !url.password && !url.port; } catch { return false; }
    });
    if (!valid) { hide(); return; }
    const fingerprint = JSON.stringify(channels);
    if (fingerprint !== currentLinks) {
      links.replaceChildren();
      for (const channel of channels) {
        const link = document.createElement('a'); link.href = channel.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.textContent = 'Watch on ' + names[channel.platform] + ' ↗'; links.append(link);
      }
      currentLinks = fingerprint;
    }
    clearTimeout(expiry); expiry = setTimeout(hide, data.expiresInMs); host.hidden = false;
  }
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true; const request = ++sequence; controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 7000);
    try {
      const response = await fetch('/.netlify/functions/live-status', {cache: 'no-store', credentials: 'omit', signal: controller.signal});
      if (!response.ok) throw new Error('Live status unavailable');
      const data = await response.json(); if (request === sequence) render(data);
    } catch { if (request === sequence) hide(); }
    finally { clearTimeout(timeout); busy = false; }
  }
  document.addEventListener('click', event => { if (!host.contains(event.target)) picker.open = false; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && picker.open) { picker.open = false; toggle.focus(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { sequence++; controller?.abort(); hide(); } else refresh(); });
  window.addEventListener('offline', () => { sequence++; controller?.abort(); hide(); });
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', () => { hide(); refresh(); });
  setInterval(refresh, 20000); refresh();
})();
