"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, FontFamily, FontSize, LineHeight, Color } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import WrappableImage from "./image-extension";
import CommentMark from "./comment-extension";
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
import SidebarRail from "./sidebar-rail";
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
import CommentControls from "./comment-controls";
import CommentsPanel from "./comments-panel";
import TrackChanges, { trackChangesPluginKey } from "./track-changes-extension";
import TrackChangesControls from "./track-changes-controls";
import TrackChangesPanel from "./track-changes-panel";
import { listChanges } from "./track-changes";
import FindReplaceControls from "./find-replace-controls";
import FindAndReplace from "./find-replace-extension";
import SpellCheck from "./spellcheck-extension";
import SpellCheckControls from "./spellcheck-controls";
import Indent from "./indent-extension";
import { computeTextStats, formatReadingTime } from "./text-stats";
import { useAutosave, loadDraft } from "./use-autosave";
import {
  createComment,
  addReply,
  setResolved,
  updateComment,
  removeComment,
  unresolvedCount as countUnresolved,
  type Comment,
} from "./comments";
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
  const [comments, setComments] = useState<Comment[]>(
    initialDraft?.comments ?? []
  );
  const [rightPanel, setRightPanel] = useState<"comments" | "changes" | null>(null);
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
      CommentMark,
      TrackChanges,
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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Loading editor…
      </div>
    );
  }

  const TOOLBAR_GROUPS: {
    id: string;
    label: string;
    icon: string;
    content: React.ReactNode;
  }[] = [
    {
      id: "file",
      label: 'File actions',
      icon: "📁",
      content: (
        <>
        <FileControls
          getDocument={() => ({
            title,
            header,
            footer,
            showPageNumber,
            comments,
            content: editor.getJSON(),
            pageSettings,
          })}
          onOpen={(file: DocWriteFile) => {
            editor.commands.setContent(file.content);
            setTitle(file.title);
            setHeader(file.header);
            setFooter(file.footer);
            setShowPageNumber(file.showPageNumber);
            setComments(file.comments);
            setPageSettings(file.pageSettings);
            savePageSettings(file.pageSettings);
            scheduleSave({
              title: file.title,
              header: file.header,
              footer: file.footer,
              showPageNumber: file.showPageNumber,
              comments: file.comments,
            });
          }}
        />
        <TemplateControls
          hasContent={editor.getText().trim().length > 0 || title.trim().length > 0}
          onSelect={(template) => {
            editor.commands.setContent(template.content);
            setTitle(template.title);
            setComments([]);
            scheduleSave({
              title: template.title,
              header,
              footer,
              showPageNumber,
              comments: [],
            });
          }}
        />
        </>
      ),
    },
    {
      id: "history",
      label: 'History and find & replace',
      icon: "↺",
      content: (
        <>
        <HistoryControls editor={editor} />
        <FindReplaceControls editor={editor} />
        </>
      ),
    },
    {
      id: "format",
      label: 'Text formatting',
      icon: "B",
      content: (
        <>
        <FormattingToolbar editor={editor} />
        </>
      ),
    },
    {
      id: "links",
      label: 'Links',
      icon: "🔗",
      content: (
        <>
        <LinkControls editor={editor} />
        </>
      ),
    },
    {
      id: "font",
      label: 'Font',
      icon: "Aa",
      content: (
        <>
        <FontControls editor={editor} />
        </>
      ),
    },
    {
      id: "paragraph",
      label: 'Paragraph formatting',
      icon: "¶",
      content: (
        <>
        <ParagraphControls editor={editor} />
        </>
      ),
    },
    {
      id: "headings",
      label: 'Headings',
      icon: "H",
      content: (
        <>
        <HeadingControls editor={editor} />
        </>
      ),
    },
    {
      id: "style",
      label: 'Document style',
      icon: "🎨",
      content: (
        <>
        <StyleControls
          editor={editor}
          styleSet={pageSettings.styleSet}
          onStyleSetChange={(id) => {
            const next = { ...pageSettings, styleSet: id };
            setPageSettings(next);
            savePageSettings(next);
          }}
        />
        </>
      ),
    },
    {
      id: "lists",
      label: 'Lists',
      icon: "☰",
      content: (
        <>
        <ListControls editor={editor} />
        </>
      ),
    },
    {
      id: "table",
      label: 'Table',
      icon: "⊞",
      content: (
        <>
        <TableControls editor={editor} />
        </>
      ),
    },
    {
      id: "image",
      label: 'Image',
      icon: "🖼",
      content: (
        <>
        <ImageControls editor={editor} />
        </>
      ),
    },
    {
      id: "page",
      label: 'Page settings',
      icon: "📄",
      content: (
        <>
        <PageSettingsControls
          settings={pageSettings}
          onChange={(next) => {
            setPageSettings(next);
            savePageSettings(next);
          }}
        />
        </>
      ),
    },
    {
      id: "headerfooter",
      label: 'Header, footer, and spell check',
      icon: "✓",
      content: (
        <>
        <HeaderFooterControls
          header={header}
          footer={footer}
          showPageNumber={showPageNumber}
          onChange={(next) => {
            setHeader(next.header);
            setFooter(next.footer);
            setShowPageNumber(next.showPageNumber);
            scheduleSave({ title, ...next, comments });
          }}
        />
        <SpellCheckControls editor={editor} />
        </>
      ),
    },
    {
      id: "comments",
      label: 'Comments',
      icon: "💬",
      content: (
        <>
        <CommentControls
          editor={editor}
          hasSelection={selectionInfo.hasSelection}
          unresolvedCount={countUnresolved(comments)}
          panelOpen={rightPanel === "comments"}
          onTogglePanel={() =>
            setRightPanel((p) => (p === "comments" ? null : "comments"))
          }
          onAddComment={(quote, body) => {
            const comment = createComment(quote, body);
            setComments((prev) => [...prev, comment]);
            editor.chain().focus().setComment(comment.id).run();
            setRightPanel("comments");
          }}
        />
        </>
      ),
    },
    {
      id: "trackChanges",
      label: "Track Changes",
      icon: "\u270E",
      content: (
        <>
          <TrackChangesControls
            enabled={trackChangesPluginKey.getState(editor.state)?.enabled ?? false}
            onToggleEnabled={() =>
              editor.commands.setTrackChangesEnabled(
                !(trackChangesPluginKey.getState(editor.state)?.enabled ?? false)
              )
            }
            changeCount={listChanges(editor.state.doc).length}
            panelOpen={rightPanel === "changes"}
            onTogglePanel={() =>
              setRightPanel((p) => (p === "changes" ? null : "changes"))
            }
          />
        </>
      ),
    },
    {
      id: "accessibility",
      label: 'Accessibility',
      icon: "♿",
      content: (
        <>
        <AccessibilityControls
          preference={pageThemePref}
          resolved={resolvedTheme}
          onChange={(next) => {
            setPageThemePref(next);
            savePreferences({ pageTheme: next });
          }}
        />
        </>
      ),
    },
  ];
  const activeGroup = TOOLBAR_GROUPS.find((g) => g.id === activeGroupId) ?? null;

  return (
    <div className="flex-1 flex flex-col">
      <a
        href="#editor-page"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-blue-600 focus:text-white focus:px-3 focus:py-2 focus:rounded-md focus:text-sm"
      >
        Skip to document
      </a>
      <div className="flex-1 flex overflow-hidden">
        <SidebarRail
          groups={TOOLBAR_GROUPS.map(({ id, label, icon }) => ({ id, label, icon }))}
          activeId={activeGroupId}
          onSelect={setActiveGroupId}
        />
        {activeGroup && (
          <div className="w-80 shrink-0 flex flex-col border-r border-slate-800 bg-slate-900 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 sticky top-0 bg-slate-900">
              <span className="text-xs font-semibold text-slate-300">
                {activeGroup.label}
              </span>
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setActiveGroupId(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <ToolbarRow
              label={activeGroup.label}
              className="flex flex-wrap items-start content-start gap-3 p-3"
            >
              {activeGroup.content}
            </ToolbarRow>
          </div>
        )}
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
                scheduleSave({ title: e.target.value, header, footer, showPageNumber, comments });
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
        {rightPanel === "comments" && (
          <CommentsPanel
            comments={comments}
            onReply={(id, body) => {
              setComments((prev) => updateComment(prev, id, (c) => addReply(c, body)));
            }}
            onToggleResolved={(id) => {
              const target = comments.find((c) => c.id === id);
              if (!target) return;
              const nextResolved = !target.resolved;
              editor.commands.setCommentResolvedById(id, nextResolved);
              setComments((prev) => updateComment(prev, id, (c) => setResolved(c, nextResolved)));
            }}
            onDelete={(id) => {
              editor.commands.removeCommentById(id);
              setComments((prev) => removeComment(prev, id));
            }}
          />
        )}
        {rightPanel === "changes" && (
          <TrackChangesPanel
            changes={listChanges(editor.state.doc)}
            onAccept={(id) => editor.commands.acceptChange(id)}
            onReject={(id) => editor.commands.rejectChange(id)}
            onAcceptAll={() => editor.commands.acceptAllChanges()}
            onRejectAll={() => editor.commands.rejectAllChanges()}
          />
        )}
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
