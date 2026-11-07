import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../dashboard-live.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const elements = new Map(), events = {}, timers = new Map(); let timerId = 0; const state = {timers, abortAware: false, calls: [], data: {isLive: false, channels: []}, delay: false, pending: null, error: false};
  const el = id => {if (!elements.has(id)) elements.set(id, {id, hidden: id === 'dashboard', disabled: false, value: id === 'liveHours' ? '4' : '', textContent: '', listeners: {}, addEventListener(type, fn) {this.listeners[type] = fn;}}); return elements.get(id);};
  const document = {getElementById: el, hidden: false, addEventListener(name, fn) {events[name] = fn;}};
  const fetch = async (path, options) => {state.calls.push({path, options}); if (state.delay) return new Promise((resolve, reject) => {state.pending = () => resolve(Response.json(state.data)); if (state.abortAware) options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));}); if (state.error) return Response.json({error: 'Storage unavailable'}, {status: 503}); if (options.method === 'POST') {const data = JSON.parse(options.body); state.data = {isLive: data.enabled, channels: data.enabled ? [{platform: 'instagram', url: data.instagram}] : [], settings: {instagram: data.instagram, tiktok: data.tiktok}, expiresAt: Date.now() + 14400000};} return Response.json(state.data);};
  class MutationObserver {constructor(fn) {state.mutate = fn;} observe() {}}
  vm.runInNewContext(source, {document, MutationObserver, fetch, Date, Number, JSON, AbortController, DOMException, setTimeout: (fn, ms) => {timers.set(++timerId, {fn, ms}); return timerId;}, clearTimeout: id => timers.delete(id), setInterval: fn => {state.interval = fn;}});
  return {state, el, document, events, login: async () => {el('dashboard').hidden = false; state.mutate(); await tick();}};
}
test('live controls stay disabled behind login, load on sign-in, and ignore redundant visibility mutations', async () => {
  const h = setup(); assert.equal(h.el('liveStart').disabled, true); assert.equal(h.state.calls.length, 0);
  await h.login(); assert.equal(h.el('liveStart').disabled, false); assert.equal(h.state.calls.length, 1); assert.equal(h.el('liveBadge').textContent, 'OFF');
  h.state.mutate(); await tick(); assert.equal(h.state.calls.length, 1);
});
test('start/stop posts exact form links, prevents double click, reports server state not optimistic success', async () => {
  const h = setup(); await h.login(); h.el('liveInstagram').value = 'https://www.instagram.com/example/live/';
  h.el('liveForm').listeners.submit({preventDefault() {}}); await tick();
  const call = h.state.calls.at(-1); assert.equal(call.options.method, 'POST'); assert.equal(JSON.parse(call.options.body).instagram, h.el('liveInstagram').value); assert.equal(h.el('liveBadge').textContent, 'ON · LIVE NOW');
  h.el('liveStop').listeners.click(); await tick(); assert.equal(h.el('liveBadge').textContent, 'OFF');
  h.state.delay = true; h.el('liveForm').listeners.submit({preventDefault() {}}); h.el('liveForm').listeners.submit({preventDefault() {}}); await tick(); const calls = h.state.calls.length;
  h.el('liveStop').listeners.click(); assert.equal(h.state.calls.length, calls); assert.equal(h.el('liveStart').disabled, true);
  h.state.pending(); await tick(); assert.equal(h.el('liveStart').disabled, false);
});
test('save failure is visibly unverified; signout blocks late responses and clears form', async () => {
  const h = setup(); await h.login(); h.state.error = true; h.el('liveForm').listeners.submit({preventDefault() {}}); await tick();
  assert.equal(h.el('liveBadge').textContent, 'UNVERIFIED'); assert.match(h.el('liveMessage').textContent, /Check status/);
  h.state.error = false; h.state.delay = true; h.el('liveForm').listeners.submit({preventDefault() {}}); await tick();
  h.el('dashboard').hidden = true; h.state.mutate(); h.state.data = {isLive: true, channels: [], expiresAt: Date.now() + 10000}; h.state.pending(); await tick();
  assert.equal(h.el('liveBadge').textContent, 'OFF'); assert.equal(h.el('liveStart').disabled, true); assert.equal(h.el('liveInstagram').value, '');
});
test('status refresh never overwrites unsaved input and hidden tabs pause polling', async () => {
  const h = setup(); await h.login(); h.el('liveInstagram').value = 'https://instagram.com/my-new-live/'; h.el('liveForm').listeners.input();
  h.state.data = {isLive: true, channels: [{platform: 'instagram', url: 'https://instagram.com/old/live/'}], expiresAt: Date.now() + 10000}; await h.state.interval();
  assert.equal(h.el('liveInstagram').value, 'https://instagram.com/my-new-live/');
  h.document.hidden = true; const calls = h.state.calls.length; await h.state.interval(); assert.equal(h.state.calls.length, calls);
});

test('Stop takes priority over a stalled poll and a late read cannot restore live state', async () => {
  const h = setup(); await h.login(); h.state.delay = true; h.state.interval(); await tick(); const completeRead = h.state.pending;
  h.state.delay = false; h.el('liveStop').listeners.click(); await tick();
  assert.equal(h.state.calls.at(-1).options.method, 'POST'); assert.equal(JSON.parse(h.state.calls.at(-1).options.body).enabled, false);
  assert.equal(h.el('liveBadge').textContent, 'OFF');
  h.state.data = {isLive: true, settings: {}, expiresAt: Date.now() + 10000}; completeRead(); await tick();
  assert.equal(h.el('liveBadge').textContent, 'OFF');
});
test('authoritative clean settings clear removed platforms and retain saved links while off', async () => {
  const h = setup(); await h.login(); h.state.data = {isLive: true, settings: {instagram: 'https://instagram.com/first/live/', tiktok: 'https://tiktok.com/@second/live'}, expiresAt: Date.now() + 10000};
  h.state.interval(); await tick(); assert.match(h.el('liveTiktok').value, /second/);
  h.state.data = {isLive: false, settings: {instagram: 'https://instagram.com/first/live/', tiktok: ''}};
  h.state.interval(); await tick(); assert.equal(h.el('liveTiktok').value, ''); assert.match(h.el('liveInstagram').value, /first/);
});

test('timed-out writes recover controls without claiming success or retrying', async () => {
  const h = setup(); await h.login(); h.state.delay = true; h.state.abortAware = true;
  h.el('liveForm').listeners.submit({preventDefault() {}}); await tick();
  const calls = h.state.calls.length, timeout = [...h.state.timers.values()].find(timer => timer.ms === 8000); assert.ok(timeout);
  timeout.fn(); await tick(); assert.equal(h.el('liveStart').disabled, false); assert.equal(h.el('liveBadge').textContent, 'UNVERIFIED'); assert.match(h.el('liveMessage').textContent, /not confirmed/); assert.equal(h.state.calls.length, calls);
  h.state.delay = false; h.el('liveStop').listeners.click(); await tick(); assert.equal(h.el('liveBadge').textContent, 'OFF');
});
test('dirty form keeps its edit-base revision when another session changes status', async () => {
  const h = setup(); h.state.data = {isLive: true, revision: 1, settings: {instagram: 'https://instagram.com/first/live/'}, expiresAt: Date.now() + 10000}; await h.login();
  h.el('liveInstagram').value = 'https://instagram.com/edited/live/'; h.el('liveForm').listeners.input();
  h.state.data = {isLive: false, revision: 2, settings: {instagram: 'https://instagram.com/first/live/'}}; h.state.interval(); await tick();
  h.el('liveForm').listeners.submit({preventDefault() {}}); await tick(); assert.equal(JSON.parse(h.state.calls.at(-1).options.body).expectedRevision, 1);
});
