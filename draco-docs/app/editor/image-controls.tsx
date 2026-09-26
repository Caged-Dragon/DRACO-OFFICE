"use client";

import { useRef } from "react";
import type { Editor } from "@tiptap/react";
import type { ImageWrap } from "./image-extension";

const WRAP_OPTIONS: { label: string; value: ImageWrap }[] = [
  { label: "No wrap", value: "none" },
  { label: "Wrap left", value: "left" },
  { label: "Wrap right", value: "right" },
];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ImageControls({ editor }: { editor: Editor }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageSelected = editor.isActive("image");

  const handleInsertClick = () => fileInputRef.current?.click();

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    editor.chain().focus().setImage({ src: dataUrl, alt: file.name }).run();
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Insert image"
      />
      <button
        type="button"
        onClick={handleInsertClick}
        className="text-xs px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
      >
        Insert image
      </button>

      {imageSelected && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 mr-1">
            Selected image:
          </span>
          {WRAP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={editor.getAttributes("image").wrap === opt.value}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("image", { wrap: opt.value })
                  .run()
              }
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                editor.getAttributes("image").wrap === opt.value
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
