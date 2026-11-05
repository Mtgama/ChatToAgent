import { useMemo } from 'react';
import { useAvailableTools, useToolEnablement, useUserPreferences } from './useStores';
import { generateInstructionsJson } from '../components/sidebar/Instructions/instructionGeneratorJson';

/** The chat menu must work even when the sidebar has never been opened. */
export function useDefaultInstructions() {
  const { tools } = useAvailableTools();
  const { enabledTools } = useToolEnablement();
  const { preferences } = useUserPreferences();
  const selected = useMemo(() => tools.filter(tool => enabledTools.has(tool.name)).map(tool => ({
    name: tool.name,
    description: tool.description || '',
    schema: typeof tool.schema === 'string' ? tool.schema : JSON.stringify(tool.input_schema || tool.schema || {}),
  })), [tools, enabledTools]);
  const instructions = useMemo(() => selected.length ? generateInstructionsJson(
    selected, preferences.customInstructions || '', preferences.customInstructionsEnabled || false,
  ) : '', [selected, preferences.customInstructions, preferences.customInstructionsEnabled]);
  return { instructions, toolCount: tools.length, enabledCount: selected.length };
}
