import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {liveConfig, publicLive, liveUrl} from '../netlify/functions/_shared/live-state.mjs';
import {createHandler as publicHandler} from '../netlify/functions/live-status.mjs';
import {createHandler as adminHandler} from '../netlify/functions/dashboard-live.mjs';
import {cookie} from '../netlify/functions/traffic/lib/core.mjs';
const now = 1794067200000, password = 'local-test-only-password-12345';
const input = {enabled: true, instagram: 'https://www.instagram.com/example/live/', tiktok: 'https://www.tiktok.com/@example/live', hours: 4};
function harness() {
  let state = null, reads = 0, writes = 0, broken = false, version = 0;
  const store = {get: async () => {reads++; if (broken) throw Error('offline'); return state;}, getWithMetadata: async () => {reads++; if (broken) throw Error('offline'); return state ? {data: structuredClone(state), etag: String(version)} : null;}, setJSON: async (key, data, options) => {writes++; if (broken) throw Error('offline'); if (options.onlyIfNew ? !!state : options.onlyIfMatch !== String(version)) return {modified: false}; state = data; version++; return {modified: true};}};
  const handler = adminHandler(() => store, {TOONCLIPZ_DASHBOARD_PASSWORD: password}, () => now);
  const req = (body, headers = {}, method = 'POST') => new Request('https://site.test/.netlify/functions/dashboard-live', {method, headers: {cookie: cookie(password, now).split(';')[0], origin: 'https://site.test', 'content-type': 'application/json', ...headers}, ...(method === 'POST' ? {body: typeof body === 'string' ? body : JSON.stringify(body && {...body, expectedRevision: body.expectedRevision ?? state?.revision ?? 0})} : {})});
  return {handler, req, store, state: () => state, reads: () => reads, writes: () => writes, break: () => {broken = true;}};
}
test('offline is default, expired or malformed live states fail closed, exact timer boundary', () => {
  for (const state of [null, {}, {...liveConfig(input, now), enabled: false}, {...liveConfig(input, now), expiresAt: now}, {...liveConfig(input, now), expiresAt: now + 7 * 3600000}, {...liveConfig(input, now), tiktok: 'https://evil.test/live'}]) assert.equal(publicLive(state, now).isLive, false);
  assert.equal(publicLive(liveConfig(input, now), now).channels.length, 2);
  assert.equal(publicLive(liveConfig(input, now), now + 4 * 3600000 - 1).expiresInMs, 1);
  assert.equal(publicLive(liveConfig(input, now), now + 4 * 3600000).isLive, false);
});
test('only official HTTPS live destinations and bounded duration accepted', () => {
  for (const url of ['javascript:alert(1)', 'http://instagram.com/example', 'https://instagram.com.evil.test/example', 'https://instagram.com@evil.test/example', 'https://user:pass@instagram.com/example', 'https://instagram.com:8443/example', 'https://instagram.com/']) assert.throws(() => liveUrl(url, 'instagram'));
  for (const data of [{...input, hours: 0}, {...input, hours: 24}, {...input, instagram: '', tiktok: ''}, {...input, enabled: 'true'}, null]) assert.throws(() => liveConfig(data, now));
  assert.equal(liveConfig({enabled: false}, now).enabled, false);
});
test('authenticated owner can start and stop; public API only exposes current live channels', async () => {
  const h = harness(), publicRead = publicHandler(() => h.store, () => now);
  assert.equal((await publicRead(new Request('https://site.test'))).status, 200);
  assert.equal(h.writes(), 0);
  let response = await h.handler(h.req(input)); assert.equal(response.status, 200);
  let data = await response.json(); assert.equal(data.isLive, true); assert.equal(data.expiresAt, now + 4 * 3600000);
  response = await publicRead(new Request('https://site.test')); data = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ['channels', 'expiresInMs', 'isLive']); assert.equal(response.headers.get('cache-control'), 'no-store');
  const stopped = await h.handler(h.req({enabled: false})); assert.equal(stopped.status, 200); assert.equal((await stopped.json()).settings.instagram, input.instagram);
  assert.equal((await (await publicRead(new Request('https://site.test'))).json()).isLive, false);
});
test('owner endpoints reject absent, forged and expired cookies before storage access', async () => {
  const h = harness();
  for (const auth of ['', 'forged', cookie(password, now - 43200001).split(';')[0], cookie('wrong-password-12345', now).split(';')[0]]) {
    assert.equal((await h.handler(h.req(input, {cookie: auth}))).status, 401);
    assert.equal((await h.handler(h.req(null, {cookie: auth}, 'GET'))).status, 401);
  }
  assert.equal(h.reads(), 0); assert.equal(h.writes(), 0);
  const noSetup = adminHandler(() => h.store, {}, () => now); assert.equal((await noSetup(h.req(input))).status, 503);
});
test('write origin, content type, payload size, method and validation checks precede all writes', async () => {
  const h = harness();
  assert.equal((await h.handler(h.req(input, {origin: 'https://evil.test'}))).status, 403);
  assert.equal((await h.handler(h.req(input, {'content-type': 'text/plain'}))).status, 415);
  assert.equal((await h.handler(h.req('x'.repeat(5000)))).status, 413);
  assert.equal((await h.handler(h.req('{broken'))).status, 400);
  assert.equal((await h.handler(h.req({...input, instagram: 'https://evil.test'}))).status, 400);
  assert.equal((await h.handler(h.req(null, {}, 'DELETE'))).status, 405);
  assert.equal(h.writes(), 0);
  assert.equal((await publicHandler(() => h.store)(h.req(input))).status, 405);
});
test('storage failure never fabricates live status or reports a successful write', async () => {
  const h = harness(); h.break();
  const response = await publicHandler(() => h.store)(new Request('https://site.test'));
  assert.equal(response.status, 503); assert.equal((await response.json()).isLive, false);
  assert.equal((await h.handler(h.req(input))).status, 503);
});
const source = readFileSync(new URL('../live-button.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function browser() {
  const events = {}, windowEvents = {}, timers = new Map(), state = {data: {isLive: false, channels: [], expiresInMs: 0}, error: false, calls: 0, interval: null, pending: null, delay: false}; let timer = 0;
  function element(tag) {return {tag, children: [], attrs: {}, hidden: false, open: false, append(...children) {this.children.push(...children);}, replaceChildren(...children) {this.children = children;}, setAttribute(name, value) {this.attrs[name] = value;}, contains(target) {return target === this || this.children.some(c => c.contains?.(target));}, focus() {this.focused = true;}};}
  const document = {hidden: false, body: element('body'), createElement: element, addEventListener: (name, fn) => {events[name] = fn;}};
  const fetch = async (path, options) => {state.calls++; assert.equal(path, '/.netlify/functions/live-status'); assert.equal(options.credentials, 'omit'); if (state.delay) return new Promise(resolve => {state.pending = () => resolve(Response.json(state.data));}); if (state.error) throw Error('offline'); return Response.json(state.data);};
  vm.runInNewContext(source, {document, window: {addEventListener: (name, fn) => {windowEvents[name] = fn;}}, URL, AbortController, fetch, setInterval: fn => {state.interval = fn;}, setTimeout: (fn, delay) => {timers.set(++timer, {fn, delay}); return timer;}, clearTimeout: id => timers.delete(id), JSON, Number});
  return {state, document, events, windowEvents, timers, host: document.body.children[0]};
}
test('existing visitor sees start/stop without reload, safe external links and usable close actions', async () => {
  const h = browser(); await tick(); assert.equal(h.host.hidden, true);
  h.state.data = publicLive(liveConfig(input, now), now); await h.state.interval(); assert.equal(h.host.hidden, false);
  const details = h.host.children[0], links = details.children[1].children[1];
  assert.equal(links.children.length, 2); assert.equal(links.children[0].target, '_blank'); assert.equal(links.children[0].rel, 'noopener noreferrer');
  details.open = true; h.events.keydown({key: 'Escape'}); assert.equal(details.open, false); assert.equal(details.children[0].focused, true);
  details.open = true; h.events.click({target: {}}); assert.equal(details.open, false);
  h.state.data = {isLive: false}; await h.state.interval(); assert.equal(h.host.hidden, true); assert.equal(links.children.length, 0);
});
test('failures, offline, expiry and invalid data hide the button; return to tab refreshes', async () => {
  const h = browser(); await tick(); h.state.data = publicLive(liveConfig(input, now), now); await h.state.interval();
  const expire = [...h.timers.values()].find(t => t.delay === 4 * 3600000); assert.ok(expire); expire.fn(); assert.equal(h.host.hidden, true);
  await h.state.interval(); h.state.error = true; await h.state.interval(); assert.equal(h.host.hidden, true);
  h.state.error = false; await h.state.interval(); h.windowEvents.offline(); assert.equal(h.host.hidden, true);
  h.document.hidden = true; h.events.visibilitychange(); const calls = h.state.calls; await h.state.interval(); assert.equal(h.state.calls, calls);
  h.document.hidden = false; h.events.visibilitychange(); await tick(); assert.equal(h.host.hidden, false);
  h.state.data.channels[0].url = 'javascript:alert(1)'; await h.state.interval(); assert.equal(h.host.hidden, true);
});
test('late responses after leaving page cannot restore an obsolete live button', async () => {
  const h = browser(); await tick(); h.state.data = publicLive(liveConfig(input, now), now); h.state.delay = true;
  const request = h.state.interval(); await tick(); h.document.hidden = true; h.events.visibilitychange(); h.state.pending(); await request;
  assert.equal(h.host.hidden, true);
});
test('both landing pages include assets; static build and reduced-motion support are included', () => {
  for (const path of ['index.html', 'videos/index.html']) {const html = readFileSync(new URL('../' + path, import.meta.url), 'utf8'); assert.match(html, /src="\/live-button.js/); assert.match(html, /href="\/live-button.css/);}
  const css = readFileSync(new URL('../live-button.css', import.meta.url), 'utf8'); assert.match(css, /prefers-reduced-motion:reduce/); assert.match(css, /animation:none/);
  const build = readFileSync(new URL('../scripts/build-site.mjs', import.meta.url), 'utf8'); for (const path of ['live-button.js', 'live-button.css', 'dashboard-live.js']) assert.ok(build.includes("'" + path + "'"));
  assert.ok(!source.includes('localStorage')); assert.ok(!source.includes('innerHTML'));
});

test('stale Start cannot override newer Stop across dashboard sessions', async () => {
  const h = harness();
  assert.equal((await h.handler(h.req({...input, expectedRevision: 0}))).status, 200);
  assert.equal(h.state().revision, 1);
  assert.equal((await h.handler(h.req({enabled: false, expectedRevision: 1}))).status, 200);
  assert.equal((await h.handler(h.req({...input, expectedRevision: 1}))).status, 409);
  assert.equal(h.state().enabled, false); assert.equal(h.state().revision, 2);
});
test('conditional write conflict reports not saved and does not retry', async () => {
  const h = harness(); let attempts = 0; h.store.setJSON = async () => {attempts++; return {modified: false};};
  assert.equal((await h.handler(h.req(input))).status, 409); assert.equal(attempts, 1);
});
