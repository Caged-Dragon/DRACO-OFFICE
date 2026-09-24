import Link from "next/link";

export default function SettingsPlaceholder() {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
          &larr; Back
        </Link>
        <span className="text-sm text-slate-500">Settings</span>
      </header>
      <main className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        The full preferences panel ships in v47 (Settings).
      </main>
    </div>
  );
}
