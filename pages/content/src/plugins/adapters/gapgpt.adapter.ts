import { BaseAdapterPlugin } from './base.adapter';
import type { AdapterCapability } from '../plugin-types';

/** GapGPT's Vue/Quasar composer, verified against gapgpt.app/chat. */
export class GapGPTAdapter extends BaseAdapterPlugin {
  readonly name = 'GapGPTAdapter';
  readonly version = '1.0.0';
  readonly hostnames = ['gapgpt.app', 'www.gapgpt.app'];
  readonly capabilities: AdapterCapability[] = ['text-insertion', 'form-submission', 'dom-manipulation'];
  private launcher: HTMLDivElement | null = null;
  private root: import('react-dom/client').Root | null = null;

  isSupported(): boolean {
    return this.hostnames.includes(window.location.hostname);
  }

  async activate(): Promise<void> {
    await super.activate();
    if (!this.isSupported() || this.launcher) return;
    // Keep the launcher outside Vue's composer so navigation cannot remove it.
    const launcher = document.createElement('div');
    launcher.id = 'mcp-gapgpt-launcher';
    launcher.style.cssText = 'position:fixed;bottom:110px;left:16px;z-index:10001';
    this.launcher = launcher;
    document.body.appendChild(launcher);
    const [React, ReactDOM, { MCPPopover }] = await Promise.all([
      import('react'), import('react-dom/client'), import('../../components/mcpPopover/mcpPopover'),
    ]);
    // Deactivation can happen while the chunks are loading.
    if (this.launcher !== launcher || !launcher.isConnected) return;
    const ui = () => this.context.stores.ui;
    const preference = (name: string, enabled: boolean) => ui()?.updatePreferences?.({ [name]: enabled });
    const manager = {
      getState: () => ({
        mcpEnabled: ui()?.mcpEnabled ?? false,
        autoInsert: ui()?.preferences?.autoInsert ?? false,
        autoSubmit: ui()?.preferences?.autoSubmit ?? false,
        autoExecute: ui()?.preferences?.autoExecute ?? false,
      }),
      setMCPEnabled: (enabled: boolean) => ui()?.setMCPEnabled?.(enabled, 'gapgpt-launcher'),
      setAutoInsert: (enabled: boolean) => preference('autoInsert', enabled),
      setAutoSubmit: (enabled: boolean) => preference('autoSubmit', enabled),
      setAutoExecute: (enabled: boolean) => preference('autoExecute', enabled),
      updateUI: () => {},
    };
    this.root = ReactDOM.createRoot(launcher);
    this.root.render(React.createElement(MCPPopover, { toggleStateManager: manager, adapterName: this.name }));
  }

  async deactivate(): Promise<void> {
    this.root?.unmount();
    this.root = null;
    this.launcher?.remove();
    this.launcher = null;
    await super.deactivate();
  }

  async cleanup(): Promise<void> {
    await this.deactivate();
    await super.cleanup();
  }

  async insertText(text: string, options?: { targetElement?: HTMLElement }): Promise<boolean> {
    const input = options?.targetElement ?? document.querySelector('footer textarea');
    if (!(input instanceof HTMLTextAreaElement) || !this.isSupported()) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) return false;
    input.focus();
    const next = input.value ? `${input.value}\n${text}` : text;
    setter.call(input, next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.setSelectionRange(next.length, next.length);
    return true;
  }

  async submitForm(): Promise<boolean> {
    if (!this.isSupported()) return false;
    // The voice button occupies this position when the composer is empty.
    const button = document.querySelector<HTMLButtonElement>('footer button.submit-btn-v2');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    button.click();
    return true;
  }
}
