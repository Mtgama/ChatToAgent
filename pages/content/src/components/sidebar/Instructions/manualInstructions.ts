/** User-controlled local workflow; does not claim to replace the model's tools. */
export function generateManualInstructions(
  tools: Array<{ name: string; schema: string; description: string }>,
  customInstructions?: string,
): string {
  const catalog = tools.map(tool => `${tool.name}\n${tool.description}\nInput JSON Schema: ${tool.schema}`).join('\n\n');
  return `I use the MCP SuperAssistant browser extension to review and execute local tool requests.
You do not need direct access to my computer. For my next task, please write one request as a jsonl code block for me to review and run using the extension. This is an external workflow, not a claim that you have executed anything.
Use only the catalog below. Include required parameters with the types in the input schema. Do not invent results; wait for me to supply the actual result before continuing. If no concrete task is given, ask what I want to do.
The JSONL format consists of separate JSON objects, one per line:
\`\`\`jsonl
{"type":"function_call_start","name":"TOOL_NAME","call_id":1}
{"type":"description","text":"Brief description of the requested operation"}
{"type":"parameter","key":"PARAMETER_NAME","value":"VALUE"}
{"type":"function_call_end","call_id":1}
\`\`\`
Use zero parameter lines for a tool that takes no parameters. Increment call_id for each request.

Available local tools:
${catalog}
${customInstructions?.trim() ? `\nMy additional preferences:\n${customInstructions.trim()}\n` : ''}`;
}
