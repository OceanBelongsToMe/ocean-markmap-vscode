const vscode = acquireVsCodeApi();
let firstTime = true;
let root;
let style;
const handlers = {
  setData(data) {
    mm.setData(root = data.root, markmap.deriveOptions(data.jsonOptions) || {});
    if (firstTime) {
      mm.fit();
      firstTime = false;
    }
  },
  setCursor(line) {
    const active = root && findActiveNode(line);
    if (active) {
      mm.ensureView(active, {
        bottom: 80,
      });
    }
  },
  setCSS(data) {
    if (!style) {
      style = document.createElement('style');
      document.head.append(style);
    }
    style.textContent = data || '';
  },
  setTheme(dark) {
    document.documentElement.classList[dark ? 'add' : 'remove']('markmap-dark');
  },
};
window.addEventListener('message', e => {
  const { type, data } = e.data;
  const handler = handlers[type];
  handler?.(data);
});
document.addEventListener('click', e => {
  let el = e.target?.closest('a');
  if (el) {
    let href = el.getAttribute('href');
    if (!href.includes('://')) {
      href = href.split('#')[0];
      if (href) {
        vscode.postMessage({
          type: 'openFile',
          data: href,
        });
        return;
      }
    }
  }
  el = e.target?.closest('node-container');

  if (el) {
    let lines = el.getAttribute('data-lines');
    vscode.postMessage({
      type: 'location',
      data: lines,
    });
  }
});
vscode.postMessage({ type: 'refresh' });

const toolbar = new markmap.Toolbar();
// toolbar.register({
//   id: 'editAsText',
//   title: 'Edit as text',
//   content: createButton('Edit'),
//   onClick: clickHandler('editAsText'),
// });
toolbar.register({
  id: 'exportAsHtml',
  title: 'Export as HTML',
  content: createButton('Export'),
  onClick: clickHandler('exportAsHtml'),
});
// toolbar.setItems(['zoomIn', 'zoomOut', 'fit', 'recurse', 'editAsText', 'exportAsHtml']);
toolbar.setItems(['zoomIn', 'zoomOut', 'fit', 'recurse', 'exportAsHtml']);
setTimeout(() => {
  toolbar.attach(mm);
  document.body.append(toolbar.el);
});

function createButton(text) {
  const el = document.createElement('div');
  el.className = 'btn-text';
  el.textContent = text;
  return el;
}

function clickHandler(type) {
  return () => {
    vscode.postMessage({ type });
  };
}

function findActiveNode(line) {
  function dfs(node) {
    const lines = node.payload?.lines.split(',');
    if (lines && lines[0] <= line && line < lines[1]) {
      best = node;
    }
    node.children?.forEach(dfs);
  }
  let best;
  dfs(root);
  return best;
}
