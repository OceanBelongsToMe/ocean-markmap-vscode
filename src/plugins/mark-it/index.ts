import type MarkdownIt from "markdown-it/index.js";
import Renderer, { type RenderRule } from "markdown-it/lib/renderer.mjs";
import Token from "markdown-it/lib/token.mjs";
import plantuml from 'markdown-it-plantuml';
import type { StateCore } from "markdown-it/index.js";

const eleTokenTag = "node-container";
const customRuleName = 'customMdIt';
const eleClose = new Token(eleTokenTag, eleTokenTag, -1);

function customRuler(state: StateCore) {
    const renderer = new Renderer();

    for (let i = 0; i < state.tokens.length; i += 1) {
        const token = state.tokens[i];
        const eleOpen = new Token(eleTokenTag, eleTokenTag, 1);
        if (token.map) {
            eleOpen.attrPush(["data-lines", token.map.join(',')]);
        }
        if (i >= 1 && token.type === 'inline' && token.content) {
            const prev = state.tokens[i - 1];
            if (i >= 2) {
                const prevPrev = state.tokens[i - 2];
                if (prevPrev.type === 'list_item_open') {
                    if (prevPrev.info) {
                        token.content = `${prevPrev.info}${prevPrev.markup} ${token.content}`;
                    }
                    token.content = `${renderer.renderToken([eleOpen], 0, {})}${token.content}${renderer.renderToken([eleClose], 0, {})}`;
                }
            }
            if (prev.type === 'heading_open') {
                token.content = `${renderer.renderToken([eleOpen], 0, {})}${token.content}${renderer.renderToken([eleClose], 0, {})}`;
            }
        }
    }
    return true;
}
const customMdItPlugin: MarkdownIt.PluginSimple = (md: MarkdownIt) => {
    md.use(plantuml, { openMarker: '```plantuml', closeMarker: '```' });
    const renderer = new Renderer();
    const proxy: RenderRule = (tokens, idx, options, env, self) => self.renderToken(tokens, idx, options);

    md.core.ruler.before('inline', customRuleName, customRuler);

    ['fence', 'image', 'blockquote', customRuleName, 'uml_diagram'].forEach((key) => {
        const defaultRenderer = md.renderer.rules[key] || proxy;
        md.renderer.rules[key] = function (tokens, idx, options, env, self) {
            const eleOpen = new Token(eleTokenTag, eleTokenTag, 1);
            const token = tokens[idx];
            if (token.map) {
                eleOpen.attrPush(["data-lines", token.map.join(',')]);
            }
            const result = defaultRenderer(tokens, idx, options, env, self);
            return `${renderer.renderToken([eleOpen], 0, options)}${result}${renderer.renderToken([eleClose], 0, options)}`;
        };
    });
}

export default customMdItPlugin;