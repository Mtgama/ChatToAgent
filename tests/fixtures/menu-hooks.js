import { useSyncExternalStore } from 'react';

const listeners = new Set();
let state = {
  tools: [], enabledTools: new Set(), theme: 'light', mcpEnabled: true,
  preferences: { autoInsert: false, autoSubmit: false, autoExecute: false },
};
let adapter;
const notify = () => listeners.forEach(listener => listener());
export function setMenuState(update) { state = { ...state, ...update }; notify(); }
export function setMenuAdapter(value) { adapter = value; }
const useState = () => useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state);
const updatePreferences = update => setMenuState({ preferences: { ...state.preferences, ...update } });
export const useAvailableTools = () => ({ tools: useState().tools });
export const useToolEnablement = () => ({ enabledTools: useState().enabledTools });
export const useUserPreferences = () => ({ preferences: useState().preferences, updatePreferences });
export const useTheme = () => ({ theme: useState().theme });
export const useMCPState = () => ({ mcpEnabled: useState().mcpEnabled, setMCPEnabled: value => setMenuState({ mcpEnabled: value }) });
export const useCurrentAdapter = () => ({
  plugin: adapter, isReady: !!adapter,
  insertText: text => adapter.insertText(text), attachFile: async () => false,
});
