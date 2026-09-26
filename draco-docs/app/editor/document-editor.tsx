"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, FontFamily, FontSize, LineHeight, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import WrappableImage from "./image-extension";
import { useState } from "react";
import FormattingToolbar from "./formatting-toolbar";
import FontControls from "./font-controls";
import ParagraphControls from "./paragraph-controls";
import ListControls from "./list-controls";
import HistoryControls from "./history-controls";
import HeadingControls from "./heading-controls";
import PageSettingsControls from "./page-settings-controls";
import FileControls from "./file-controls";
import TableControls from "./table-controls";
import ImageControls from "./image-controls";
import Indent from "./indent-extension";
import { useAutosave, loadDraft } from "./use-autosave";
import type { DocWriteFile } from "./file-format";
import {
  loadPageSettings,
  savePageSettings,
  getPageDimensionsIn,
  getMarginIn,
  type PageSettings,
} from "./page-settings";

export default function DocumentEditor() {
  // Read any saved draft once, synchronously, during the initial render —
  // safe because loadDraft() is SSR-guarded (returns null on the server),
  // and this component renders "Loading editor…" until the editor is ready
  // client-side anyway, so there's nothing for this to mismatch against.
  const [initialDraft] = useState(() => loadDraft());
  const [title, setTitle] = useState(initialDraft?.title ?? "");
  const [pageSettings, setPageSettings] = useState<PageSettings>(() =>
    loadPageSettings()
  );
  const [selectionInfo, setSelectionInfo] = useState({
    hasSelection: false,
    from: 0,
    to: 0,
  });

  const editor = useEditor({
    immediatelyRender: false,
    content: initialDraft?.content,
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      FontSize,
      LineHeight.configure({ types: ["paragraph", "heading"] }),
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["paragraph", "heading"] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      WrappableImage.configure({
        allowBase64: true,
        resize: { enabled: true, minWidth: 60, minHeight: 60 },
      }),
      Indent,
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none",
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection;
      setSelectionInfo({ hasSelection: !empty, from, to });
    },
    onTransaction: () => {
      // Re-render so toolbar button active-states (bold/italic/etc.)
      // reflect marks toggled at the current selection.
      setSelectionInfo((s) => ({ ...s }));
    },
  });

  // Initial selectionInfo state already matches a fresh editor's cursor
  // position (from: 0, to: 0, no selection), so no sync effect is needed.

  const { status: saveStatus, scheduleSave } = useAutosave(editor);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-slate-800 px-4 py-2">
        <FileControls
          getDocument={() => ({
            title,
            content: editor.getJSON(),
            pageSettings,
          })}
          onOpen={(file: DocWriteFile) => {
            editor.commands.setContent(file.content);
            setTitle(file.title);
            setPageSettings(file.pageSettings);
            savePageSettings(file.pageSettings);
            scheduleSave(file.title);
          }}
        />
      </div>
      <div className="border-b border-slate-800 px-4 py-2">
        <HistoryControls editor={editor} />
      </div>
      <FormattingToolbar editor={editor} />
      <div className="border-b border-slate-800 px-4 py-2">
        <FontControls editor={editor} />
      </div>
      <div className="border-b border-slate-800 px-4 py-2">
        <ParagraphControls editor={editor} />
      </div>
      <div className="border-b border-slate-800 px-4 py-2 flex items-center gap-3">
        <HeadingControls editor={editor} />
      </div>
      <div className="border-b border-slate-800 px-4 py-2">
        <ListControls editor={editor} />
      </div>
      <div className="border-b border-slate-800 px-4 py-2">
        <TableControls editor={editor} />
      </div>
      <div className="border-b border-slate-800 px-4 py-2">
        <ImageControls editor={editor} />
      </div>
      <div className="border-b border-slate-800 px-4 py-2">
        <PageSettingsControls
          settings={pageSettings}
          onChange={(next) => {
            setPageSettings(next);
            savePageSettings(next);
          }}
        />
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-900 py-10">
        <div
          className="mx-auto bg-white shadow-xl"
          style={{
            width: `${getPageDimensionsIn(pageSettings).width}in`,
            minHeight: `${getPageDimensionsIn(pageSettings).height}in`,
            padding: `${getMarginIn(pageSettings)}in`,
          }}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave(e.target.value);
            }}
            placeholder="Untitled document"
            aria-label="Document title"
            className="w-full bg-transparent text-3xl font-bold text-slate-900 placeholder-slate-400 focus:outline-none pb-4"
          />
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Cursor / selection status bar (word count lands in v17) */}
      <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500 flex items-center gap-4">
        <span>
          {selectionInfo.hasSelection
            ? `Selection: ${selectionInfo.to - selectionInfo.from} chars`
            : `Cursor at ${selectionInfo.from}`}
        </span>
        <span>
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
        </span>
      </div>
    </div>
  );
}
