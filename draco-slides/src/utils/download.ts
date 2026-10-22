/** Starts a browser download for a URL without navigating away from the app. */
export function startDownload(url: string, filename?: string): void {
  const a = document.createElement("a");
  a.href = url;
  if (filename) a.download = filename;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Downloads text as a file generated in the browser. */
export function downloadTextFile(filename: string, text: string, mime = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  startDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
