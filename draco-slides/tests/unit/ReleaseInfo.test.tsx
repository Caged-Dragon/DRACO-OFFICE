import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "../../src/app/version";
import { ReleaseInfo } from "../../src/features/release/ReleaseInfo";
import { AppProvider } from "../../src/state/AppContext";
import { startDownload } from "../../src/utils/download";

vi.mock("../../src/utils/download", () => ({ startDownload: vi.fn() }));

const WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";

function mockGithub(tags: string[], releases: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("matching-refs")) {
        return { ok: true, json: async () => tags.map((t) => ({ ref: `refs/tags/${t}` })) };
      }
      if (String(url).includes("/releases")) return { ok: true, json: async () => releases };
      return { ok: false, status: 404 };
    }),
  );
}

const installerRelease = (version: string) => ({
  tag_name: `draco-slides/v${version}`,
  assets: [
    {
      name: `Draco-Slides-Setup-${version}.exe`,
      browser_download_url: `https://github.com/o/r/releases/download/draco-slides%2Fv${version}/Draco-Slides-Setup-${version}.exe`,
    },
  ],
});

const wrap = (repo: string, userAgent = WIN) =>
  render(
    <AppProvider>
      <ReleaseInfo repo={repo} userAgent={userAgent} />
    </AppProvider>,
  );

describe("ReleaseInfo", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(startDownload).mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the latest GitHub tag, an update hint and Install", async () => {
    mockGithub(["draco-slides/v0.1.0", "draco-slides/v9.9.9"], []);
    wrap("o/r");
    const link = await screen.findByRole("link", { name: "Latest v9.9.9" });
    expect(link).toHaveAttribute("href", "https://github.com/o/r/releases/tag/draco-slides/v9.9.9");
    expect(screen.getByText("Update available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("Install downloads the installer attached to the latest tag", async () => {
    mockGithub(["draco-slides/v9.9.9"], [installerRelease("9.9.9")]);
    wrap("o/r");
    await screen.findByRole("link", { name: "Latest v9.9.9" });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await waitFor(() =>
      expect(startDownload).toHaveBeenCalledWith(
        "https://github.com/o/r/releases/download/draco-slides%2Fv9.9.9/Draco-Slides-Setup-9.9.9.exe",
      ),
    );
    expect(await screen.findByText(/Downloading Draco-Slides-Setup-9\.9\.9\.exe/)).toBeInTheDocument();
  });

  it("opens the release page when the tag has no installer yet", async () => {
    mockGithub(["draco-slides/v9.9.9"], [{ tag_name: "draco-slides/v9.9.9", assets: [] }]);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    wrap("o/r");
    await screen.findByRole("link", { name: "Latest v9.9.9" });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(startDownload).not.toHaveBeenCalled();
    expect(String(open.mock.calls[0][0])).toContain("/releases/tag/draco-slides/v9.9.9");
  });

  it("in the desktop app, shows Update only when a newer tag exists", async () => {
    mockGithub(["draco-slides/v9.9.9"], [installerRelease("9.9.9")]);
    wrap("o/r", `${WIN} Electron/33.2.0`);
    expect(await screen.findByRole("button", { name: "Update" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Install" })).not.toBeInTheDocument();
  });

  it("in the desktop app, shows no button when already on the latest tag", async () => {
    mockGithub([`draco-slides/v${APP_VERSION}`], []);
    wrap("o/r", `${WIN} Electron/33.2.0`);
    await screen.findByRole("link", { name: `Latest v${APP_VERSION}` });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("falls back to this build's version when no repo is configured", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    wrap("");
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back quietly when GitHub is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    wrap("o/r");
    expect(await screen.findByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });
});
