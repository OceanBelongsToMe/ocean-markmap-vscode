import customMdPlugin from './markmap';
import { pluginCheckbox, pluginFrontmatter, pluginHljs, pluginNpmUrl, pluginSourceLines } from 'markmap-lib/plugins';
export const customPlugins = [
    pluginCheckbox, pluginFrontmatter, pluginHljs, pluginNpmUrl, pluginSourceLines, customMdPlugin,
];