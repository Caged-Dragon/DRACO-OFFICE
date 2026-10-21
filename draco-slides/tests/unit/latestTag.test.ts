import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLatestTag,
  isNewer,
  isValidRepo,
  parseVersion,
  pickLatestTag,
  releaseUrl,
} from "../../src/services/release/latestTag";

describe("latestTag", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses only draco-slides tags", () => {
    expect(parseVersion("draco-slides/v0.3.0")).toEqual([0, 3, 0]);
    expect(parseVersion("draco-docs/v0.3.0")).toBeNull();
    expect(parseVersion("draco-slides/vbad")).toBeNull();
  });

  it("orders v0.99.0 < v1.0.0 < v1.01.0 < v1.10.0", () => {
    const names = ["draco-slides/v1.01.0", "draco-slides/v0.99.0", "draco-slides/v1.0.0", "draco-slides/v1.10.0"];
    expect(pickLatestTag(names)?.label).toBe("v1.10.0");
    expect(pickLatestTag(names.slice(0, 3))?.label).toBe("v1.01.0");
  });

  it("returns null when there are no valid tags", () => {
    expect(pickLatestTag(["draco-docs/v9.0.0", ""])).toBeNull();
  });

  it("detects a newer tag than the build", () => {
    expect(isNewer("draco-slides/v0.4.0", "0.3.0")).toBe(true);
    expect(isNewer("draco-slides/v0.3.0", "0.3.0")).toBe(false);
  });

  it("validates repos and builds release URLs", () => {
    expect(isValidRepo("owner/name")).toBe(true);
    expect(isValidRepo("owner")).toBe(false);
    expect(isValidRepo("https://github.com/a/b")).toBe(false);
    expect(releaseUrl("o/r", "draco-slides/v0.3.0")).toBe("https://github.com/o/r/releases/tag/draco-slides/v0.3.0");
    expect(releaseUrl("o/r")).toBe("https://github.com/o/r/releases");
  });

  it("fetches and picks the latest tag from GitHub's matching-refs response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ ref: "refs/tags/draco-slides/v0.2.0" }, { ref: "refs/tags/draco-slides/v0.3.0" }],
    });
    vi.stubGlobal("fetch", fetchMock);
    expect((await fetchLatestTag("o/r"))?.tag).toBe("draco-slides/v0.3.0");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/repos/o/r/git/matching-refs/tags/draco-slides/v");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchLatestTag("o/r")).rejects.toThrow("404");
  });
});
