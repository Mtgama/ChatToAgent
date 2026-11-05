import { access, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';

export const toolPackages = {
  filesystem: '@modelcontextprotocol/server-filesystem',
  memory: '@modelcontextprotocol/server-memory',
  thinking: '@modelcontextprotocol/server-sequential-thinking',
};

export async function validateSettings(input) {
  if (!input || typeof input.workspace !== 'string' || !path.isAbsolute(input.workspace)) {
    throw new Error('مسیر پوشه باید کامل و مطلق باشد.');
  }
  const workspace = await realpath(input.workspace);
  if (workspace === path.parse(workspace).root) throw new Error('ریشهٔ کل سیستم را به‌عنوان پوشهٔ پروژه انتخاب نکنید.');
  if (!(await stat(workspace)).isDirectory()) throw new Error('مسیر انتخاب‌شده پوشه نیست.');
  await access(workspace, constants.R_OK | constants.X_OK);
  const tools = {};
  for (const name of Object.keys(toolPackages)) {
    if (typeof input.tools?.[name] !== 'boolean') throw new Error('وضعیت ابزارها معتبر نیست.');
    tools[name] = input.tools[name];
  }
  if (!Object.values(tools).some(Boolean)) throw new Error('حداقل یک مجموعه ابزار را فعال کنید.');
  return { workspace, tools, autoStart: input.autoStart === true };
}

export function buildMcpConfig(settings, runtime, dataDirectory, node = process.execPath) {
  const mcpServers = {};
  for (const [name, packageName] of Object.entries(toolPackages)) {
    if (!settings.tools[name]) continue;
    const server = {
      command: node,
      args: [path.join(runtime, 'node_modules', packageName, 'dist/index.js')],
    };
    if (name === 'filesystem') server.args.push(settings.workspace);
    if (name === 'memory') server.env = { MEMORY_FILE_PATH: process.env.MCP_MEMORY_FILE || path.join(dataDirectory, 'memory.jsonl') };
    if (name === 'thinking') server.env = { DISABLE_THOUGHT_LOGGING: 'true' };
    mcpServers[name] = server;
  }
  return { mcpServers };
}

export async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, file);
}

export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

export function authorized(header, secret) {
  const supplied = Buffer.from(header || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function allowedOrigin(origin, base) {
  return !origin || origin === base || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}
