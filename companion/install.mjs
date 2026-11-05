import { mkdir, readFile, writeFile, copyFile, chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) throw new Error('Node.js نسخهٔ ۲۲.۱۲ یا جدیدتر لازم است.');
if (process.platform !== 'linux') throw new Error('نصب میانبر و سرویس برای لینوکس آماده است؛ در سیستم دیگر node server.mjs را اجرا کنید.');
const directory = path.dirname(fileURLToPath(import.meta.url));
const run = promisify(execFile);
const runtimeIndex = process.argv.indexOf('--runtime');
const runtime = runtimeIndex >= 0 ? path.resolve(process.argv[runtimeIndex + 1]) : directory;
const memoryIndex = process.argv.indexOf('--memory-file');
const memoryFile = memoryIndex >= 0 ? path.resolve(process.argv[memoryIndex + 1]) : null;
const quote = value => '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%') + '"';
const unitDirectory = path.join(homedir(), '.config/systemd/user');
const unitFile = path.join(unitDirectory, 'mehrdad-mcp.service');
let oldWasRunning = false;
await mkdir(unitDirectory, { recursive: true });
try { await copyFile(unitFile, unitFile + '.before-install'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
try {
  const old = path.join(unitDirectory, 'mcp-superassistant.service');
  const original = await readFile(old, 'utf8');
  if (original.includes('mcp-superassistant-proxy')) {
    await copyFile(old, old + '.before-mehrdad');
    oldWasRunning = (await run('systemctl', ['--user', 'is-active', 'mcp-superassistant.service']).catch(() => ({ stdout: '' }))).stdout.trim() === 'active';
    await run('systemctl', ['--user', 'stop', 'mcp-superassistant.service']);
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const unit = [
  '[Unit]', 'Description=Mehrdad MCP local manager', 'After=network.target', '',
  '[Service]', 'Type=simple',
  'ExecStart=' + quote(process.execPath) + ' ' + quote(path.join(directory, 'server.mjs')),
  'Environment=' + quote('MCP_RUNTIME_DIR=' + runtime),
  ...['DISPLAY', 'WAYLAND_DISPLAY', 'XAUTHORITY'].filter(name => process.env[name]).map(name => 'Environment=' + quote(name + '=' + process.env[name])),
  ...(memoryFile ? ['Environment=' + quote('MCP_MEMORY_FILE=' + memoryFile)] : []),
  'Restart=on-failure', 'RestartSec=3', 'KillMode=control-group', 'TimeoutStopSec=8', 'UMask=0077', '',
  '[Install]', 'WantedBy=default.target', '',
].join('\n');
await writeFile(unitFile, unit);
const bin = path.join(homedir(), '.local/bin');
const applications = path.join(homedir(), '.local/share/applications');
await mkdir(bin, { recursive: true }); await mkdir(applications, { recursive: true });
const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const launcher = path.join(bin, 'mehrdad-mcp');
await writeFile(launcher, '#!/bin/sh\nexec ' + shellQuote(process.execPath) + ' ' + shellQuote(path.join(directory, 'launch.mjs')) + '\n');
await chmod(launcher, 0o755);
await writeFile(path.join(applications, 'mehrdad-mcp.desktop'), [
  '[Desktop Entry]', 'Type=Application', 'Name=Mehrdad MCP', 'Name[fa]=مدیریت ابزارهای مهرداد',
  'Comment=مدیریت MCP — mehrdad hasanzade', 'Exec=' + quote(launcher),
  'Icon=' + path.join(directory, 'public/brand.svg'), 'Terminal=false', 'Categories=Development;Utility;', '',
].join('\n'));
await run('systemctl', ['--user', 'daemon-reload']);
try {
  await run('systemctl', ['--user', 'restart', 'mehrdad-mcp.service']);
  let available = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3007/', { signal: AbortSignal.timeout(500) });
      if (response.ok) { available = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!available) throw new Error('سرویس جدید آماده نشد؛ لاگ mehrdad-mcp.service را بررسی کنید.');
} catch (error) {
  await run('systemctl', ['--user', 'stop', 'mehrdad-mcp.service']).catch(() => {});
  if (oldWasRunning) await run('systemctl', ['--user', 'start', 'mcp-superassistant.service']);
  throw error;
}
const compatibility = path.join(bin, 'mcp-superassistant');
try { await copyFile(compatibility, compatibility + '.before-mehrdad', 1); }
catch (error) { if (!['ENOENT', 'EEXIST'].includes(error.code)) throw error; }
await writeFile(compatibility, [
  '#!/bin/sh', 'case "${1:-open}" in',
  '  open) exec ' + shellQuote(launcher) + ' ;;',
  '  start|stop|restart|status) exec systemctl --user "$1" mehrdad-mcp.service ;;',
  '  logs) exec journalctl --user -u mehrdad-mcp.service -f ;;',
  '  *) echo "Usage: mcp-superassistant [open|start|stop|restart|status|logs]"; exit 2 ;;',
  'esac', '',
].join('\n'));
await chmod(compatibility, 0o755);
if (process.argv.includes('--enable')) await run('systemctl', ['--user', 'enable', 'mehrdad-mcp.service']);
console.log('Mehrdad MCP نصب شد. برای بازکردن پنل از میانبر برنامه یا فرمان mehrdad-mcp استفاده کنید.');
if (!process.argv.includes('--no-open')) await import('./launch.mjs');
