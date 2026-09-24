import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">DocWrite</h1>
        <Link
          href="/settings"
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          Settings
        </Link>
      </header>

      <main className="flex-1 px-6 py-10 max-w-4xl w-full mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold">Your documents</h2>
            <p className="text-slate-400 text-sm mt-1">
              v1 — project foundation. The editor lands in v2.
            </p>
          </div>
          <Link
            href="/editor"
            className="rounded-md bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-2 text-sm font-medium"
          >
            New document
          </Link>
        </div>

        <div className="rounded-lg border border-dashed border-slate-800 p-12 text-center text-slate-500">
          No documents yet. Create one to get started.
        </div>
      </main>

      <footer className="border-t border-slate-800 px-6 py-3 text-xs text-slate-500">
        DocWrite v1.0.0 &middot; installable as an app on this device
      </footer>
    </div>
  );
}
