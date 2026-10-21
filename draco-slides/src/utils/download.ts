/** Starts a browser download for a URL without navigating away from the app. */
export function startDownload(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
