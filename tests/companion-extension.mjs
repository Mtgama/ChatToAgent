import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';

const id = 'a'.repeat(32);
const token = 'b'.repeat(64);
const stored = {};
const calls = [];
const opened = [];
let listener;
let failNetwork = false;
const source = await readFile('chrome-extension/src/background/companion.ts', 'utf8');
const compiled = await transform(source, { loader: 'ts' });
vm.runInNewContext(compiled.code, {
  AbortSignal, TypeError,
  chrome: {
    runtime: { id, getURL: path => `chrome-extension://${id}/${path}`, onMessage: { addListener: callback => { listener = callback; } } },
    storage: { local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) } },
    tabs: { create: async options => { opened.push(options); } },
  },
  fetch: async (url, options) => {
    calls.push({ url, options });
    if (failNetwork) throw new TypeError('Failed to fetch');
    const ok = options.headers.Authorization === 'Bearer ' + token;
    return { ok, json: async () => ok ? { settings: { workspace: '/tmp/project' }, ready: true } : { error: 'unauthorized' } };
  },
});
const content = { id, url: 'https://gapgpt.app/chat/test' };
const popup = { id, url: `chrome-extension://${id}/mehrdad-popup.html` };
const send = (action, sender = content, fields = {}) => new Promise(resolve => {
  const handled = listener({ type: 'mehrdad:companion', action, ...fields }, sender, resolve);
  if (handled !== true) resolve({ ignored: true });
});

assert.equal(listener({ type: 'unrelated' }, content, () => {}), false);
assert.equal((await send('status', { ...content, id: 'foreign' })).ignored, true);
assert.equal((await send('status')).ok, false);
assert.equal((await send('pair', content, { token })).ok, false, 'Chat pages cannot pair the manager');
assert.equal(Object.keys(stored).length, 0);
assert.equal((await send('pair', popup, { token: 'c'.repeat(64) })).ok, false);
assert.equal(Object.keys(stored).length, 0, 'Invalid keys must not persist');
assert.equal((await send('pair', popup, { token })).ok, true);
assert.equal(stored.mehrdadCompanionToken, token);
const status = await send('status');
assert.equal(status.ok, true);
assert.ok(!JSON.stringify(status).includes(token), 'Content responses must not expose the management key');
await send('workspace', content, { workspace: '/tmp/new folder' });
assert.equal(calls.at(-1).url, 'http://127.0.0.1:3007/api/workspace');
assert.equal(JSON.parse(calls.at(-1).options.body).workspace, '/tmp/new folder');
const count = calls.length;
assert.equal((await send('http://evil.test')).ok, false);
assert.equal(calls.length, count, 'Requests must stay on the fixed local routes');
const openedResult = await send('open');
assert.equal(openedResult.ok, true);
assert.ok(!JSON.stringify(openedResult).includes(token));
assert.equal(opened[0].url, 'http://127.0.0.1:3007/#token=' + token);
failNetwork = true;
assert.equal((await send('status')).error, 'برنامهٔ Mehrdad MCP باز نیست؛ آن را از میانبر سیستم اجرا کنید.');
console.log('PASS: extension pairing, sender validation, private key storage, fixed local routes, workspace request and localized connection errors.');
