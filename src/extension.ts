import debounce from 'lodash.debounce';
import { JSItem, type CSSItem } from 'markmap-common';
import { fillTemplate } from 'markmap-render';
import type { IMarkmapJSONOptions } from 'markmap-view';
import {
  CancellationToken,
  ColorThemeKind,
  CustomTextEditorProvider,
  ExtensionContext,
  TextDocument,
  Uri,
  ViewColumn,
  WebviewPanel,
  commands,
  window as vscodeWindow,
  workspace,
  Range, Selection,
  TextEditorRevealType,
} from 'vscode';
import { Utils } from 'vscode-uri';
import {
  getAssets,
  mergeAssets,
  setExportMode,
  transformerExport,
  transformerLocal,
} from './util';
import { customizeOptions } from './parser';

const PREFIX = 'markmap-vscode';
const VIEW_TYPE = `${PREFIX}.markmap`;

const renderToolbar = () => {
  const { markmap, mm } = window as any;
  const { el } = markmap.Toolbar.create(mm);
  el.setAttribute('style', 'position:absolute;bottom:20px;right:20px');
  document.body.append(el);
};

class MarkmapEditor implements CustomTextEditorProvider {
  constructor(private context: ExtensionContext) { }

  private resolveAssetPath(relPath: string) {
    return Utils.joinPath(this.context.extensionUri, relPath);
  }

  private async loadAsset(relPath: string) {
    const bytes = await workspace.fs.readFile(this.resolveAssetPath(relPath));
    const decoder = new TextDecoder();
    const data = decoder.decode(bytes);
    return data;
  }

  public async resolveCustomTextEditor(
    document: TextDocument,
    webviewPanel: WebviewPanel,
    token: CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    const resolveUrl = (relPath: string) =>
      webviewPanel.webview
        .asWebviewUri(this.resolveAssetPath(relPath))
        .toString();
    const { allAssets } = getAssets(transformerLocal);
    const resolvedAssets = {
      ...allAssets,
      styles: allAssets.styles?.map((item) => {
        if (item.type === 'stylesheet') {
          return {
            ...item,
            data: {
              href: resolveUrl(item.data.href),
            },
          };
        }
        return item;
      }),
      scripts: allAssets.scripts?.map((item) => {
        if (item.type === 'script' && item.data.src) {
          return {
            ...item,
            data: {
              ...item.data,
              src: resolveUrl(item.data.src),
            },
          };
        }
        return item;
      }),
    };
    webviewPanel.webview.html = fillTemplate(undefined, resolvedAssets, {
      baseJs: [],
      urlBuilder: transformerLocal.urlBuilder,
    });
    const updateCursor = () => {
      const editor = vscodeWindow.activeTextEditor;
      if (editor?.document === document) {
        webviewPanel.webview.postMessage({
          type: 'setCursor',
          data: editor.selection.active.line,
        });
      }
    };
    let defaultOptions: IMarkmapJSONOptions;
    let customCSS: string;
    const jumpViewId = workspace
      .getConfiguration('markmap')
      .get<string>('jumpViewId');
    const splitCommand = workspace
      .getConfiguration('markmap')
      .get<string>('split');
    const updateOptions = () => {
      const raw = workspace
        .getConfiguration('markmap')
        .get<string>('defaultOptions');
      try {
        defaultOptions = raw && JSON.parse(raw);
      } catch {
        defaultOptions = null;
      }
      update();
    };
    const updateCSS = () => {
      customCSS = workspace
        .getConfiguration('markmap')
        .get<string>('customCSS');
      webviewPanel.webview.postMessage({
        type: 'setCSS',
        data: customCSS,
      });
    };
    const updateTheme = () => {
      const dark = [ColorThemeKind.Dark, ColorThemeKind.HighContrast].includes(vscodeWindow.activeColorTheme.kind);
      webviewPanel.webview.postMessage({
        type: 'setTheme',
        data: dark,
      });
    };
    const update = () => {
      const md = document.getText();
      const { root, frontmatter } = transformerLocal.transform(md, customizeOptions);
      webviewPanel.webview.postMessage({
        type: 'setData',
        data: {
          root,
          jsonOptions: {
            ...defaultOptions,
            ...(frontmatter as any)?.markmap,
          },
        },
      });
      updateCursor();
    };
    const debouncedUpdateCursor = debounce(updateCursor, 300);
    const debouncedUpdate = debounce(update, 300);
    const openFile = (relPath: string) => {
      const filePath = Utils.joinPath(Utils.dirname(document.uri), relPath);
      if (jumpViewId) {
        commands.executeCommand(
          'vscode.openWith',
          filePath,
          jumpViewId
        );
        return;
      }
      const isOpen = vscodeWindow.visibleTextEditors.some(
        editor => editor.document.uri.fsPath === filePath.fsPath
      );
      if (isOpen) {
        // 如果文件已经打开，则聚焦到该文件
        const existingEditor = vscodeWindow.visibleTextEditors.find(
          editor => editor.document.uri.fsPath === filePath.fsPath
        );
        if (existingEditor) {
          vscodeWindow.showTextDocument(existingEditor.document, existingEditor.viewColumn);
        }
      } else {
        // 如果文件没有打开，则在新面板中打开文件
        commands.executeCommand('vscode.open', filePath, { viewColumn: ViewColumn.Beside });
      }
    }
    const messageHandlers: { [key: string]: (data?: any) => void } = {
      refresh: () => {
        update();
        updateCSS();
        updateTheme();
      },
      editAsText: () => {
        vscodeWindow.showTextDocument(document, {
          viewColumn: ViewColumn.Beside,
        });
      },
      exportAsHtml: async () => {
        const targetUri = await vscodeWindow.showSaveDialog({
          saveLabel: 'Export',
          filters: {
            HTML: ['html'],
          },
        });
        if (!targetUri) return;
        const md = document.getText();
        const { root, features, frontmatter } = transformerExport.transform(md, customizeOptions);
        const jsonOptions = {
          ...defaultOptions,
          ...(frontmatter as any)?.markmap,
        };
        const { embedAssets } = jsonOptions as { embedAssets?: boolean };
        setExportMode(embedAssets);
        let assets = transformerExport.getUsedAssets(features);
        const { baseAssets, toolbarAssets } = getAssets(transformerExport);
        assets = mergeAssets(baseAssets, assets, toolbarAssets, {
          styles: [
            ...(customCSS
              ? [
                {
                  type: 'style',
                  data: customCSS,
                } as CSSItem,
              ]
              : []),
          ],
          scripts: [
            {
              type: 'iife',
              data: {
                fn: (r: typeof renderToolbar) => {
                  setTimeout(r);
                },
                getParams: () => [renderToolbar],
              },
            },
          ],
        });
        if (embedAssets) {
          const [styles, scripts] = await Promise.all([
            Promise.all(
              (assets.styles || []).map(async (item): Promise<CSSItem> => {
                if (item.type === 'stylesheet') {
                  return {
                    type: 'style',
                    data: await this.loadAsset(item.data.href),
                  };
                }
                return item;
              }),
            ),
            Promise.all(
              (assets.scripts || []).map(async (item): Promise<JSItem> => {
                if (item.type === 'script' && item.data.src) {
                  return {
                    ...item,
                    data: {
                      textContent: await this.loadAsset(item.data.src),
                    },
                  };
                }
                return item;
              }),
            ),
          ]);
          assets = {
            styles,
            scripts,
          };
        }
        const html = fillTemplate(root, assets, {
          baseJs: [],
          jsonOptions,
          urlBuilder: transformerExport.urlBuilder,
        });
        const encoder = new TextEncoder();
        const data = encoder.encode(html);
        try {
          await workspace.fs.writeFile(targetUri, data);
        } catch (e) {
          vscodeWindow.showErrorMessage(
            `Cannot write file "${targetUri.toString()}"!`,
          );
        }
      },
      openFile,
      location: async (lines: string) => {
        let isOpen = vscodeWindow.visibleTextEditors.find(
          editor => editor.document.uri.fsPath === document.uri.fsPath
        );

        let viewColumn: ViewColumn;
        const all = vscodeWindow.tabGroups.all;
        let closeOthers = false;

        if (isOpen) {
          viewColumn = isOpen.viewColumn;
        } else if (all.length >= 2) {
          await commands.executeCommand(splitCommand || 'workbench.action.splitEditorToLastGroup');
          closeOthers = true;
          viewColumn = vscodeWindow.tabGroups.activeTabGroup.viewColumn;
        } else {
          viewColumn = ViewColumn.Beside;
        }

        isOpen = await vscodeWindow.showTextDocument(document, {
          viewColumn,
        });
        const lineNumbers = lines.split(',').map(Number);
        // 创建一个新的 Range 对象，并跳转到该行
        const line = document.lineAt(lineNumbers[0]);
        let range = line.range;;
        range = new Range(range.end, range.end);
        isOpen.revealRange(range, TextEditorRevealType.AtTop);
        // 将光标移动到指定行
        isOpen.selection = new Selection(range.start, range.end);
        if (closeOthers) {
          await commands.executeCommand('workbench.action.closeOtherEditors');
        }
      },
    };
    const logger = vscodeWindow.createOutputChannel('Markmap');
    messageHandlers.log = (data: string) => {
      logger.appendLine(data);
    };
    webviewPanel.webview.onDidReceiveMessage((e) => {
      const handler = messageHandlers[e.type];
      handler?.(e.data);
    });
    workspace.onDidChangeTextDocument((e) => {
      if (e.document === document) {
        debouncedUpdate();
      }
    });
    vscodeWindow.onDidChangeTextEditorSelection(() => {
      debouncedUpdateCursor();
    });
    vscodeWindow.onDidChangeActiveColorTheme(updateTheme);
    updateOptions();
    updateCSS();
    updateTheme();
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('markmap.defaultOptions')) updateOptions();
      if (e.affectsConfiguration('markmap.customCSS')) updateCSS();
    });
  }
}

export function activate(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand(`${PREFIX}.open`, (uri?: Uri) => {
      uri ??= vscodeWindow.activeTextEditor?.document.uri;
      commands.executeCommand(
        'vscode.openWith',
        uri,
        VIEW_TYPE,
        vscodeWindow.activeTextEditor?.viewColumn,
      );
    }),
  );
  const markmapEditor = new MarkmapEditor(context);
  context.subscriptions.push(
    vscodeWindow.registerCustomEditorProvider(VIEW_TYPE, markmapEditor, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
}

export function deactivate() {
  // noop
}
