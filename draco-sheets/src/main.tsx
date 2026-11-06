import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Draco Sheets is a plain website (no PWA). Remove any service worker + caches an earlier version installed so visitors always get the latest build.
try { void navigator.serviceWorker?.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister())); void caches?.keys().then((ks) => ks.forEach((k) => void caches.delete(k))); } catch { /* not supported */ }
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
