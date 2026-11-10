import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const path = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string) => readFileSync(path(p));
const PNG = "89504e470d0a1a0a";
const pngSize = (p: string): [number, number] => {
  const b = read(p);
  expect(b.subarray(0, 8).toString("hex"), `${p} is a PNG`).toBe(PNG);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe("logo and icons", () => {
  it("keeps the master logo in the codebase as a square PNG of at least 512 px", () => {
    const [w, h] = pngSize("public/logo.png");
    expect(w).toBe(h);
    expect(w).toBeGreaterThanOrEqual(512);
  });

  it("has every derived icon at its exact size", () => {
    const expected: Record<string, number> = {
      "public/icons/icon-512.png": 512,
      "public/icons/icon-192.png": 192,
      "public/apple-touch-icon.png": 180,
      "public/favicon-32.png": 32,
      "public/favicon-16.png": 16,
      "build/icon.png": 512,
      "src/assets/logo.png": 128,
    };
    for (const [file, size] of Object.entries(expected)) expect(pngSize(file), file).toEqual([size, size]);
  });

  it("has a favicon.ico with 16, 32 and 48 px images", () => {
    const b = read("public/favicon.ico");
    expect(b.readUInt16LE(0)).toBe(0); // reserved
    expect(b.readUInt16LE(2)).toBe(1); // icon type
    const count = b.readUInt16LE(4);
    expect(count).toBe(3);
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16;
      sizes.push(b[entry]);
      const length = b.readUInt32LE(entry + 8);
      const offset = b.readUInt32LE(entry + 12);
      expect(b.subarray(offset, offset + 8).toString("hex")).toBe(PNG);
      expect(offset + length).toBeLessThanOrEqual(b.length);
    }
    expect(sizes).toEqual([16, 32, 48]);
  });

  it("the web app manifest points at icons that exist and have the declared size", () => {
    const manifest = JSON.parse(read("public/manifest.webmanifest").toString("utf-8")) as { icons: { src: string; sizes: string }[] };
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(`public${icon.src}`), icon.src).toEqual([w, h]);
    }
  });

  it("index.html links the favicon and touch icon, all of which exist, and no longer uses the old SVG", () => {
    const html = read("index.html").toString("utf-8");
    const hrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(expect.arrayContaining(["/favicon.ico", "/favicon-32.png", "/favicon-16.png", "/apple-touch-icon.png"]));
    for (const href of hrefs) expect(existsSync(path(`public${href}`)), href).toBe(true);
    expect(html).not.toContain("favicon.svg");
    expect(existsSync(path("public/favicon.svg"))).toBe(false);
  });

  it("the desktop app uses the logo as its window and installer icon", () => {
    expect(readFileSync(path("desktop/main.cjs"), "utf-8")).toContain('"build", "icon.png"');
    expect(existsSync(path("build/icon.png"))).toBe(true);
  });

  it("can be regenerated from the master logo", () => {
    expect(existsSync(path("scripts/generate-icons.py"))).toBe(true);
  });
});
