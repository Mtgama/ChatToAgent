import { readFileSync, writeFileSync } from 'node:fs';

// Proxy 0.1.8 shares a Protocol instance across SSE connections. SDK 1.32.2
// rejects a second transport. Give every browser connection its own instance.
const path = new URL('./node_modules/@srbhptl39/mcp-superassistant-proxy/dist/gateways/configToSse.js', import.meta.url);
const marker = '// Local fix: one Protocol instance per SSE connection.';
let source = readFileSync(path, 'utf8');
if (!source.includes(marker)) {
  const declaration = "    const server = new Server({ name: 'mcp-superassistant-proxy', version: getVersion() }, { capabilities: {} });\n";
  const route = '        const sseTransport = new SSEServerTransport(`${baseUrl}${messagePath}`, res);';
  if (source.split(declaration).length !== 2 || source.split(route).length !== 2) {
    throw new Error('Proxy source changed; review the SSE connection fix before applying it.');
  }
  source = source.replace(declaration, '').replace(route, `        ${marker}\n    ${declaration}${route}`);
}

// Chrome MV3 cannot compile AJV output validators with new Function(). Only
// omit this optional field for SuperAssistant; OpenCode keeps the full schema.
const schemaMarker = '// Local fix: SuperAssistant MV3 output-schema compatibility.';
if (!source.includes(schemaMarker)) {
  const replacements = [
    ['        const sessionId = sseTransport.sessionId;',
     `        const sessionId = sseTransport.sessionId;
        ${schemaMarker}
        let omitOutputSchema = false;`],
    ['        sseTransport.onmessage = async (msg) => {',
     `        sseTransport.onmessage = async (msg) => {
            if (msg.method === 'initialize') {
                omitOutputSchema = msg.params?.clientInfo?.name === 'mcp-client-sse';
            }`],
    ['                    const response = await serverManager.handleRequest(msg);',
     `                    const response = await serverManager.handleRequest(msg);
                    if (omitOutputSchema && msg.method === 'tools/list' && Array.isArray(response.result?.tools)) {
                        response.result = {
                            ...response.result,
                            tools: response.result.tools.map(({ outputSchema, ...tool }) => tool),
                        };
                    }`],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) {
      throw new Error('Proxy source changed; review the browser schema compatibility fix.');
    }
    source = source.replace(before, after);
  }
}
writeFileSync(path, source);
console.log('SSE connection and browser schema compatibility fixes ready.');
