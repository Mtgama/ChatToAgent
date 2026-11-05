import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { allowedOrigin, authorized, atomicJson, buildMcpConfig, validateSettings } from '../core.mjs';

test('workspace validation resolves symlinks, rejects files, missing paths, root and relative paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mehrdad-settings-'));
  try {
    const workspace = path.join(directory, 'پروژه با فاصله');
    await mkdir(workspace);
    await symlink(workspace, path.join(directory, 'link'));
    await writeFile(path.join(directory, 'file'), 'test');
    const tools = { filesystem: true, memory: false, thinking: true };
    const settings = await validateSettings({ workspace: path.join(directory, 'link'), tools, autoStart: true });
    assert.equal(settings.workspace, workspace);
    assert.deepEqual(settings.tools, tools);
    for (const workspace of ['relative', '/', path.join(directory, 'missing'), path.join(directory, 'file')]) {
      await assert.rejects(validateSettings({ workspace, tools }));
    }
    await assert.rejects(validateSettings({ workspace, tools: { filesystem: 'true' } }));
    await assert.rejects(validateSettings({ workspace, tools: { filesystem: false, memory: false, thinking: false } }));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('config keeps the filesystem root as one argument, filters disabled tools and preserves memory', () => {
  const settings = { workspace: '/tmp/project with space/پروژه', tools: { filesystem: true, memory: true, thinking: false } };
  const config = buildMcpConfig(settings, '/tmp/runtime', '/tmp/data', '/usr/bin/node');
  assert.deepEqual(Object.keys(config.mcpServers), ['filesystem', 'memory']);
  assert.equal(config.mcpServers.filesystem.args[1], settings.workspace);
  assert.equal(config.mcpServers.memory.env.MEMORY_FILE_PATH, process.env.MCP_MEMORY_FILE || '/tmp/data/memory.jsonl');
  assert.equal(config.mcpServers.filesystem.command, '/usr/bin/node');
});

test('settings are atomically replaced and private', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'mehrdad-persist-'));
  const file = path.join(directory, 'settings.json');
  try {
    await atomicJson(file, { workspace: 'old' });
    await atomicJson(file, { workspace: 'new' });
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { workspace: 'new' });
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    await assert.rejects(stat(file + '.tmp'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('API authorization requires the full secret and rejects website origins', () => {
  const secret = 'abc123';
  assert.equal(authorized('Bearer abc123', secret), true);
  for (const header of ['', undefined, 'abc123', 'Bearer abc', 'Bearer abc1234']) assert.equal(authorized(header, secret), false);
  const base = 'http://127.0.0.1:3007';
  for (const origin of [undefined, base, 'chrome-extension://' + 'a'.repeat(32)]) assert.equal(allowedOrigin(origin, base), true);
  for (const origin of ['https://gapgpt.app', 'https://chatgpt.com', 'null', base + '.evil.test', 'chrome-extension://invalid']) assert.equal(allowedOrigin(origin, base), false);
});
