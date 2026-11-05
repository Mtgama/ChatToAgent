import React, { useEffect, useState } from 'react';

async function companion(action: string, workspace?: string) {
  const response = await chrome.runtime.sendMessage({ type: 'mehrdad:companion', action, workspace });
  if (!response?.ok) throw new Error(response?.error || 'ارتباط با مدیریت برقرار نشد.');
  return response.data;
}

export default function WorkspaceSettings() {
  const [workspace, setWorkspace] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [paired, setPaired] = useState(false);
  useEffect(() => {
    let active = true;
    companion('status').then(state => {
      if (active) { setWorkspace(state.settings.workspace); setPaired(true); }
    }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function perform(action: string) {
    setBusy(true); setMessage('');
    try {
      const result = await companion(action, workspace.trim());
      if (action === 'pick' && result.workspace) setWorkspace(result.workspace);
      if (action === 'workspace') {
        setMessage('پوشه ذخیره شد. اتصال سرور را تازه‌سازی کنید.');
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'عملیات انجام نشد.'); }
    finally { setBusy(false); }
  }
  return <section className="mehrdad-workspace">
    <h3>پوشهٔ پروژه و سرویس محلی</h3>
    <p>ابزار فایل فقط در این پوشه و زیرپوشه‌هایش دسترسی دارد.</p>
    {paired && <>
      <label htmlFor="mehrdad-workspace-path">مسیر پوشه</label>
      <input id="mehrdad-workspace-path" dir="ltr" value={workspace} onChange={event => setWorkspace(event.target.value)} />
      <div className="mehrdad-actions">
        <button disabled={busy} onClick={() => perform('pick')}>انتخاب پوشه</button>
        <button disabled={busy || !workspace.trim()} onClick={() => perform('workspace')}>ذخیره و اعمال</button>
      </div>
      <p>تغییر مسیر، سرویس را برای تمام مشتریان MCP دوباره راه‌اندازی می‌کند.</p>
      <button disabled={busy} onClick={() => perform('open')}>پنل مدیریت و لاگ‌ها ↗</button>
    </>}
    {!paired && <p>برای اتصال، کلید پنل محلی را از طریق آیکون افزونه وارد کنید.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
