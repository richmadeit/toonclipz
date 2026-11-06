// Keep existing portfolio/package links working after the homepage becomes a hub.
// A plain bio link still opens the three choices. Do not route arbitrary hashes.
(() => {
  const oldSections = new Set(['#packages', '#examples', '#watch', '#gta-female', '#how', '#faq']);
  const url = new URL(window.location.href);
  if (!oldSections.has(url.hash)) return;
  url.pathname = '/videos/';
  window.location.replace(url.pathname + url.search + url.hash);
})();
