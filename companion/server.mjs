import http from 'node:http';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod, access } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowedOrigin, atomicJson, authorized, buildMcpConfig, readJson, toolPackages, validateSettings } from './core.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.MCP_DATA_DIR || path.join(homedir(), '.local/share/mehrdad-mcp');
const runtime = process.env.MCP_RUNTIME_DIR || directory;
const port = Number(process.env.MCP_MANAGER_PORT || 3007);
const proxyPort = Number(process.env.MCP_PROXY_PORT || 3006);
const base = `http://127.0.0.1:${port}`;
const settingsFile = path.join(dataDirectory, 'settings.json');
const proxyConfig = path.join(dataDirectory, 'mcp-config.json');
await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
await chmod(dataDirectory, 0o700);
const tokenFile = path.join(dataDirectory, 'pairing-token');
let token;
try { token = (await readFile(tokenFile, 'utf8')).trim(); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  token = randomBytes(32).toString('hex');
  await writeFile(tokenFile, token, { mode: 0o600, flag: 'wx' });
}
await chmod(tokenFile, 0o600);
if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('فایل کلید اتصال معتبر نیست.');
const defaultWorkspace = process.env.MCP_WORKSPACE || path.join(homedir(), 'Projects/mcp-workspace');
await mkdir(defaultWorkspace, { recursive: true });
let settings = await validateSettings(await readJson(settingsFile, {
  workspace: defaultWorkspace, tools: { filesystem: true, memory: true, thinking: true }, autoStart: true,
}));
let proxy = null;
let ready = false;
let busy = '';
let lastError = '';
let startedAt = null;
let sequence = 0;
let shuttingDown = false;
let installation = null;
const logs = [];
const run = promisify(execFile);

function log(source, message) {
  for (const line of String(message).split(/\r?\n/).filter(Boolean)) {
    const text = line.replace(/\x1b\[[0-9;]*m/g, '').replaceAll(token, '[حذف شد]').slice(0, 3000);
    logs.push({ id: ++sequence, time: new Date().toISOString(), source, message: text });
    if (logs.length > 600) logs.shift();
    process.stdout.write(`[${source}] ${text}\n`);
  }
}

async function installed() {
  try {
    await Promise.all([
      ...Object.values(toolPackages).map(name => access(path.join(runtime, 'node_modules', name, 'dist/index.js'))),
      access(path.join(runtime, 'node_modules/@srbhptl39/mcp-superassistant-proxy/dist/index.js')),
    ]);
    return true;
  } catch { return false; }
}

function signalTree(child, signal) {
  if (!child?.pid || (process.platform !== 'linux' && child.exitCode !== null)) return;
  try { process.kill(process.platform === 'linux' ? -child.pid : child.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}

async function stopProxy() {
  const current = proxy;
  ready = false;
  if (!current) return;
  const exit = current.exitCode !== null ? Promise.resolve() : new Promise(resolve => current.once('exit', resolve));
  signalTree(current, 'SIGTERM');
  let timer;
  await Promise.race([exit, new Promise(resolve => { timer = setTimeout(resolve, 2500); })]);
  clearTimeout(timer);
  signalTree(current, 'SIGKILL');
  if (proxy === current) proxy = null;
  startedAt = null;
}

async function startProxy() {
  if (proxy && ready) return;
  if (proxy) await stopProxy();
  if (!await installed()) throw new Error('ابتدا ابزارهای پایه را از بخش نصب آماده کنید.');
  try {
    await fetch(`http://127.0.0.1:${proxyPort}/health`, { signal: AbortSignal.timeout(800) });
    throw new Error(`پورت ${proxyPort} در اختیار سرویس دیگری است. ابتدا آن سرویس را متوقف کنید.`);
  } catch (error) { if (error.message.includes('در اختیار')) throw error; }
  await atomicJson(proxyConfig, buildMcpConfig(settings, runtime, dataDirectory));
  const child = spawn(process.execPath, [
    path.join(runtime, 'node_modules/@srbhptl39/mcp-superassistant-proxy/dist/index.js'),
    '--config', proxyConfig, '--outputTransport', 'sse', '--host', '127.0.0.1',
    '--port', String(proxyPort), '--healthEndpoint', '/health',
  ], { cwd: settings.workspace, detached: process.platform === 'linux', stdio: ['ignore', 'pipe', 'pipe'] });
  proxy = child;
  child.stdout.on('data', data => log('MCP', data));
  child.stderr.on('data', data => log('MCP', data));
  child.on('error', error => { lastError = error.message; log('خطا', error.message); });
  child.on('exit', code => {
    if (proxy === child) { proxy = null; ready = false; startedAt = null; }
    log('سرویس', `سرویس MCP متوقف شد (${code}).`);
  });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null || !child.pid) break;
    try {
      const response = await fetch(`http://127.0.0.1:${proxyPort}/health`, { signal: AbortSignal.timeout(600) });
      if (response.ok) {
        ready = true; startedAt = new Date().toISOString(); lastError = '';
        log('سرویس', 'سرویس MCP آماده است.');
        return;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  await stopProxy();
  throw new Error('سرویس MCP آماده نشد؛ جزئیات را در لاگ بررسی کنید.');
}

async function exclusive(name, action) {
  if (busy) throw new Error(`عملیات ${busy} در حال انجام است؛ کمی صبر کنید.`);
  busy = name; lastError = '';
  try { return await action(); }
  catch (error) { lastError = error.message; log('خطا', error.message); throw error; }
  finally { busy = ''; }
}

async function saveSettings(input) {
  const next = await validateSettings(input);
  const previous = settings;
  const wasRunning = !!proxy;
  if (wasRunning) await stopProxy();
  settings = next;
  try {
    await atomicJson(settingsFile, settings);
    if (wasRunning) await startProxy();
  } catch (error) {
    settings = previous;
    await atomicJson(settingsFile, previous);
    if (wasRunning) await startProxy().catch(rollbackError => log('خطا', rollbackError.message));
    throw error;
  }
  log('تنظیمات', 'پوشه و تنظیمات ابزارها ذخیره شد.');
}

async function installTools() {
  if (proxy) throw new Error('پیش از نصب یا تعمیر ابزارها، سرویس MCP را متوقف کنید.');
  log('نصب', 'آماده‌سازی بسته‌های رسمی npm…');
  const npm = path.join(path.dirname(process.execPath), process.platform === 'win32' ? 'npm.cmd' : 'npm');
  await new Promise((resolve, reject) => {
    installation = spawn(npm, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
      cwd: runtime, detached: process.platform === 'linux', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH || ''}` },
    });
    installation.stdout.on('data', data => log('نصب', data));
    installation.stderr.on('data', data => log('نصب', data));
    installation.once('error', reject);
    installation.once('exit', code => code === 0 ? resolve() : reject(new Error('نصب کامل نشد؛ اتصال اینترنت و لاگ را بررسی کنید.')));
  }).finally(() => { installation = null; });
  log('نصب', 'ابزارهای پایه آماده‌اند.');
}

async function jsonBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 32768) throw new Error('درخواست بیش از حد بزرگ است.');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
}

const assets = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/brand.svg': ['brand.svg', 'image/svg+xml'] };
const server = http.createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
  try {
    if (request.headers.host !== `127.0.0.1:${port}`) return send(403, { error: 'نشانی میزبان معتبر نیست.' });
    if (!allowedOrigin(request.headers.origin, base)) return send(403, { error: 'مبدأ درخواست مجاز نیست.' });
    if (request.headers.origin) {
      response.setHeader('Access-Control-Allow-Origin', request.headers.origin);
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    const url = new URL(request.url, base);
    if (!url.pathname.startsWith('/api/')) {
      const asset = assets[url.pathname];
      if (!asset || request.method !== 'GET') return send(404, { error: 'پیدا نشد.' });
      response.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` });
      response.end(await readFile(path.join(directory, 'public', asset[0])));
      return;
    }
    if (!authorized(request.headers.authorization, token)) return send(401, { error: 'کلید اتصال معتبر نیست؛ کد اتصال را از پنل محلی دریافت کنید.' });
    if (request.method === 'GET' && url.pathname === '/api/status') return send(200, {
      version: '0.7.1', running: !!proxy, ready, busy, lastError, startedAt, installed: await installed(),
      settings, endpoint: `http://127.0.0.1:${proxyPort}/sse`, platform: process.platform,
    });
    if (request.method === 'GET' && url.pathname === '/api/logs') return send(200, { logs: logs.filter(entry => entry.id > Number(url.searchParams.get('since') || 0)), sequence });
    if (request.method !== 'POST') return send(404, { error: 'مسیر پیدا نشد.' });
    const body = await jsonBody(request);
    if (url.pathname === '/api/install') {
      if (busy) throw new Error('عملیات دیگری در حال اجراست.');
      void exclusive('نصب ابزارها', installTools).catch(() => {});
      return send(202, { ok: true });
    }
    if (url.pathname === '/api/start') await exclusive('راه‌اندازی', startProxy);
    else if (url.pathname === '/api/stop') await exclusive('توقف', stopProxy);
    else if (url.pathname === '/api/restart') await exclusive('راه‌اندازی دوباره', async () => { await stopProxy(); await startProxy(); });
    else if (url.pathname === '/api/settings') await exclusive('ذخیره تنظیمات', () => saveSettings(body));
    else if (url.pathname === '/api/workspace') await exclusive('تغییر پوشه', () => saveSettings({ ...settings, workspace: body.workspace }));
    else if (url.pathname === '/api/pick-folder') {
      const picked = await exclusive('انتخاب پوشه', async () => {
        try {
          const result = await run('zenity', ['--file-selection', '--directory', '--title=انتخاب پوشهٔ پروژه — Mehrdad MCP', `--filename=${settings.workspace}/`], { timeout: 120000 });
          return result.stdout.trim();
        } catch (error) {
          if (error.code === 1) return null;
          if (error.code === 'ENOENT') throw new Error('برای انتخاب گرافیکی پوشه، zenity لازم است؛ مسیر را دستی وارد کنید.');
          throw error;
        }
      });
      return send(200, { workspace: picked });
    } else return send(404, { error: 'مسیر پیدا نشد.' });
    send(200, { ok: true });
  } catch (error) { send(400, { error: error.message }); }
});
server.requestTimeout = 130000;
server.listen(port, '127.0.0.1', () => {
  log('مدیریت', `Mehrdad MCP در ${base} آماده است.`);
  if (settings.autoStart) void exclusive('راه‌اندازی', startProxy).catch(() => {});
});
server.on('error', error => { log('خطا', error.message); process.exitCode = 1; });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  signalTree(installation, 'SIGTERM');
  await stopProxy();
  server.close();
});
