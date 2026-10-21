import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectPlatform,
  fetchInstallerAsset,
  isDesktopApp,
  pickInstallerAsset,
} from "../../src/services/release/installer";

const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";
const asset = (name: string) => ({ name, browser_download_url: `https://github.com/o/r/releases/download/t/${name}` });

describe("installer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("detects platform and the desktop app", () => {
    expect(detectPlatform(WIN)).toBe("windows");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("mac");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17 like Mac OS X)")).toBeNull();
    expect(isDesktopApp(`${WIN} Electron/33.2.0`)).toBe(true);
    expect(isDesktopApp(WIN)).toBe(false);
  });

  it("picks the right installer per platform", () => {
    const all = [asset("Draco-Slides-0.4.0.dmg"), asset("Draco-Slides-0.4.0.AppImage"), asset("Draco-Slides-Setup-0.4.0.exe"), asset("notes.txt")];
    expect(pickInstallerAsset(all, "windows")?.name).toBe("Draco-Slides-Setup-0.4.0.exe");
    expect(pickInstallerAsset(all, "mac")?.name).toBe("Draco-Slides-0.4.0.dmg");
    expect(pickInstallerAsset(all, "linux")?.name).toBe("Draco-Slides-0.4.0.AppImage");
    expect(pickInstallerAsset([asset("notes.txt")], "windows")).toBeNull();
  });

  it("finds the asset on the release for the tag and ignores non-GitHub URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { tag_name: "draco-docs/v1.0.0", assets: [asset("Docs-Setup.exe")] },
          {
            tag_name: "draco-slides/v0.4.0",
            assets: [{ name: "Evil-Setup.exe", browser_download_url: "https://evil.example/Evil-Setup.exe" }, asset("Draco-Slides-Setup-0.4.0.exe")],
          },
        ],
      }),
    );
    const a = await fetchInstallerAsset("o/r", "draco-slides/v0.4.0", "windows");
    expect(a?.name).toBe("Draco-Slides-Setup-0.4.0.exe");
  });

  it("returns null when the tag has no release", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    expect(await fetchInstallerAsset("o/r", "draco-slides/v0.4.0", "windows")).toBeNull();
  });
});
