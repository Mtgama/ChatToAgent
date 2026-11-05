import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('manager applies workspace and tool changes to the real MCP server', { skip: !process.env.MCP_TEST_RUNTIME, timeout: 90000 }, async () => {
  const runtime = path.resolve(process.env.MCP_TEST_RUNTIME);
  const require = createRequire(path.join(runtime, 'package.json'));
  const { Client } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/index.js')));
  const { SSEClientTransport } = await import(pathToFileURL(require.resolve('@modelcontextprotocol/sdk/client/sse.js')));
  const directory = await mkdtemp(path.join(tmpdir(), 'mehrdad-integration-'));
  const workspace = path.join(directory, 'پروژه با فاصله');
  const nextWorkspace = path.join(directory, 'second');
  const data = path.join(directory, 'data');
  await mkdir(workspace); await mkdir(nextWorkspace); await mkdir(data);
  await writeFile(path.join(workspace, 'check.txt'), 'first workspace');
  await writeFile(path.join(nextWorkspace, 'check.txt'), 'second workspace');
  const tools = { filesystem: true, memory: true, thinking: true };
  await writeFile(path.join(data, 'settings.json'), JSON.stringify({ workspace, tools, autoStart: false }));
  const base = 'http://127.0.0.1:31067';
  let output = '';
  const child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: { ...process.env, MCP_DATA_DIR: data, MCP_RUNTIME_DIR: runtime, MCP_MANAGER_PORT: '31067', MCP_PROXY_PORT: '31066', MCP_WORKSPACE: workspace, MCP_MEMORY_FILE: path.join(data, 'memory.jsonl') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { output = (output + chunk).slice(-15000); });
  child.stderr.on('data', chunk => { output = (output + chunk).slice(-15000); });
  const clients = [];
  let token;
  const api = (route, body, headers = {}) => fetch(base + '/api/' + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000),
  });
  async function connect(name = 'mehrdad-integration') {
    const client = new Client({ name, version: '1.0.0' }, { capabilities: {} });
    clients.push(client);
    await client.connect(new SSEClientTransport(new URL('http://127.0.0.1:31066/sse')));
    return client;
  }
  try {
    for (let attempt = 0; attempt < 80; attempt++) {
      assert.equal(child.exitCode, null, output);
      try {
        token = (await readFile(path.join(data, 'pairing-token'), 'utf8')).trim();
        if ((await api('status')).ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal((await stat(path.join(data, 'pairing-token'))).mode & 0o777, 0o600);
    assert.equal((await api('status', undefined, { Authorization: '' })).status, 401);
    assert.equal((await api('status', undefined, { Origin: 'https://gapgpt.app' })).status, 403);
    const invalidHost = await new Promise((resolve, reject) => {
      const request = http.get(base + '/api/status', { headers: { Host: 'evil.test', Authorization: 'Bearer ' + token } }, response => {
        response.resume(); resolve(response.statusCode);
      });
      request.on('error', reject);
    });
    assert.equal(invalidHost, 403);
    assert.equal((await api('status', undefined, { Origin: 'chrome-extension://' + 'a'.repeat(32) })).status, 200);
    assert.equal((await api('workspace', { workspace: '/' })).status, 400);
    assert.equal((await api('status')).status, 200);
    assert.equal((await api('start', {})).status, 200, output);
    const first = await connect();
    const browser = await connect('mcp-client-sse');
    const firstTools = (await first.listTools()).tools;
    const browserTools = (await browser.listTools()).tools;
    assert.equal(firstTools.length, 26);
    assert.ok(firstTools.some(tool => tool.outputSchema));
    assert.ok(browserTools.every(tool => !tool.outputSchema));
    const read = await browser.callTool({ name: 'filesystem.read_text_file', arguments: { path: path.join(workspace, 'check.txt') } });
    assert.equal(read.isError, undefined);
    assert.ok(JSON.stringify(read).includes('first workspace'));
    const denied = await browser.callTool({ name: 'filesystem.read_text_file', arguments: { path: path.join(nextWorkspace, 'check.txt') } });
    assert.equal(denied.isError, true);
    await Promise.all(clients.splice(0).map(client => client.close()));
    assert.equal((await api('workspace', { workspace: nextWorkspace })).status, 200, output);
    const changed = await connect();
    const allowed = await changed.callTool({ name: 'filesystem.list_allowed_directories', arguments: {} });
    assert.ok(JSON.stringify(allowed).includes(nextWorkspace));
    assert.ok(!JSON.stringify(allowed).includes(workspace));
    const oldDenied = await changed.callTool({ name: 'filesystem.read_text_file', arguments: { path: path.join(workspace, 'check.txt') } });
    assert.equal(oldDenied.isError, true);
    await changed.close(); clients.splice(0);
    assert.equal((await api('settings', { workspace: nextWorkspace, tools: { filesystem: false, memory: true, thinking: false }, autoStart: false })).status, 200, output);
    const reduced = await connect();
    assert.equal((await reduced.listTools()).tools.length, 9);
    await reduced.close(); clients.splice(0);
    assert.equal((await api('stop', {})).status, 200);
    assert.equal((await (await api('status')).json()).running, false);
    await assert.rejects(fetch('http://127.0.0.1:31066/health'));
    assert.equal(JSON.parse(await readFile(path.join(data, 'settings.json'), 'utf8')).workspace, nextWorkspace);
    assert.ok((await (await api('logs')).json()).logs.some(entry => entry.source === 'تنظیمات'));
    console.log('PASS: authenticated API, browser origins, 26 tools, parallel clients, workspace confinement, live workspace change, tool selection, persistent settings and shutdown.');
  } catch (error) {
    error.message += '\n' + output;
    throw error;
  } finally {
    await Promise.allSettled(clients.map(client => client.close()));
    if (child.exitCode === null) {
      const ended = once(child, 'exit'); child.kill('SIGTERM');
      await ended;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
