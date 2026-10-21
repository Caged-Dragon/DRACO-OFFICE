import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "../../src/app/version";
import { ReleaseInfo } from "../../src/features/release/ReleaseInfo";
import { AppProvider } from "../../src/state/AppContext";

const wrap = (repo: string) =>
  render(
    <AppProvider>
      <ReleaseInfo repo={repo} />
    </AppProvider>,
  );

describe("ReleaseInfo", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("shows the latest GitHub tag and an Install button", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ ref: "refs/tags/draco-slides/v0.1.0" }, { ref: "refs/tags/draco-slides/v9.9.9" }],
      }),
    );
    wrap("o/r");
    const link = await screen.findByRole("link", { name: "Latest v9.9.9" });
    expect(link).toHaveAttribute("href", "https://github.com/o/r/releases/tag/draco-slides/v9.9.9");
    expect(screen.getByText("Update available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
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
