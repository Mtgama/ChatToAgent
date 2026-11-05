import React, { useEffect, useState } from 'react';
import type { ConnectionType } from '../../../types/stores';
import { useMcpCommunication } from '@src/hooks/useMcpCommunication';
import { useConnectionStatus, useServerConfig, useAvailableTools } from '../../../hooks';

export default function ServerStatus({ status: initialStatus }: { status: string }) {
  const connection = useConnectionStatus();
  const { config } = useServerConfig();
  const { tools } = useAvailableTools();
  const communication = useMcpCommunication();
  const status = connection.status || initialStatus;
  const [expanded, setExpanded] = useState(false);
  const [uri, setUri] = useState(config.uri || 'http://127.0.0.1:3006/sse');
  const [type, setType] = useState<ConnectionType>(config.connectionType || 'sse');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (config.uri) setUri(config.uri);
    if (config.connectionType) setType(config.connectionType);
  }, [config.uri, config.connectionType]);

  async function reconnect() {
    setBusy(true); setMessage('');
    try {
      const connected = await communication.forceReconnect();
      if (!connected) throw new Error('اتصال برقرار نشد؛ برنامهٔ مدیریت و لاگ‌ها را بررسی کنید.');
      await communication.refreshTools(true);
      setMessage('اتصال و فهرست ابزارها تازه‌سازی شد.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'اتصال برقرار نشد.'); }
    finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const parsed = new URL(uri);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) throw new Error('نشانی سرور معتبر نیست.');
      const saved = await communication.updateServerConfig({ uri: uri.trim(), connectionType: type });
      if (!saved) throw new Error('ذخیرهٔ تنظیمات اتصال انجام نشد.');
      setMessage('تنظیمات ذخیره شد؛ در حال اتصال…');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'ذخیره انجام نشد.'); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = {
    connected: 'متصل', disconnected: 'قطع ارتباط', connecting: 'در حال اتصال',
    reconnecting: 'اتصال دوباره', error: 'خطای اتصال', unknown: 'در حال بررسی',
  };
  return <section className="mehrdad-server">
    <div className="mehrdad-server-row">
      <div><strong className={status === 'connected' ? 'mehrdad-connected' : ''}>● {labels[status] || 'در حال بررسی'}</strong><p>{status === 'connected' ? tools.length ? `${tools.length} ابزار دریافت شده و در دسترس است.` : 'سرور متصل است، اما فهرست ابزارها هنوز دریافت نشده؛ دکمهٔ ↻ را بزنید.' : 'سرویس MCP را از پنل مدیریت راه‌اندازی کنید.'}</p></div>
      <div className="mehrdad-actions">
        <button aria-label="اتصال دوباره به سرور" title="اتصال دوباره" disabled={busy} onClick={reconnect}>↻</button>
        <button aria-label="تنظیم اتصال سرور" title="تنظیم اتصال" onClick={() => setExpanded(!expanded)}>⚙</button>
      </div>
    </div>
    {expanded && <form onSubmit={save} className="mehrdad-connection-form">
      <label htmlFor="mehrdad-transport">نوع اتصال</label>
      <select id="mehrdad-transport" value={type} onChange={event => setType(event.target.value as ConnectionType)}>
        <option value="sse">جریان رویداد (SSE)</option><option value="streamable-http">Streamable HTTP</option><option value="websocket">WebSocket</option>
      </select>
      <label htmlFor="mehrdad-endpoint">نشانی سرور</label>
      <input id="mehrdad-endpoint" dir="ltr" value={uri} onChange={event => setUri(event.target.value)} required />
      <button type="submit" disabled={busy}>ذخیرهٔ اتصال</button>
    </form>}
    {message && <p role="status">{message}</p>}
    {connection.error && <details><summary>جزئیات خطا</summary><p dir="auto">{String(connection.error)}</p></details>}
  </section>;
}
