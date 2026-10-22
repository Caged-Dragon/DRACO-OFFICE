import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import { requestPersistentStorage } from "./services/storage/persistence";

void requestPersistentStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline fallback for the installable app. Production builds only, so dev reloads are never cached.
if (import.meta.env.PROD && location.protocol !== "file:" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installation still works without offline support */
    });
  });
}
