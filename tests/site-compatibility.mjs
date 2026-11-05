import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';

let serial = 0;
async function load(path) {
  const result = await build({
    entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'node',
    plugins: [{ name: 'test-logger', setup(b) {
      b.onResolve({filter: /^@extension\/shared\/lib\/logger$/}, () => ({path: 'logger', namespace: 'test'}));
      b.onLoad({filter: /.*/, namespace: 'test'}, () => ({contents: 'export const createLogger = () => ({debug(){},info(){},warn(){},error(){}})'}));
      // The real React menu has its own DOM regression suite below.
      b.onResolve({filter: /components\/mcpPopover\/mcpPopover$/}, () => ({path: 'popover', namespace: 'launcher-test'}));
      b.onLoad({filter: /.*/, namespace: 'launcher-test'}, () => ({contents: 'export const MCPPopover = () => null'}));
      b.onResolve({filter: /^react-dom\/client$/}, () => ({path: 'root', namespace: 'launcher-root'}));
      b.onLoad({filter: /.*/, namespace: 'launcher-root'}, () => ({contents: 'export const createRoot = () => ({render(){},unmount(){}})'}));
    }}],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${serial++}`);
}
function dom(url, markup) {
  const { window } = parseHTML(`<html><head></head><body>${markup}</body></html>`);
  window.location = new URL(url);
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLTextAreaElement', 'Event']) {
    globalThis[name] = name === 'window' ? window : window[name];
  }
  return window;
}
const configPath = 'pages/content/src/render_prescript/src/core/config.ts';
const parserPath = 'pages/content/src/render_prescript/src/parser/jsonFunctionParser.ts';
const call = '{"type":"function_call_start","name":"filesystem.list_allowed_directories","call_id":1}\n{"type":"function_call_end","call_id":1}';

dom('https://chatgpt.com/c/test', `<div class="user"><pre><code>${call}</code></pre></div><div data-dil-message-id="test"><div data-code-block="true"><div data-code-block-source="true"><code><span>${call}</span></code></div></div></div><div data-message-author-role="assistant"><pre><code>${call}</code></pre></div>`);
let { CONFIG } = await load(configPath);
let targets = [...document.querySelectorAll(CONFIG.targetSelectors.join(','))];
assert.equal(targets.length, 2, 'Modern and legacy assistant code must be detected');
assert.ok(targets.every(el => !el.closest('.user')), 'User examples must not become executable cards');
let parser = await load(parserPath);
assert.ok(targets.every(el => parser.containsJSONFunctionCalls(el).isComplete));
const streaming = targets[0];
streaming.querySelector('code').textContent = '{"type":"function_call_start","name":"filesystem.list_allowed_directories","call_id":1}';
assert.equal(parser.containsJSONFunctionCalls(streaming).isComplete, false);
streaming.querySelector('code').append('\n{"type":"function_call_end","call_id":1}');
assert.equal(parser.containsJSONFunctionCalls(streaming).isComplete, true, 'Streaming completion must be recognized');
assert.equal(streaming.querySelector('code').closest(CONFIG.targetSelectors.join(',')), streaming);
console.log('PASS ChatGPT: modern and legacy code, author scoping, streaming completion');

dom('https://gapgpt.app/chat/test', `<main><div class="bg-user"><pre>${call}</pre></div><div class="bot-message"><pre><code>${call}</code></pre></div></main><footer><textarea></textarea><button class="submit-btn-v2">send</button></footer>`);
({ CONFIG } = await load(configPath));
targets = [...document.querySelectorAll(CONFIG.targetSelectors.join(','))];
assert.equal(targets.length, 1);
assert.ok(targets[0].closest('.bot-message'));
parser = await load(parserPath);
assert.ok(parser.containsJSONFunctionCalls(targets[0]).isComplete);
console.log('PASS GapGPT: assistant code only and JSONL parsing');

// Actual GapGPT markup includes a copy icon and language label before code,
// without a newline. Detection succeeded but the old Run-button parser failed.
const {addExecuteButton} = await load('pages/content/src/render_prescript/src/renderer/components.ts');
for (const raw of [
  `content_copy                        jsonl${call}`,
  `نسخ الكود jsonl${call}`,
  call.replaceAll('"type":', '"type": '),
  call.replaceAll(',', ',\n'),
  '<function_calls><invoke name="filesystem.list_allowed_directories" call_id="1"></invoke></function_calls>',
]) {
  const card = document.createElement('div');
  document.body.append(card);
  addExecuteButton(card, raw);
  assert.equal(card.querySelectorAll('.execute-button').length, 1, `Complete tool call must get a Run button: ${raw}`);
  const result = card.querySelector('[data-function-name]');
  assert.equal(result.getAttribute('data-function-name'), 'filesystem.list_allowed_directories');
  assert.equal(result.getAttribute('data-call-id'), '1', 'Run button must preserve the original call ID');
  addExecuteButton(card, raw);
  assert.equal(card.querySelectorAll('.execute-button').length, 1, 'Repeated updates must not duplicate Run');
  card.remove();
}
const ordinaryCode = document.createElement('div');
addExecuteButton(ordinaryCode, '{"hello":"world"}');
assert.equal(ordinaryCode.querySelector('.execute-button'), null);
console.log('PASS Run button: actual GapGPT header, localized label, clean/pretty JSONL, XML, call IDs, deduplication, ordinary code');

const { GapGPTAdapter } = await load('pages/content/src/plugins/adapters/gapgpt.adapter.ts');
const adapter = new GapGPTAdapter();
let enabled = false;
await adapter.initialize({logger:{debug(){},info(){},warn(){},error(){}},stores:{ui:{setMCPEnabled(v){enabled=v},setSidebarVisibility(){}}}});
await adapter.activate();
await adapter.activate();
assert.equal(document.querySelectorAll('#mcp-gapgpt-launcher').length, 1);
assert.equal(enabled, false, 'Opening the menu must not silently enable MCP or run tools');
const input = document.querySelector('textarea');
input.setSelectionRange = () => {};
let inputs = 0;
input.addEventListener('input', () => inputs++);
assert.equal(await adapter.insertText('MCP_RESULT_OK'), true);
assert.equal(input.value, 'MCP_RESULT_OK');
assert.equal(inputs, 1);
assert.equal(await adapter.insertText('next'), true);
assert.equal(input.value, 'MCP_RESULT_OK\nnext');
const send = document.querySelector('button.submit-btn-v2');
send.getBoundingClientRect = () => ({width:20,height:20});
let clicks = 0;
send.addEventListener('click', () => clicks++);
assert.equal(await adapter.submitForm(), true);
assert.equal(clicks, 1);
send.disabled = true;
assert.equal(await adapter.submitForm(), false);
window.location = new URL('https://gapgpt.app.example.com/');
assert.equal(adapter.isSupported(), false);
assert.equal(await adapter.submitForm(), false);
await adapter.cleanup();
assert.equal(document.querySelector('#mcp-gapgpt-launcher'), null);
console.log('PASS GapGPT composer: launcher, native textarea updates, append, submit, disabled guard, exact host, cleanup');

const {generateManualInstructions} = await load('pages/content/src/components/sidebar/Instructions/manualInstructions.ts');
const instructions = generateManualInstructions([{name:'filesystem.list_allowed_directories',description:'List directories',schema:'{"type":"object","properties":{}}'}]);
assert.ok(instructions.includes('filesystem.list_allowed_directories'));
assert.ok(instructions.includes('```jsonl'));
assert.ok(!instructions.includes('<system>'));
assert.ok(instructions.includes('wait for me to supply the actual result'));
console.log('PASS manual workflow instructions retain tool schema and wait for actual results');
