import type { ITransformHooks } from "markmap-lib";
import { definePlugin } from "markmap-lib/plugins";
import { config, name } from './config';
import customMdItPlugin from "../mark-it";

const plugin = definePlugin({
    name,
    config,
    transform(transformHooks: ITransformHooks) {
        transformHooks.parser.tap((md) => {
            md.use(customMdItPlugin)
        });
        transformHooks.beforeParse.tap((_md, context) => {
            context.features[name] = true;
        });
        transformHooks.afterParse.tap((_md, context) => {
        });
        return {
            styles: plugin.config?.styles,
            scripts: plugin.config?.scripts,
        };
    },
});

export default plugin;