const byId = id => document.getElementById(id);
let token = new URLSearchParams(location.hash.slice(1)).get('token') || sessionStorage.getItem('mehrdad-mcp-token') || '';
history.replaceState(null, '', location.pathname);
let current = null;
let logs = [];
let lastSequence = 0;
let paused = false;
let dirty = false;
let requestPending = false;
let noticeTimer;
document.body.classList.toggle('light', localStorage.getItem('mehrdad-mcp-theme') !== 'dark');

function notice(message, error = false) {
  byId('notice').textContent = message;
  byId('notice').classList.toggle('error', error);
  byId('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { byId('notice').hidden = true; }, 8000);
}
async function api(endpoint, body) {
  const response = await fetch('/api/' + endpoint, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: 'Bearer ' + token, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) { byId('pair').hidden = false; byId('workspace-app').hidden = true; }
    throw new Error(result.error || 'ارتباط با برنامه برقرار نشد.');
  }
  return result;
}
function navigate(view) {
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== 'view-' + view;
  for (const button of document.querySelectorAll('[data-view]')) button.classList.toggle('active', button.dataset.view === view);
}
function renderLogs() {
  const filter = byId('log-filter').value.toLocaleLowerCase();
  const container = byId('log-list');
  const atEnd = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
  container.replaceChildren();
  for (const entry of logs.filter(item => (item.source + item.message).toLocaleLowerCase().includes(filter))) {
    const row = document.createElement('div');
    row.className = 'log-entry';
    const time = document.createElement('time');
    time.textContent = new Date(entry.time).toLocaleTimeString('fa-IR');
    const source = document.createElement('b');
    source.textContent = '[' + entry.source + '] ';
    row.append(time, source, document.createTextNode(entry.message));
    container.append(row);
  }
  if (atEnd) container.scrollTop = container.scrollHeight;
}
async function refresh() {
  if (!token || requestPending) return;
  requestPending = true;
  try {
    current = await api('status');
    sessionStorage.setItem('mehrdad-mcp-token', token);
    byId('pair').hidden = true; byId('workspace-app').hidden = false;
    byId('status').textContent = current.busy || (current.ready ? 'سرویس آماده است' : current.running ? 'در حال راه‌اندازی' : 'سرویس متوقف است');
    byId('status').dataset.ready = String(current.ready);
    byId('service-detail').textContent = current.lastError || (current.ready ? 'آمادهٔ اتصال از Chrome و ایجنت‌های کدنویسی' : 'برای استفاده از ابزارها، سرویس MCP را راه‌اندازی کن.');
    byId('start').disabled = !!current.busy || current.running || !current.installed;
    byId('restart').disabled = !!current.busy || !current.running;
    byId('stop').disabled = !!current.busy || !current.running;
    byId('install').disabled = !!current.busy || current.running;
    byId('install-state').textContent = current.installed ? 'ابزارهای پایه نصب و آماده‌اند.' : 'ابزارها هنوز نصب نشده‌اند. با یک کلیک نصب کن.';
    if (!dirty) {
      byId('workspace').value = current.settings.workspace;
      for (const name of ['filesystem','memory','thinking']) byId('tool-' + name).checked = current.settings.tools[name];
      byId('autostart').checked = current.settings.autoStart;
    }
    byId('endpoint').textContent = current.endpoint;
    byId('opencode').textContent = JSON.stringify({ mcp: { superassistant: { type: 'remote', url: current.endpoint, enabled: true, timeout: 20000 } } }, null, 2);
    if (!paused) {
      let result = await api('logs?since=' + lastSequence);
      if (result.sequence < lastSequence) { logs = []; result = await api('logs?since=0'); }
      logs = logs.concat(result.logs).slice(-600); lastSequence = result.sequence;
      renderLogs();
    }
  } catch (error) {
    byId('status').textContent = 'ارتباط با مدیریت قطع شد';
    byId('service-detail').textContent = error.message;
    if (!current) notice(error.message, true);
  } finally { requestPending = false; }
}
async function action(endpoint, body = {}) {
  try { await api(endpoint, body); notice(endpoint === 'install' ? 'نصب شروع شد؛ پیشرفت را در گزارش فعالیت ببین.' : 'انجام شد.'); }
  catch (error) { notice(error.message, true); }
  await refresh();
}
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => navigate(button.dataset.view));
for (const actionName of ['start','stop','restart','install']) byId(actionName).addEventListener('click', async () => {
  byId(actionName).disabled = true;
  if (actionName === 'install') navigate('logs');
  await action(actionName);
});
byId('theme').onclick = () => { document.body.classList.toggle('light'); localStorage.setItem('mehrdad-mcp-theme', document.body.classList.contains('light') ? 'light' : 'dark'); };
byId('pair-form').onsubmit = async event => { event.preventDefault(); token = byId('pair-token').value.trim(); await refresh(); byId('pair-token').value = ''; };
byId('settings-form').oninput = () => { dirty = true; };
byId('settings-form').onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  const settings = { workspace: byId('workspace').value.trim(), tools: {}, autoStart: byId('autostart').checked };
  for (const name of ['filesystem','memory','thinking']) settings.tools[name] = byId('tool-' + name).checked;
  try { await api('settings', settings); dirty = false; notice('تنظیمات ذخیره و اعمال شد.'); }
  catch (error) { notice(error.message, true); }
  finally { button.disabled = false; await refresh(); }
};
byId('browse').onclick = async () => {
  byId('browse').disabled = true;
  try { const result = await api('pick-folder', {}); if (result.workspace) { byId('workspace').value = result.workspace; dirty = true; } }
  catch (error) { notice(error.message, true); }
  finally { byId('browse').disabled = false; }
};
for (const [id, value] of [
  ['copy-token', () => token], ['copy-endpoint', () => current?.endpoint || ''],
  ['copy-opencode', () => byId('opencode').textContent],
]) byId(id).onclick = async () => {
  try { await navigator.clipboard.writeText(value()); notice('کپی شد.'); }
  catch { notice('کپی خودکار انجام نشد؛ دسترسی کلیپ‌بورد مرورگر را بررسی کن.', true); }
};
byId('log-filter').oninput = renderLogs;
byId('pause-logs').onclick = () => { paused = !paused; byId('pause-logs').textContent = paused ? 'ادامهٔ نمایش' : 'توقف نمایش'; };
byId('download-logs').onclick = () => {
  const blob = new Blob([logs.map(entry => entry.time + ' [' + entry.source + '] ' + entry.message).join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'mehrdad-mcp.log'; link.click(); URL.revokeObjectURL(url);
};
byId('pair').hidden = !!token;
void refresh();
setInterval(refresh, 2500);
