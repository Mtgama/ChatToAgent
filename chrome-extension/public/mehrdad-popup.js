const element = id => document.getElementById(id);
function applyTheme() {
  const dark = localStorage.getItem('mehrdad-popup-theme') === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  element('theme').textContent = dark ? '☀' : '☾';
}
element('theme').onclick = () => {
  localStorage.setItem('mehrdad-popup-theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  applyTheme();
};
applyTheme();
async function call(action, data = {}) {
  const result = await chrome.runtime.sendMessage({ type: 'mehrdad:companion', action, ...data });
  if (!result?.ok) throw new Error(result?.error || 'اتصال برقرار نشد.');
  return result.data;
}
async function refresh() {
  try {
    const state = await call('status');
    element('pair').hidden = true; element('controls').hidden = false;
    element('workspace').value = state.settings.workspace;
    const names = { filesystem: 'فایل‌ها', memory: 'حافظه', thinking: 'تفکر مرحله‌ای' };
    const enabled = Object.keys(names).filter(name => state.settings.tools[name]).map(name => names[name]);
    element('tools-state').textContent = state.installed ? 'ابزارهای پایه نصب‌اند؛ انتخاب فعلی: ' + (enabled.join('، ') || 'هیچ‌کدام') + '. فهرست ابزارها را از دکمهٔ MCP داخل گفتگو ببین.' : 'ابزارهای پایه نصب نشده‌اند؛ از پنل مدیریت نصب کن.';
    element('status').textContent = state.ready ? 'سرویس MCP آماده است' : 'مدیریت متصل است؛ MCP را از پنل راه‌اندازی کن.';
  } catch (error) {
    element('pair').hidden = false; element('controls').hidden = true;
    element('status').textContent = error.message;
  }
}
async function pending(button, operation) {
  button.disabled = true; element('message').textContent = '';
  try { await operation(); }
  catch (error) { element('message').textContent = error.message; }
  finally { button.disabled = false; }
}
element('pair').onsubmit = event => {
  event.preventDefault();
  void pending(event.submitter, async () => {
    await call('pair', { token: element('token').value.trim() });
    element('token').value = ''; await refresh();
  });
};
element('workspace-form').onsubmit = event => {
  event.preventDefault();
  void pending(event.submitter, async () => {
    await call('workspace', { workspace: element('workspace').value.trim() });
    await refresh(); element('message').textContent = 'پوشه ذخیره و اعمال شد. اتصال ابزارها در تب گفتگو را تازه‌سازی کن.';
  });
};
element('browse').onclick = () => void pending(element('browse'), async () => {
  const result = await call('pick'); if (result.workspace) element('workspace').value = result.workspace;
});
element('open').onclick = () => void pending(element('open'), () => call('open'));
void refresh();
