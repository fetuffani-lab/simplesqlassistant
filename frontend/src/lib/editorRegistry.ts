import type * as MonacoEditor from "monaco-editor";

type IEditor = MonacoEditor.editor.IStandaloneCodeEditor;

const registry = new Map<string, IEditor>();

export function registerEditor(tabId: string, editor: IEditor) {
  registry.set(tabId, editor);
}

export function unregisterEditor(tabId: string) {
  registry.delete(tabId);
}

export function insertIntoEditor(tabId: string, text: string) {
  const editor = registry.get(tabId);
  if (!editor) return;
  editor.focus();
  const sel = editor.getSelection();
  const pos = editor.getPosition();
  if (!sel && !pos) return;
  const range = sel ?? {
    startLineNumber: pos!.lineNumber,
    startColumn: pos!.column,
    endLineNumber: pos!.lineNumber,
    endColumn: pos!.column,
  };
  editor.executeEdits("explorer", [{ range, text }]);
}
