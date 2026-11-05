import { build } from 'esbuild';
import path from 'node:path';
import { createRequire } from 'node:module';

/** Real adapter, React menu, portal and prompt generator; only Chrome stores are replaced. */
export async function buildMenuFixture(node = false) {
  const hooks = path.resolve('tests/fixtures/menu-hooks.js');
  const require = createRequire(path.resolve('pages/content/package.json'));
  const result = await build({
    stdin: { contents: `export {GapGPTAdapter} from './src/plugins/adapters/gapgpt.adapter'; export {act} from 'react'; export {createRoot} from 'react-dom/client'; export {MCPPopover} from './src/components/mcpPopover/mcpPopover'; export {setMenuState,setMenuAdapter} from ${JSON.stringify(hooks)};`, resolveDir: path.resolve('pages/content'), loader: 'tsx' },
    bundle: true, write: false, format: 'esm', platform: node ? 'node' : 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'menu-stores', setup(b) {
      if (node) b.onResolve({ filter: /^react(?:-dom)?(?:\/.*)?$/ }, args => ({ path:require.resolve(args.path), external:true }));
      b.onResolve({ filter: /\/(hooks|useStores)$/ }, () => ({ path: hooks }));
      b.onResolve({ filter: /stores\/ui.store$/ }, () => ({ path: 'ui', namespace: 'menu-test' }));
      b.onResolve({ filter: /services\/automation.service$/ }, () => ({ path: 'automation', namespace: 'menu-test' }));
      b.onResolve({ filter: /^@extension\/shared\/lib\/logger$/ }, () => ({ path: 'logger', namespace: 'menu-test' }));
      b.onLoad({ filter: /.*/, namespace: 'menu-test' }, ({ path: name }) => ({ contents: name === 'logger'
        ? 'export const createLogger=()=>({debug(){},info(){},warn(){},error(){}})'
        : name === 'automation' ? 'export const AutomationService={getInstance:()=>({updateAutomationStateOnWindow:async()=>{}})}'
        : 'export const useUIStore={getState:()=>({setSidebarVisibility(){}})}' }));
    } }],
  });
  return result.outputFiles[0].text;
}
