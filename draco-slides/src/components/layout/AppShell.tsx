import type { ReactNode } from "react";
import { Toasts } from "../notifications/Toasts";
import { isCloudConfigured } from "../../services/supabase/client";
import { useApp } from "../../state/AppContext";

export function AppShell({ children }: { children: ReactNode }) {
  const { state, dispatch } = useApp();
  const { view, presentation } = state;

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to main content</a>
      <header className="shell__bar">
        <span className="brand">Draco Slides</span>
        <nav aria-label="Main">
          <button
            className={`navbtn${view === "home" ? " navbtn--active" : ""}`}
            aria-current={view === "home" ? "page" : undefined}
            onClick={() => dispatch({ type: "navigate", view: "home" })}
          >
            Home
          </button>
          <button
            className={`navbtn${view === "editor" ? " navbtn--active" : ""}`}
            aria-current={view === "editor" ? "page" : undefined}
            disabled={!presentation}
            title={presentation ? undefined : "Open or create a presentation first"}
            onClick={() => dispatch({ type: "navigate", view: "editor" })}
          >
            Editor
          </button>
        </nav>
        <span className="muted shell__cloud">
          {isCloudConfigured ? "Cloud connection configured" : "Local only"}
        </span>
      </header>
      <main id="main" className="shell__main" tabIndex={-1}>
        {children}
      </main>
      <Toasts />
    </div>
  );
}
