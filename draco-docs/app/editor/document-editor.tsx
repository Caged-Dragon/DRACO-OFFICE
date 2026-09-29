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
import StyleControls from "./style-controls";
import { styleSetToCssVars } from "./style-sets";
import ToolbarRow from "./toolbar-row";
import AccessibilityControls from "./accessibility-controls";
import { useSystemPrefersDark } from "./use-system-dark";
import {
  loadPreferences,
  savePreferences,
  resolveTheme,
  type PageThemePreference,
} from "./preferences";
import FileControls from "./file-controls";
import TemplateControls from "./template-controls";
import TableControls from "./table-controls";
import ImageControls from "./image-controls";
import LinkControls from "./link-controls";
import HeaderFooterControls from "./header-footer-controls";
import FindReplaceControls from "./find-replace-controls";
import FindAndReplace from "./find-replace-extension";
import SpellCheck from "./spellcheck-extension";
import SpellCheckControls from "./spellcheck-controls";
import Indent from "./indent-extension";
import { computeTextStats, formatReadingTime } from "./text-stats";
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
  const [header, setHeader] = useState(initialDraft?.header ?? "");
  const [footer, setFooter] = useState(initialDraft?.footer ?? "");
  const [showPageNumber, setShowPageNumber] = useState(
    initialDraft?.showPageNumber ?? false
  );
  const [pageSettings, setPageSettings] = useState<PageSettings>(() =>
    loadPageSettings()
  );
  // Viewing preference, not document data: deliberately separate from
  // pageSettings so opening someone else's .dwdoc never changes how YOUR
  // editor looks, and your theme choice never travels inside a shared file.
  const [pageThemePref, setPageThemePref] = useState<PageThemePreference>(
    () => loadPreferences().pageTheme
  );
  const systemPrefersDark = useSystemPrefersDark();
  const resolvedTheme = resolveTheme(pageThemePref, systemPrefersDark);
  const [selectionInfo, setSelectionInfo] = useState({
    hasSelection: false,
    from: 0,
    to: 0,
  });

  const editor = useEditor({
    immediatelyRender: false,
    content: initialDraft?.content,
    extensions: [
      // StarterKit bundles Link in this TipTap version, so it's configured
      // here rather than registered separately (a second registration
      // produced a "duplicate extension" warning and made it ambiguous
      // which config applied).
      StarterKit.configure({
        link: {
          autolink: true,
          openOnClick: false, // clicking edits it in our editor instead of navigating away
        },
      }),
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
      FindAndReplace,
      SpellCheck,
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
    ],
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none",
      },
      handleClick: (view, pos, event) => {
        if (!(event.metaKey || event.ctrlKey)) return false;
        const attrs = editor?.getAttributes("link");
        if (attrs?.href) {
          window.open(attrs.href, "_blank", "noopener,noreferrer");
          return true;
        }
        return false;
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
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <a
        href="#editor-page"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-blue-600 focus:text-white focus:px-3 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Skip to document
      </a>
      <ToolbarRow label="File actions" className="flex items-center gap-2">
        <FileControls
          getDocument={() => ({
            title,
            header,
            footer,
            showPageNumber,
            content: editor.getJSON(),
            pageSettings,
          })}
          onOpen={(file: DocWriteFile) => {
            editor.commands.setContent(file.content);
            setTitle(file.title);
            setHeader(file.header);
            setFooter(file.footer);
            setShowPageNumber(file.showPageNumber);
            setPageSettings(file.pageSettings);
            savePageSettings(file.pageSettings);
            scheduleSave({
              title: file.title,
              header: file.header,
              footer: file.footer,
              showPageNumber: file.showPageNumber,
            });
          }}
        />
        <TemplateControls
          hasContent={editor.getText().trim().length > 0 || title.trim().length > 0}
          onSelect={(template) => {
            editor.commands.setContent(template.content);
            setTitle(template.title);
            scheduleSave({ title: template.title, header, footer, showPageNumber });
          }}
        />
      </ToolbarRow>
      <ToolbarRow label="History and find & replace" className="flex items-center justify-between">
        <HistoryControls editor={editor} />
        <FindReplaceControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Text formatting" className="flex items-center gap-1">
        <FormattingToolbar editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Links">
        <LinkControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Font">
        <FontControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Paragraph formatting">
        <ParagraphControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Headings" className="flex items-center gap-3">
        <HeadingControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Document style">
        <StyleControls
          editor={editor}
          styleSet={pageSettings.styleSet}
          onStyleSetChange={(id) => {
            const next = { ...pageSettings, styleSet: id };
            setPageSettings(next);
            savePageSettings(next);
          }}
        />
      </ToolbarRow>
      <ToolbarRow label="Lists">
        <ListControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Table">
        <TableControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Image">
        <ImageControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Page settings">
        <PageSettingsControls
          settings={pageSettings}
          onChange={(next) => {
            setPageSettings(next);
            savePageSettings(next);
          }}
        />
      </ToolbarRow>
      <ToolbarRow label="Header, footer, and spell check" className="flex items-center justify-between">
        <HeaderFooterControls
          header={header}
          footer={footer}
          showPageNumber={showPageNumber}
          onChange={(next) => {
            setHeader(next.header);
            setFooter(next.footer);
            setShowPageNumber(next.showPageNumber);
            scheduleSave({ title, ...next });
          }}
        />
        <SpellCheckControls editor={editor} />
      </ToolbarRow>
      <ToolbarRow label="Accessibility" className="flex items-center justify-between">
        <AccessibilityControls
          preference={pageThemePref}
          resolved={resolvedTheme}
          onChange={(next) => {
            setPageThemePref(next);
            savePreferences({ pageTheme: next });
          }}
        />
      </ToolbarRow>
      <div className="flex-1 overflow-y-auto bg-slate-900 py-10">
        <div
          id="editor-page"
          tabIndex={-1}
          className="mx-auto shadow-xl flex flex-col focus:outline-none"
          style={
            {
              ...styleSetToCssVars(pageSettings.styleSet, resolvedTheme),
              backgroundColor: "var(--doc-page-bg)",
              width: `${getPageDimensionsIn(pageSettings).width}in`,
              minHeight: `${getPageDimensionsIn(pageSettings).height}in`,
            } as React.CSSProperties
          }
        >
          {header && (
            <div
              className="text-xs pb-2"
              style={{
                color: "var(--doc-muted)",
                borderBottom: "1px solid var(--doc-border)",
                paddingLeft: `${getMarginIn(pageSettings)}in`,
                paddingRight: `${getMarginIn(pageSettings)}in`,
                paddingTop: `${getMarginIn(pageSettings) / 2}in`,
              }}
            >
              {header}
            </div>
          )}

          <div
            className="flex-1"
            style={{
              padding: `${getMarginIn(pageSettings)}in`,
              paddingTop: header ? "1rem" : `${getMarginIn(pageSettings)}in`,
              paddingBottom:
                footer || showPageNumber
                  ? "1rem"
                  : `${getMarginIn(pageSettings)}in`,
            }}
          >
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                scheduleSave({ title: e.target.value, header, footer, showPageNumber });
              }}
              placeholder="Untitled document"
              aria-label="Document title"
              style={{ fontFamily: "var(--doc-heading-font)", color: "var(--doc-heading-color)" }}
              className="doc-title-input w-full bg-transparent text-3xl font-bold focus:outline-none pb-4"
            />
            <EditorContent editor={editor} />
          </div>

          {(footer || showPageNumber) && (
            <div
              className="text-xs pt-2 flex items-center justify-between"
              style={{
                color: "var(--doc-muted)",
                borderTop: "1px solid var(--doc-border)",
                paddingLeft: `${getMarginIn(pageSettings)}in`,
                paddingRight: `${getMarginIn(pageSettings)}in`,
                paddingBottom: `${getMarginIn(pageSettings) / 2}in`,
              }}
            >
              <span>{footer}</span>
              {showPageNumber && (
                <span>
                  Page 1{" "}
                  <span className="opacity-70">
                    (multi-page numbering arrives with real pagination in v29)
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cursor / selection / word-count status bar */}
      <div className="border-t border-slate-800 px-4 py-2 text-xs text-slate-400 flex items-center gap-4">
        <span>
          {selectionInfo.hasSelection
            ? (() => {
                const selectedText = editor.state.doc.textBetween(
                  selectionInfo.from,
                  selectionInfo.to,
                  " "
                );
                const selStats = computeTextStats(selectedText);
                return `Selection: ${selStats.words} words, ${
                  selectionInfo.to - selectionInfo.from
                } chars`;
              })()
            : `Cursor at ${selectionInfo.from}`}
        </span>
        {(() => {
          const stats = computeTextStats(editor.getText({ blockSeparator: "\n\n" }));
          return (
            <span>
              {stats.words} words · {stats.characters} characters ·{" "}
              {formatReadingTime(stats.readingTimeMinutes)}
            </span>
          );
        })()}
        <span>
          {saveStatus === "saving" && "Saving…"}
          {saveStatus === "saved" && "Saved"}
        </span>
      </div>
    </div>
  );
}
