// Electron entry for the Draco Slides desktop app. Loads the production build from disk.
const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

function isSafeExternal(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#12232b",
    title: "Draco Slides",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.setMenuBarVisibility(false);

  // Links to the outside web (e.g. GitHub releases) open in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternal(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      if (isSafeExternal(url)) shell.openExternal(url);
    }
  });

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
