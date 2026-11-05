import { readFile } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import path from 'node:path';

await promisify(execFile)('systemctl', ['--user', 'start', 'mehrdad-mcp.service']);
let token;
for (let attempt = 0; attempt < 50; attempt++) {
  try {
    token = (await readFile(path.join(homedir(), '.local/share/mehrdad-mcp/pairing-token'), 'utf8')).trim();
    const response = await fetch('http://127.0.0.1:3007/api/status', {
      headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(500),
    });
    if (response.ok) break;
    token = null;
  } catch { token = null; }
  await new Promise(resolve => setTimeout(resolve, 200));
}
if (!token) throw new Error('مدیریت محلی آماده نشد؛ systemctl --user status mehrdad-mcp.service را بررسی کنید.');
const child = spawn('xdg-open', ['http://127.0.0.1:3007/#token=' + encodeURIComponent(token)], { stdio: 'ignore', detached: true });
child.on('error', () => { console.error('بازکردن مرورگر ممکن نشد. برنامهٔ مدیریت را در 127.0.0.1:3007 باز کنید.'); });
child.unref();
