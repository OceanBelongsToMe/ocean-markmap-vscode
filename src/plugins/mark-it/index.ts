import type MarkdownIt from "markdown-it/index.js";
import Renderer, { type RenderRule } from "markdown-it/lib/renderer.mjs";
import Token from "markdown-it/lib/token.mjs";
import plantuml from 'markdown-it-plantuml';
import type { StateCore } from "markdown-it/index.js";

const eleTokenTag = "node-container";
const remarkTokenTag = "node-remark";
const customRuleName = 'customMdIt';
const eleOpen = new Token(eleTokenTag, eleTokenTag, 1);
eleOpen.attrSet('class', eleTokenTag);
const eleClose = new Token(eleTokenTag, eleTokenTag, -1);
const remarkOpen = new Token(remarkTokenTag, 'div', 1);
const remarkClose = new Token(remarkTokenTag, 'div', -1);
function customRuler(state: StateCore) {
    const renderer = new Renderer();
    let preHeadingIdx = 0;
    const tokens = state.tokens;
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        if (token.map) {
            eleOpen.attrSet("data-lines", token.map.join(','));
        }
        if (token.type === 'heading_close' && preHeadingIdx >= 1 && (preHeadingIdx - 1) !== i) {
            if (token.tag < tokens[preHeadingIdx].tag) {
                const inline = tokens[i - 1];
                remarkOpen.attrSet('class', remarkTokenTag);
                inline.content = `<details><summary>${inline.content}</summary>${renderer.renderToken([remarkOpen], 0, {})}ss森s法法师sss${renderer.renderToken([remarkClose], 0, {})}</details>`
            }
        }
        if (token.type === 'heading_open') {
            preHeadingIdx = i;
        }
        if (token.type === 'inline' && token.content) {
            if (i >= 2) {
                const prevPrev = tokens[i - 2];
                if (prevPrev.type === 'list_item_open') {
                    if (prevPrev.info) {
                        token.content = `${prevPrev.info}${prevPrev.markup} ${token.content}`;
                    }
                    token.content = `${renderer.renderToken([eleOpen], 0, {})}${token.content}${renderer.renderToken([eleClose], 0, {})}`;
                }
            }
            if (i >= 1) {
                const prev = tokens[i - 1];
                if (prev.type === 'heading_open') {
                    token.content = `${renderer.renderToken([eleOpen], 0, {})}${token.content}${renderer.renderToken([eleClose], 0, {})}`;
                }
            }
        }
        console.log(token);
    }
    return true;
}
const customMdItPlugin: MarkdownIt.PluginSimple = (md: MarkdownIt) => {
    md.use(plantuml, { openMarker: '```plantuml', closeMarker: '```' });
    const renderer = new Renderer();
    const proxy: RenderRule = (tokens, idx, options, env, self) => self.renderToken(tokens, idx, options);

    md.core.ruler.before('inline', customRuleName, customRuler);
    md.block.ruler.before('table', customRuleName, (state, a, b, c) => {
        return false;
    });
    ['fence', 'image', 'blockquote', customRuleName, 'uml_diagram'].forEach((key) => {
        const defaultRenderer = md.renderer.rules[key] || proxy;
        md.renderer.rules[key] = function (tokens, idx, options, env, self) {
            const token = tokens[idx];
            if (token.map) {
                eleOpen.attrSet("data-lines", token.map.join(','));
            }
            const result = defaultRenderer(tokens, idx, options, env, self);
            return `${renderer.renderToken([eleOpen], 0, options)}${result}${renderer.renderToken([eleClose], 0, options)}`;
        };
    });

    const defaultBlockquoteOpenRenderer = md.renderer.rules.blockquote_open || proxy
    const defaultBlockquoteCloseRenderer = md.renderer.rules.blockquote_close || proxy

    md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        token.hidden = true
        if (token.map) {
            eleOpen.attrSet("data-lines", token.map.join(','));
        }
        return `${defaultBlockquoteOpenRenderer(tokens, idx, options, env, self)}${renderer.renderToken([eleOpen], 0, {})}`
    }

    md.renderer.rules.blockquote_close = (tokens, idx, options, env, self) => {
        const token = tokens[idx];
        token.hidden = true
        return `${renderer.renderToken([eleClose], 0, options)}${defaultBlockquoteCloseRenderer(tokens, idx, options, env, self)}`
    }
}

export default customMdItPlugin;