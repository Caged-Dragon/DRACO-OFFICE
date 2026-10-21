import Link from "next/link";
import DocumentEditor from "./document-editor";

export default function EditorPage() {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          &larr; Back
        </Link>
      </header>
      <DocumentEditor />
    </div>
  );
}
