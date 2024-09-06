import { defaultOptions, type IHtmlParserContext, type IHtmlParserOptions, type IHtmlParserSelectorRules } from 'markmap-html-parser';

const customizeSelectorRules: IHtmlParserSelectorRules = {
    'div,p': ({ $node }) => {
        return {
            queue: $node.children(),
        };
    },
    'h1,h2,h3,h4,h5,h6': ({ $node, getContent }) => {
        return {
            ...getContent($node.contents()),
        };
    },
    'ul,ol': ({ $node }) => {
        return {
            queue: $node.children(),
            nesting: true,
        };
    },
    li: ({ $node, getContent }) => {
        const queue = $node.children().filter('ul,ol');
        let content: ReturnType<typeof getContent>;
        if ($node.contents().first().is('div,p')) {
            content = getContent($node.children().first());
        } else {
            let $contents = $node.contents();
            const i = $contents.index(queue);
            if (i >= 0) {
                $contents = $contents.slice(0, i);
            };
            content = getContent($contents);
        }
        return {
            queue,
            nesting: true,
            ...content,
        };
    },
    'table,pre,p>img:only-child,node-container': ({ $node, getContent }) => {
        return {
            ...getContent($node),
        };
    }
};
for (const key in customizeSelectorRules) {
    const custFn = customizeSelectorRules[key];
    customizeSelectorRules[key] = (context: IHtmlParserContext) => {
        const getContent = custFn(context);
        return getContent;
    }
}

export const customizeOptions: IHtmlParserOptions = {
    selector: `${defaultOptions.selector},node-container`,
    selectorRules: customizeSelectorRules,
};
