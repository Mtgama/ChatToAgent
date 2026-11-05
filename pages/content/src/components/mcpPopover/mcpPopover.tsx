import type React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useCurrentAdapter, useUserPreferences, useMCPState, useTheme } from '../../hooks';
import PopoverPortal from './PopoverPortal';
import { useDefaultInstructions } from '../../hooks/useDefaultInstructions';
import { AutomationService } from '../../services/automation.service';
import { createLogger } from '@extension/shared/lib/logger';


const logger = createLogger('mcpPopover');

export interface MCPToggleState {
  mcpEnabled: boolean;
  autoInsert: boolean;
  autoSubmit: boolean;
  autoExecute: boolean;
}

// Hook to detect dark mode
const useThemeDetector = () => {
  const { theme } = useTheme();
  const [isDarkMode, setIsDarkMode] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return theme === 'dark' || (theme === 'system' && isDarkMode);
};

// CSS for the component using the provided color scheme
const styles = `
[data-mcp-theme]{--mcp-bg:#fff;--mcp-surface:#f6f7f6;--mcp-ink:#1c2920;--mcp-muted:#58665c;--mcp-line:#dce3dd;--mcp-accent:#197137;--mcp-soft:#eaf7ed;color-scheme:light;font-family:Tahoma,"Segoe UI",sans-serif}
[data-mcp-theme="dark"]{--mcp-bg:#0b100c;--mcp-surface:#131c15;--mcp-ink:#edf9ed;--mcp-muted:#a5b7a7;--mcp-line:#2b3c2d;--mcp-accent:#39ff14;--mcp-soft:#19321b;color-scheme:dark}
.mcp-popover-container{position:relative;display:inline-block}
.mcp-main-button{display:flex;align-items:center;justify-content:center;gap:5px;width:max-content;padding:7px 11px;border-radius:10px;background:var(--mcp-bg);border:1px solid var(--mcp-accent);color:var(--mcp-accent);cursor:pointer;font:600 14px/1.5 Tahoma,sans-serif;white-space:nowrap;box-shadow:0 2px 8px #0001}
.mcp-main-button:hover{background:var(--mcp-soft)}
.mcp-popover-container[data-mcp-theme]>div>button{background:var(--mcp-bg)!important;color:var(--mcp-accent)!important;border-color:var(--mcp-line)!important}
.mcp-popover-container[data-mcp-theme]>div>button:hover{background:var(--mcp-soft)!important}
.mcp-main-button.inactive{border-color:var(--mcp-line);color:var(--mcp-muted)}
.mcp-popover{position:relative;max-height:calc(100vh - 24px);font:13px/1.8 Tahoma,sans-serif;color:var(--mcp-ink);box-sizing:border-box}
.mcp-popover *,.mcp-hover-overlay *{box-sizing:border-box}
.mcp-close-button{position:absolute;top:8px;left:8px;width:28px;height:28px;border:0;border-radius:50%;background:transparent;cursor:pointer;z-index:2;font-size:16px}
.mcp-close-button:hover{background:var(--mcp-soft)}
.mcp-toggle-item{display:block;margin-bottom:6px;padding:8px 0;box-sizing:border-box;width:100%}
.mcp-toggle-item.disabled{opacity:.5}
.mcp-toggle-checkbox{position:relative;width:36px;height:18px;flex-shrink:0;display:inline-block;vertical-align:middle}
.mcp-toggle-checkbox input{opacity:0;width:0;height:0;margin:0;padding:0}
.mcp-toggle-slider{position:absolute;inset:0;border-radius:34px;cursor:pointer;background:var(--mcp-line);transition:background .15s}
.mcp-toggle-slider:before{position:absolute;content:"";height:12px;width:12px;left:3px;bottom:3px;background:#fff;border-radius:50%;box-shadow:0 1px 3px #0004;transition:transform .15s}
.mcp-toggle-checkbox input:checked+.mcp-toggle-slider{background:var(--mcp-accent)}
.mcp-toggle-checkbox input:checked+.mcp-toggle-slider:before{transform:translateX(18px)}
.mcp-toggle-checkbox input:focus-visible+.mcp-toggle-slider{outline:2px solid var(--mcp-accent);outline-offset:3px}
.mcp-toggle-checkbox input:disabled+.mcp-toggle-slider{cursor:not-allowed}
.mcp-toggle-label{font-size:12px;white-space:nowrap;color:var(--mcp-ink)}
.mcp-instruction-btn{display:flex;justify-content:center;align-items:center;padding:8px;border:1px solid var(--mcp-line);border-radius:8px;font:12px/1.7 Tahoma,sans-serif;background:var(--mcp-surface);color:var(--mcp-ink);cursor:pointer}
.mcp-instruction-btn:hover{border-color:var(--mcp-accent);background:var(--mcp-soft)}
.mcp-instruction-btn:disabled,.mcp-hover-button:disabled{opacity:.45;cursor:not-allowed}
.mcp-instructions-container{padding:14px;border-radius:8px;font:12px/1.7 ui-monospace,monospace;overflow-wrap:anywhere;text-align:left}
.mcp-hover-overlay{position:fixed!important;background:var(--mcp-bg)!important;color:var(--mcp-ink)!important;border:1px solid var(--mcp-line)!important;border-radius:10px;padding:7px;display:flex;flex-direction:column;gap:4px;box-shadow:0 8px 24px #0003;opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .15s,transform .15s;z-index:2147483647;width:180px;direction:rtl}
.mcp-hover-overlay.visible{opacity:1;visibility:visible;transform:translateY(0)}
.mcp-hover-button{display:flex;align-items:center;gap:8px;padding:10px;border:0;border-radius:6px;background:var(--mcp-surface);color:var(--mcp-ink);font:12px/1.7 Tahoma,sans-serif;cursor:pointer;text-align:right}
.mcp-hover-button:hover{background:var(--mcp-soft);color:var(--mcp-accent)}
.mcp-popover button:focus-visible,.mcp-main-button:focus-visible,.mcp-hover-button:focus-visible{outline:2px solid var(--mcp-accent);outline-offset:2px}
.mcp-drag-handle{position:absolute;top:0;left:calc(50% - 24px);width:48px;height:6px;border-radius:0 0 5px 5px;background:#7b8a7d;cursor:move}
@media(max-width:560px){.mcp-popover{flex-direction:column!important;overflow-y:auto!important}.mcp-popover>div{width:100%!important;flex-shrink:0}.mcp-popover>div:first-of-type{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));padding:35px 15px 8px!important}.mcp-instructions-container{max-height:180px!important}}
@media(prefers-reduced-motion:reduce){.mcp-popover *,.mcp-hover-overlay *,.mcp-main-button{transition:none!important}}
`;
function useInjectStyles() {
  useEffect(() => {
    if (!document.getElementById('mcp-popover-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'mcp-popover-styles';
      styleEl.textContent = styles;
      document.head.appendChild(styleEl);
    }
  }, []);
}

interface MCPPopoverProps {
  toggleStateManager: {
    getState(): MCPToggleState;
    setMCPEnabled(enabled: boolean): void;
    setAutoInsert(enabled: boolean): void;
    setAutoSubmit(enabled: boolean): void;
    setAutoExecute(enabled: boolean): void;
    updateUI(): void;
  };
  /**
   * Adapter-specific button styling configuration
   * Allows adapters to override the default MCP button styling
   * to match the host website's design system
   */
  adapterButtonConfig?: {
    className?: string;        // Main button class (e.g., 'mcp-gh-button-base')
    contentClassName?: string; // Content wrapper class (e.g., 'mcp-gh-button-content')  
    textClassName?: string;    // Text label class (e.g., 'mcp-gh-button-text')
    iconClassName?: string;    // Icon class (e.g., 'mcp-gh-button-icon')
    activeClassName?: string;  // Active state class (e.g., 'mcp-button-active')
  };
  /**
   * Name of the adapter providing the styling
   * Used for debugging and logging
   */
  adapterName?: string;
}

interface ToggleItemProps {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleItem: React.FC<ToggleItemProps> = ({ id, label, checked, disabled, onChange }) => {
  const isDarkMode = useThemeDetector();

  // Color scheme for toggles
  const toggleTheme = {
    itemBackground: isDarkMode ? '#0b100c' : '#ffffff',
    itemBackgroundHover: isDarkMode ? '#19321b' : '#eaf7ed',
    itemBorderColor: isDarkMode ? '#2b3c2d' : '#dce3dd',
    labelColor: isDarkMode ? '#edf9ed' : '#1c2920',
    toggleBackground: isDarkMode ? '#2b3c2d' : '#dce3dd',
    toggleBackgroundChecked: isDarkMode ? '#39ff14' : '#197137',
    toggleBackgroundDisabled: isDarkMode ? '#2b3c2d' : '#dce3dd',
  };

  return (
    <div
      className={`mcp-toggle-item${disabled ? ' disabled' : ''}`}
      style={{
        borderBottom: `1px solid ${toggleTheme.itemBorderColor}`,
        backgroundColor: toggleTheme.itemBackground,
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}>
        <div style={{ width: '36px', marginRight: '10px' }}>
          <label className="mcp-toggle-checkbox" style={{ display: 'block' }}>
            <input
              type="checkbox"
              id={id}
              checked={checked}
              disabled={disabled}
              onChange={e => onChange(e.target.checked)}
            />
            <span
              className="mcp-toggle-slider"
              style={{
                backgroundColor: disabled
                  ? toggleTheme.toggleBackgroundDisabled
                  : checked
                    ? toggleTheme.toggleBackgroundChecked
                    : toggleTheme.toggleBackground,
              }}></span>
          </label>
        </div>
        <label
          htmlFor={id}
          className="mcp-toggle-label"
          style={{
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: toggleTheme.labelColor,
          }}>
          {label}
        </label>
      </div>
    </div>
  );
};

export const MCPPopover: React.FC<MCPPopoverProps> = ({ toggleStateManager, adapterButtonConfig, adapterName }) => {
  const isDarkMode = useThemeDetector();

  // Use Zustand hooks for adapter and user preferences
  const { plugin: activePlugin, insertText, attachFile, isReady: isAdapterActive } = useCurrentAdapter();
  const { preferences, updatePreferences } = useUserPreferences();
  
  // Use MCP state hook to get persistent MCP toggle state
  const { mcpEnabled: mcpEnabledFromStore, setMCPEnabled } = useMCPState();

  // Debug: Log adapter state changes
  useEffect(() => {
    logger.debug(`Adapter state changed:`, {
      isAdapterActive,
      hasActivePlugin: !!activePlugin,
      pluginName: activePlugin?.name,
      hasInsertText: !!insertText,
      hasAttachFile: !!attachFile,
      capabilities: activePlugin?.capabilities,
      adapterName,
      hasAdapterButtonConfig: !!adapterButtonConfig
    });
  }, [isAdapterActive, activePlugin, insertText, attachFile, adapterName, adapterButtonConfig]);

  // Color scheme for the popover
  const theme = {
    // Background colors
    mainBackground: isDarkMode ? '#0b100c' : '#ffffff',
    secondaryBackground: isDarkMode ? '#0b100c' : '#f8f9fa',
    buttonBackground: isDarkMode ? '#19321b' : '#eaf7ed',
    buttonBackgroundHover: isDarkMode ? '#39ff14' : '#d4efda',
    buttonBackgroundActive: isDarkMode ? '#39ff14' : '#197137',
    toggleBackground: isDarkMode ? '#2b3c2d' : '#dce3dd',
    toggleBackgroundChecked: isDarkMode ? '#39ff14' : '#197137',
    toggleBackgroundDisabled: isDarkMode ? '#2b3c2d' : '#dce3dd',

    // Text colors
    primaryText: isDarkMode ? '#edf9ed' : '#1c2920',
    secondaryText: isDarkMode ? '#a5b7a7' : '#58665c',
    disabledText: isDarkMode ? '#a5b7a7' : '#58665c',

    // Border colors
    borderColor: isDarkMode ? '#2b3c2d' : '#dce3dd',
    dividerColor: isDarkMode ? '#2b3c2d' : '#dce3dd',

    // Shadow
    boxShadow: isDarkMode
      ? '0 6px 24px rgba(20,20,20,0.25), 0 2px 8px rgba(20,20,20,0.15)'
      : '0 6px 24px rgba(60,64,67,0.10), 0 2px 8px rgba(60,64,67,0.06)',
    innerShadow: isDarkMode ? 'inset 0 1px 2px rgba(20,20,20,0.10)' : 'inset 0 1px 2px rgba(60,64,67,0.03)',
  };
  useInjectStyles();
  const [state, setState] = useState<MCPToggleState>(() => {
    // Initialize state with current MCP state from store
    const initialState = toggleStateManager.getState();
    return {
      ...initialState,
      mcpEnabled: mcpEnabledFromStore // Use the persistent MCP state from store
    };
  });
  const { instructions, toolCount, enabledCount } = useDefaultInstructions();
  const [copyStatus, setCopyStatus] = useState<'Copy' | 'Copied!' | 'Error'>('Copy');
  const [insertStatus, setInsertStatus] = useState<'Insert' | 'Inserted!' | 'No Adapter' | 'No Content' | 'Failed'>('Insert');
  const [attachStatus, setAttachStatus] = useState<'Attach' | 'Attached!' | 'No File' |'Not Supported'| 'Error'>('Attach');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isHoverOverlayVisible, setIsHoverOverlayVisible] = useState(false);
  const [hoverOverlayPosition, setHoverOverlayPosition] = useState({ x: 0, y: 0 });
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Track sidebar visibility
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hoverOverlayRef = useRef<HTMLDivElement>(null);

  // Update state from manager
  const updateState = useCallback(() => {
    const currentState = toggleStateManager.getState();
    setState(prevState => ({
      ...currentState,
      mcpEnabled: mcpEnabledFromStore // Always sync with persistent MCP state from store
    }));
  }, [toggleStateManager, mcpEnabledFromStore]);

  // Sync state when MCP state changes from store (e.g., from other UI components or on page load)
  useEffect(() => {
    logger.debug(`MCP state changed to: ${mcpEnabledFromStore}, updating MCP toggle UI`);
    setState(prevState => {
      const newState = {
        ...prevState,
        mcpEnabled: mcpEnabledFromStore
      };
      logger.debug(`State updated:`, newState);
      return newState;
    });
  }, [mcpEnabledFromStore]);

  // Initialize and sync popover state with persistent MCP state from store
  useEffect(() => {
    // Force initial state sync to ensure popover reflects current persistent MCP state
    const currentToggleState = toggleStateManager.getState();
    logger.debug(`Initial state sync - toggleManager: ${currentToggleState.mcpEnabled}, store MCP: ${mcpEnabledFromStore}`);

    // Sync automation state from user preferences
    const syncedState = {
      ...currentToggleState,
      mcpEnabled: mcpEnabledFromStore, // Always prioritize persistent MCP state from store
      autoInsert: preferences.autoInsert || false,
      autoSubmit: preferences.autoSubmit || false,
      autoExecute: preferences.autoExecute || false,
    };

    setState(syncedState);

    // Also sync the legacy toggle state manager
    toggleStateManager.setAutoInsert(preferences.autoInsert || false);
    toggleStateManager.setAutoSubmit(preferences.autoSubmit || false);
    toggleStateManager.setAutoExecute(preferences.autoExecute || false);
  }, [toggleStateManager, mcpEnabledFromStore, preferences.autoInsert, preferences.autoSubmit, preferences.autoExecute]); // Include dependencies

  // Track sidebar visibility from window.activeSidebarManager and Zustand store
  useEffect(() => {
    // Listen for sidebar visibility changes via custom events
    const handleSidebarVisibilityChange = (event: CustomEvent) => {
      const { visible } = event.detail;
      logger.debug(`Sidebar visibility changed to: ${visible}`);
      setIsSidebarVisible(visible);
    };

    window.addEventListener('ui:sidebar-toggle' as any, handleSidebarVisibilityChange);

    // Also check activeSidebarManager if available
    const checkSidebarVisibility = () => {
      const manager = (window as any).activeSidebarManager;
      if (manager && manager._isVisible !== undefined) {
        setIsSidebarVisible(manager._isVisible);
      }
    };

    // Check initially and periodically
    checkSidebarVisibility();
    const intervalId = setInterval(checkSidebarVisibility, 1000);

    return () => {
      window.removeEventListener('ui:sidebar-toggle' as any, handleSidebarVisibilityChange);
      clearInterval(intervalId);
    };
  }, []);

  // Handlers for toggles
  const handleMCP = (checked: boolean) => {
    logger.debug(`MCP toggle changed to: ${checked}`);
    
    // Update the persistent MCP state in store (this will automatically control sidebar visibility)
    setMCPEnabled(checked, 'mcp-popover-user-toggle');
    
    // Also inform the legacy toggle state manager for compatibility
    toggleStateManager.setMCPEnabled(checked);
    
    // State will be updated automatically through the MCP state effect
  };

  const handleAutoInsert = (checked: boolean) => {
    logger.debug(`Auto Insert toggle changed to: ${checked}`);
    
    // Update user preferences store
    updatePreferences({ autoInsert: checked });
    
    // Also update legacy toggle state manager for compatibility
    toggleStateManager.setAutoInsert(checked);
    updateState();
    
    // Update automation state on window for render_prescript access
    AutomationService.getInstance().updateAutomationStateOnWindow().catch(console.error);
  };

  const handleAutoSubmit = (checked: boolean) => {
    logger.debug(`Auto Submit toggle changed to: ${checked}`);
    
    // Update user preferences store
    updatePreferences({ autoSubmit: checked });
    
    // Also update legacy toggle state manager for compatibility
    toggleStateManager.setAutoSubmit(checked);
    updateState();
    
    // Update automation state on window for render_prescript access
    AutomationService.getInstance().updateAutomationStateOnWindow().catch(console.error);
  };

  const handleAutoExecute = (checked: boolean) => {
    logger.debug(`Auto Execute toggle changed to: ${checked}`);
    
    // Update user preferences store
    updatePreferences({ autoExecute: checked });
    
    // Also update legacy toggle state manager for compatibility
    toggleStateManager.setAutoExecute(checked);
    updateState();
    
    // Update automation state on window for render_prescript access
    AutomationService.getInstance().updateAutomationStateOnWindow().catch(console.error);
  };

  // Action buttons
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(instructions);
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy'), 1200);
    } catch {
      setCopyStatus('Error');
      setTimeout(() => setCopyStatus('Copy'), 1200);
    }
  };


  const handleInsert = async () => {
    if (!instructions.trim()) {
      setInsertStatus('No Content');
      setTimeout(() => setInsertStatus('Insert'), 1200);
      return;
    }

    // Add more detailed debugging
    logger.debug(`handleInsert called - isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, insertText: ${!!insertText}`);
    if (activePlugin) {
      logger.debug(`Active plugin details:`, {
        name: activePlugin.name,
        capabilities: activePlugin.capabilities,
        hasInsertText: !!activePlugin.insertText
      });
    }

    // Try with a small delay first to allow state to propagate
    if (!isAdapterActive || !activePlugin || !insertText) {
      logger.debug(`Adapter not immediately ready, waiting 100ms and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (isAdapterActive && activePlugin && insertText) {
      try {
        logger.debug(`Attempting to insert text using ${activePlugin.name} adapter`);
        const success = await insertText(instructions);
        if (success) {
          setInsertStatus('Inserted!');
          logger.debug(`Text inserted successfully using ${activePlugin.name} adapter`);
        } else {
          setInsertStatus('Failed');
          logger.warn(`Text insertion failed using ${activePlugin.name} adapter`);
        }
      } catch (error) {
        logger.error(`Error inserting text:`, error);
        setInsertStatus('Failed');
      }
    } else {
      setInsertStatus('No Adapter');
      logger.warn(`No active adapter available for text insertion. isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, insertText: ${!!insertText}`);
      if (activePlugin) {
        logger.warn(`Active plugin details:`, {
          name: activePlugin.name,
          capabilities: activePlugin.capabilities,
          hasInsertTextMethod: !!activePlugin.insertText
        });
      }
    }
    setTimeout(() => setInsertStatus('Insert'), 1200);
  };


  const handleToggleSidebar = async () => {
    logger.debug(`Toggle sidebar requested. Current state: ${isSidebarVisible}`);

    try {
      const manager = (window as any).activeSidebarManager;

      if (manager) {
        if (isSidebarVisible) {
          logger.debug('[MCPPopover] Hiding sidebar via activeSidebarManager');
          await manager.hide();
        } else {
          logger.debug('[MCPPopover] Showing sidebar via activeSidebarManager');
          await manager.show();
        }
      } else {
        logger.warn('[MCPPopover] activeSidebarManager not available, using fallback');
        // Fallback: Use Zustand store directly
        const { useUIStore } = await import('../../stores/ui.store');
        const store = useUIStore.getState();
        store.setSidebarVisibility(!isSidebarVisible, 'mcp-popover-toggle');
      }

      // Update local state immediately for responsive UI
      setIsSidebarVisible(!isSidebarVisible);
    } catch (error) {
      logger.error('[MCPPopover] Error toggling sidebar:', error);
    }
  };

  const handleAttach = async () => {
    // Add more detailed debugging
    logger.debug(`handleAttach called - isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, attachFile: ${!!attachFile}`);
    if (activePlugin) {
      logger.debug(`Active plugin details for attach:`, {
        name: activePlugin.name,
        capabilities: activePlugin.capabilities,
        hasAttachFile: !!activePlugin.attachFile,
        supportsFileAttachment: activePlugin.capabilities.includes('file-attachment')
      });
    }

    if (!instructions.trim()) {
      setAttachStatus('No File');
      setTimeout(() => setAttachStatus('Attach'), 1200);
      return;
    }

    // Try with a small delay first to allow state to propagate
    if (!isAdapterActive || !activePlugin || !attachFile) {
      logger.debug(`Adapter not immediately ready for attachment, waiting 100ms and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (isAdapterActive && activePlugin && attachFile) {
      if (!activePlugin.capabilities.includes('file-attachment')) {
      setAttachStatus('Not Supported');
      logger.warn(`File attachment not supported by ${activePlugin.name} adapter`);
      return;
      }

      const isPerplexity = activePlugin.name === 'Perplexity';
      const isGemini = activePlugin.name === 'Gemini';
      let fileType = isPerplexity || isGemini ? 'text/plain' : 'text/markdown';
      const fileExtension = fileType === 'text/plain' ? '.txt' : '.md';
      const fileName = `mcp_superassistant_instructions${fileExtension}`;
      const file = new File([instructions], fileName, { type: fileType });
      try {
      logger.debug(`Attempting to attach file using ${activePlugin.name} adapter`);
      const success = await attachFile(file);
      if (success) {
        setAttachStatus('Attached!');
        logger.debug(`File attached successfully using ${activePlugin.name} adapter`);
      } else {
        setAttachStatus('Error');
        logger.warn(`File attachment failed using ${activePlugin.name} adapter`);
      }
      } catch (error) {
      logger.error(`Error attaching file:`, error);
      setAttachStatus('Error');
      }
    } else {
      setAttachStatus('No File');
      logger.warn(`Cannot attach file. isAdapterActive: ${isAdapterActive}, activePlugin: ${!!activePlugin}, attachFile: ${!!attachFile}`);
      if (activePlugin) {
      logger.warn(`Active plugin details:`, {
        name: activePlugin.name,
        capabilities: activePlugin.capabilities,
        hasAttachFileMethod: !!activePlugin.attachFile
      });
      }
    }
    setTimeout(() => setAttachStatus('Attach'), 1200);
  };

  // Update hover overlay position
  const updateHoverOverlayPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const overlayWidth = 180;
      const overlayHeight = 180; // approximate height for 4 buttons

      // Calculate position above the button
      let x = rect.right - overlayWidth + 10; // Align to right edge with some offset
      let y = rect.top - overlayHeight - 10; // Position above with gap

      // Keep within viewport bounds
      const viewportWidth = window.innerWidth;
      
      // Adjust horizontal position if going off screen
      if (x < 10) {
        x = 10;
      } else if (x + overlayWidth > viewportWidth - 10) {
        x = viewportWidth - overlayWidth - 10;
      }
      
      // Adjust vertical position if going off screen
      if (y < 10) {
        y = rect.bottom + 10; // Position below if not enough space above
      }
      
      setHoverOverlayPosition({ x, y });
    }
  }, []);

  // Hover overlay handlers
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    updateHoverOverlayPosition();
    setIsHoverOverlayVisible(true);
  }, [updateHoverOverlayPosition]);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverOverlayVisible(false);
    }, 200);
  }, []);

  const handleHoverOverlayEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handleHoverOverlayLeave = () => {
    setIsHoverOverlayVisible(false);
  };

  // Popover show/hide logic
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside both the button and the popover
      const isButtonClick = buttonRef.current && buttonRef.current.contains(e.target as Node);
      const isPopoverClick = popoverRef.current && popoverRef.current.contains(e.target as Node);
      const isPortalClick = document.getElementById('mcp-popover-portal')?.contains(e.target as Node);

      if (!isButtonClick && !isPopoverClick && !isPortalClick) {
        setIsPopoverOpen(false);
      }
    };

    if (isPopoverOpen) {
      // Add a slight delay to avoid immediate trigger
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 10);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  // Update hover overlay position on scroll/resize
  useEffect(() => {
    if (isHoverOverlayVisible) {
      updateHoverOverlayPosition();
      
      const handleScrollResize = () => {
        updateHoverOverlayPosition();
      };
      
      window.addEventListener('scroll', handleScrollResize, true);
      window.addEventListener('resize', handleScrollResize);
      
      return () => {
        window.removeEventListener('scroll', handleScrollResize, true);
        window.removeEventListener('resize', handleScrollResize);
      };
    }
    return undefined;
  }, [isHoverOverlayVisible, updateHoverOverlayPosition]);

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Derived disabled states
  const autoInsertDisabled = !state.mcpEnabled;
  const autoSubmitDisabled = !state.mcpEnabled || !state.autoInsert;
  const autoExecuteDisabled = !state.mcpEnabled;

  // Determine button styling based on adapter configuration
  const buttonClassName = adapterButtonConfig?.className
    ? `${adapterButtonConfig.className}${state.mcpEnabled && adapterButtonConfig.activeClassName ? ` ${adapterButtonConfig.activeClassName}` : ''}`
    : `mcp-main-button${state.mcpEnabled ? '' : ' inactive'}`;

  const buttonContent = adapterButtonConfig?.contentClassName ? (
    <span className={adapterButtonConfig.contentClassName}>
        <img 
          src={chrome.runtime.getURL('icon-34.png')} 
          alt="MCP Logo" 
          className={adapterButtonConfig.iconClassName || ''}
        style={{ width: '20px', height: '20px', borderRadius: '50%' }}
        />
      <span className={adapterButtonConfig.textClassName || ''}>MCP</span>
    </span>
  ) : (
    <>
      <img 
        src={chrome.runtime.getURL('icon-34.png')} 
        alt="MCP Logo" 
        style={{ width: '20px', height: '20px', marginRight: '1px', verticalAlign: 'middle', borderRadius: '50%' }}
      />
      MCP
    </>
  );

  return (
    <div className="mcp-popover-container" id="mcp-popover-container" data-mcp-theme={isDarkMode ? 'dark' : 'light'} ref={containerRef}>
      <div 
        style={{ position: 'relative', display: 'inline-block' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={buttonClassName}
          aria-label={`تنظیمات MCP — ${state.mcpEnabled ? 'فعال' : 'غیرفعال'}`}
          aria-expanded={isPopoverOpen}
          title={`تنظیمات MCP — ${state.mcpEnabled ? 'پنل باز است' : 'پنل بسته است'}`}
          type="button"
          ref={buttonRef}
          onClick={() => setIsPopoverOpen(!isPopoverOpen)}>
          {buttonContent}
        </button>
      </div>
      
      {/* Hover overlay portal */}
      {isHoverOverlayVisible && !isPopoverOpen && createPortal(
        <div 
          className={`mcp-hover-overlay ${isHoverOverlayVisible ? 'visible' : ''}`} data-mcp-theme={isDarkMode ? 'dark' : 'light'}
          ref={hoverOverlayRef}
          onMouseEnter={handleHoverOverlayEnter}
          onMouseLeave={handleHoverOverlayLeave}
          style={{
            left: `${hoverOverlayPosition.x}px`,
            top: `${hoverOverlayPosition.y}px`,
          }}
        >
          <button
            className="mcp-hover-button"
            onClick={handleInsert}
            disabled={!instructions}
            title="درج راهنمای ابزارها"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            درج راهنما
          </button>
          <button
            className="mcp-hover-button"
            onClick={handleAttach}
            disabled={!instructions || !activePlugin?.capabilities?.includes('file-attachment')}
            title="پیوست راهنما به‌صورت فایل"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/>
            </svg>
            پیوست راهنما
          </button>
          <button
            className="mcp-hover-button"
            onClick={handleToggleSidebar}
            title={isSidebarVisible ? "بستن پنل" : "بازکردن پنل"}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              {isSidebarVisible ? (
                // Eye-off icon (hide)
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
              ) : (
                // Eye icon (show)
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              )}
            </svg>
            {isSidebarVisible ? 'بستن پنل' : 'بازکردن پنل'}
          </button>
          <button
            className="mcp-hover-button"
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            title="تنظیمات MCP"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
            تنظیمات
          </button>
        </div>,
        document.body
      )}
      <PopoverPortal isOpen={isPopoverOpen} triggerRef={buttonRef}>
        <div
          className="mcp-popover position-above" dir="rtl" lang="fa" data-mcp-theme={isDarkMode ? 'dark' : 'light'} role="dialog" aria-label="راهنمای پیش‌فرض MCP"
          ref={popoverRef}
          style={{
            display: 'flex',
            flexDirection: 'row',
            minHeight: 280,
            padding: 0,
            width: 'min(650px, calc(100vw - 24px))',
            position: 'relative',
            borderRadius: '16px',
            boxShadow: theme.boxShadow,
            overflow: 'hidden',
            backgroundColor: theme.mainBackground,
            border: `1px solid ${theme.borderColor}`,
          }}>
          <button
            className="mcp-close-button"
            onClick={() => setIsPopoverOpen(false)}
            aria-label="بستن"
            title="بستن"
            type="button"
            style={{
              color: theme.secondaryText,
            }}>
            ✕
          </button>
          {/* Toggles column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 160,
              padding: '20px 12px',
              gap: 12,
              borderRight: `1px solid ${theme.dividerColor}`,
              background: theme.mainBackground,
              boxSizing: 'border-box',
            }}>
            <ToggleItem id="mcp-toggle" label="MCP" checked={state.mcpEnabled} disabled={false} onChange={handleMCP} />
            <button className="mcp-instruction-btn" onClick={handleToggleSidebar} type="button">{isSidebarVisible ? 'بستن پنل ابزارها' : 'بازکردن پنل ابزارها'}</button>
            <ToggleItem
              id="auto-insert-toggle"
              label="درج خودکار"
              checked={state.autoInsert}
              disabled={autoInsertDisabled}
              onChange={handleAutoInsert}
            />
            <ToggleItem
              id="auto-submit-toggle"
              label="ارسال خودکار"
              checked={state.autoSubmit}
              disabled={autoSubmitDisabled}
              onChange={handleAutoSubmit}
            />
            <ToggleItem
              id="auto-execute-toggle"
              label="اجرای خودکار"
              checked={state.autoExecute}
              disabled={autoExecuteDisabled}
              onChange={handleAutoExecute}
            />
          </div>
          {/* Instruction panel column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              padding: '20px 20px 16px 20px',
              background: theme.mainBackground,
              boxSizing: 'border-box',
              overflow: 'auto',
            }}>
            <div
              style={{
                fontWeight: '600',
                fontSize: 16,
                marginBottom: 16,
                letterSpacing: 0.5,
                color: theme.primaryText,
                paddingBottom: 4,
                borderBottom: `1px solid ${theme.dividerColor}`,
              }}>
              پرامپت پیش‌فرض ابزارها
              <small style={{ display: 'block', fontSize: 11, marginTop: 8, color: theme.secondaryText }}>{enabledCount} از {toolCount} ابزار فعال</small>
            </div>
            <div
              className="mcp-instructions-container" dir="ltr"
              style={{
                flex: 1,
                minHeight: 180,
                maxHeight: 320,
                overflowY: 'auto',
                overflowX: 'auto',
                margin: '0 0 20px 0',
                whiteSpace: 'pre-wrap',
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: theme.secondaryBackground,
                color: theme.primaryText,
                border: `1px solid ${theme.borderColor}`,
                boxShadow: theme.innerShadow,
              }}>
              {instructions || (
                <div style={{ 
                  color: theme.secondaryText, 
                  fontStyle: 'italic',
                  padding: '10px',
                  textAlign: 'center' 
                }}>
                  {toolCount === 0 ? 'فهرست ابزارها دریافت نشده است. پنل ابزارها را باز کنید و اتصال سرور را تازه‌سازی کنید.' : 'همهٔ ابزارها غیرفعال‌اند. از پنل ابزارها، ابزارهای موردنیاز را فعال کنید.'}
                </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 20,
                justifyContent: 'space-between',
                width: '100%',
                marginTop: 0,
                marginBottom: 16,
                paddingRight: 16,
              }}>
              <button
                className="mcp-instruction-btn"
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: `1px solid ${theme.borderColor}`,
                  background: theme.secondaryBackground,
                  cursor: 'pointer',
                  color: theme.primaryText,
                }}
                onClick={handleCopy}
                disabled={!instructions}
                onMouseEnter={e => (e.currentTarget.style.background = theme.buttonBackground)}
                onMouseLeave={e => (e.currentTarget.style.background = theme.secondaryBackground)}
                type="button">
                {{ Copy: 'کپی', 'Copied!': 'کپی شد', Error: 'خطا' }[copyStatus]}
              </button>
              <button
                className="mcp-instruction-btn"
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: `1px solid ${theme.borderColor}`,
                  background: theme.secondaryBackground,
                  cursor: 'pointer',
                  color: theme.primaryText,
                }}
                onClick={handleInsert}
                disabled={!instructions}
                onMouseEnter={e => (e.currentTarget.style.background = theme.buttonBackground)}
                onMouseLeave={e => (e.currentTarget.style.background = theme.secondaryBackground)}
                type="button">
                {{ Insert: 'درج راهنما', 'Inserted!': 'درج شد', 'No Adapter': 'صفحه شناسایی نشد', 'No Content': 'راهنما آماده نیست', Failed: 'درج انجام نشد' }[insertStatus]}
              </button>
              <button
                className="mcp-instruction-btn"
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: `1px solid ${theme.borderColor}`,
                  background: theme.secondaryBackground,
                  cursor: 'pointer',
                  color: theme.primaryText,
                }}
                onClick={handleAttach}
                disabled={!instructions || !activePlugin?.capabilities?.includes('file-attachment')}
                onMouseEnter={e => (e.currentTarget.style.background = theme.buttonBackground)}
                onMouseLeave={e => (e.currentTarget.style.background = theme.secondaryBackground)}
                type="button">
                {{ Attach: 'پیوست راهنما', 'Attached!': 'پیوست شد', 'No File': 'فایلی آماده نیست', 'Not Supported': 'پشتیبانی نمی‌شود', Error: 'خطا' }[attachStatus]}
              </button>
            </div>
          </div>
        </div>
      </PopoverPortal>
    </div>
  );
};

export default MCPPopover;
