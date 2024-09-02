import { defineExternal, definePlugins } from '@gera2ld/plaid-rollup';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { readPackageUp } from 'read-package-up';
import alias from '@rollup/plugin-alias';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getVersion(module) {
  const require = createRequire(import.meta.url);
  const cwd = dirname(require.resolve(module));
  const { packageJson } = await readPackageUp({ cwd });
  return packageJson.version;
}

export default async () => {
  const replaceValues = {
    'process.env.TOOLBAR_VERSION': JSON.stringify(
      await getVersion('markmap-toolbar'),
    ),
  };

  const external = defineExternal(['path', 'vscode']);
  const rollupConfig = {
    input: {
      extension: 'src/extension.ts',
      postbuild: 'src/postbuild.ts',
    },
    plugins: [...definePlugins({
      replaceValues,
    }), alias({
      entries: [
        // 定义路径别名
        // node_modules/.pnpm/markmap-lib@0.17.0_markmap-common@0.17.0/node_modules/markmap-lib/dist/plugins/index.d.ts
        { find: 'markmap-lib/plugins', replacement: resolve(__dirname, 'node_modules/markmap-lib/dist/plugins') }
      ]
    })],
    external,
    output: {
      format: 'cjs',
      dir: 'dist',
    },
  };

  return rollupConfig;
};
