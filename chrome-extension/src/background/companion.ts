const base = 'http://127.0.0.1:3007';
const tokenKey = 'mehrdadCompanionToken';
const routes: Record<string, { path: string; method: string }> = {
  status: { path: '/api/status', method: 'GET' },
  workspace: { path: '/api/workspace', method: 'POST' },
  pick: { path: '/api/pick-folder', method: 'POST' },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'mehrdad:companion') return false;
  if (sender.id !== chrome.runtime.id) return false;
  const extensionPage = sender.url?.startsWith(chrome.runtime.getURL('')) === true;
  const respond = async () => {
    if (message.action === 'pair') {
      if (!extensionPage || !/^[a-f0-9]{64}$/.test(message.token || '')) throw new Error('کلید اتصال معتبر نیست.');
      const check = await fetch(base + '/api/status', {
        headers: { Authorization: 'Bearer ' + message.token },
        signal: AbortSignal.timeout(5000),
      });
      if (!check.ok) throw new Error('کلید اتصال پذیرفته نشد.');
      await chrome.storage.local.set({ [tokenKey]: message.token });
      return { paired: true };
    }
    const stored = await chrome.storage.local.get(tokenKey);
    const token = stored[tokenKey];
    if (!token) throw new Error('برای اتصال، روی آیکون افزونه کلیک و کلید پنل محلی را وارد کنید.');
    if (message.action === 'open') {
      await chrome.tabs.create({ url: base + '/#token=' + encodeURIComponent(token) });
      return { opened: true };
    }
    const route = routes[message.action];
    if (!route) throw new Error('عملیات پشتیبانی نمی‌شود.');
    const response = await fetch(base + route.path, {
      method: route.method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: route.method === 'POST' ? JSON.stringify(message.action === 'workspace' ? { workspace: message.workspace } : {}) : undefined,
      signal: AbortSignal.timeout(message.action === 'pick' ? 125000 : 30000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ارتباط با مدیریت محلی برقرار نشد.');
    return data;
  };
  respond().then(data => sendResponse({ ok: true, data }), error => sendResponse({
    ok: false, error: error instanceof TypeError ? 'برنامهٔ Mehrdad MCP باز نیست؛ آن را از میانبر سیستم اجرا کنید.' : error.message,
  }));
  return true;
});
