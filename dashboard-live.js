(() => {
  const $ = id => document.getElementById(id), dashboard = $('dashboard'), form = $('liveForm');
  if (!dashboard || !form) return;
  const fields = ['liveInstagram', 'liveTiktok', 'liveHours', 'liveStart', 'liveStop'];
  let saving = false, pendingRead = null, generation = 0, sequence = 0, dirty = false, lastHidden, revision = 0;
  function disable(value) { for (const id of fields) $(id).disabled = value; }
  function render(data) {
    if (!dirty) revision = Number.isSafeInteger(data.revision) ? data.revision : 0;
    $('liveBadge').textContent = data.isLive ? 'ON · LIVE NOW' : 'OFF';
    $('liveState').textContent = data.isLive ? 'Visitors can see the button. It automatically hides at ' + new Date(data.expiresAt).toLocaleString() + '. Turn it off when your broadcast ends.' : 'The live button is hidden from visitors.';
    if (!dirty) {
      $('liveInstagram').value = data.settings?.instagram || '';
      $('liveTiktok').value = data.settings?.tiktok || '';
    }
  }
  async function request(options = {}, controller = new AbortController()) {
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/.netlify/functions/dashboard-live', {...options, cache: 'no-store', credentials: 'same-origin', signal: controller.signal});
      let data; try { data = await response.json(); } catch { throw new Error('Live status could not be checked. Refresh before trying again.'); }
      if (!response.ok) throw new Error(data.error || 'Live status is unavailable.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The connection timed out. The change is not confirmed.');
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function refresh() {
    if (saving || pendingRead || dashboard.hidden || document.hidden) return;
    const controller = new AbortController(); pendingRead = controller;
    const current = generation, reading = ++sequence;
    try {
      const data = await request({}, controller);
      if (current === generation && reading === sequence && !dashboard.hidden) { render(data); $('liveMessage').textContent = ''; }
    } catch (error) {
      if (current === generation && reading === sequence && !dashboard.hidden) { $('liveBadge').textContent = 'UNVERIFIED'; $('liveMessage').textContent = error.message; }
    } finally { if (pendingRead === controller) pendingRead = null; }
  }
  async function save(enabled) {
    if (saving || dashboard.hidden) return;
    // A user action takes priority over background polling, especially Stop.
    sequence++; pendingRead?.abort(); pendingRead = null;
    saving = true; disable(true); const current = generation;
    $('liveMessage').textContent = enabled ? 'Turning on the website button…' : 'Turning off the website button…';
    try {
      const data = await request({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({enabled, expectedRevision: revision, instagram: $('liveInstagram').value, tiktok: $('liveTiktok').value, hours: Number($('liveHours').value)})});
      if (current !== generation || dashboard.hidden) return;
      dirty = false; render(data); $('liveMessage').textContent = enabled ? 'Saved. Visitors already on the site see updates within about 20 seconds.' : 'Saved. The button will disappear for visitors within about 20 seconds.';
    } catch (error) {
      if (current === generation && !dashboard.hidden) { $('liveBadge').textContent = 'UNVERIFIED'; $('liveMessage').textContent = error.message + ' Use “Check status” to verify the current state.'; }
    } finally { saving = false; disable(dashboard.hidden); }
  }
  form.addEventListener('input', () => { dirty = true; });
  form.addEventListener('submit', event => { event.preventDefault(); save(true); });
  $('liveStop').addEventListener('click', () => save(false));
  $('liveCheck').addEventListener('click', refresh);
  function gateChanged() {
    if (lastHidden === dashboard.hidden) return;
    lastHidden = dashboard.hidden; generation++; sequence++; pendingRead?.abort(); pendingRead = null; disable(dashboard.hidden || saving);
    if (dashboard.hidden) { dirty = false; $('liveInstagram').value = ''; $('liveTiktok').value = ''; $('liveMessage').textContent = ''; $('liveBadge').textContent = 'OFF'; }
    else refresh();
  }
  new MutationObserver(gateChanged).observe(dashboard, {attributes: true, attributeFilter: ['hidden']});
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!dashboard.hidden && !document.hidden) refresh(); }, 30000);
  gateChanged();
})();
