import { afterEach, describe, expect, it } from "vitest";
import { domToText, insertTextAtSelection, placeCaret, textToDom } from "../../src/features/canvas/textDom";

const html = (markup: string) => {
  const el = document.createElement("div");
  el.innerHTML = markup;
  return el;
};

describe("domToText", () => {
  const cases: [string, string, string][] = [
    ["empty", "", ""],
    ["one div per line", "<div>a</div><div>b</div>", "a\nb"],
    ["an empty line between lines", "<div>a</div><div><br></div><div>b</div>", "a\n\nb"],
    ["top-level text then a div", "a<div>b</div>", "a\nb"],
    ["a trailing <br> adds no extra line", "<div>a<br></div>", "a"],
    ["two trailing <br> add one empty line", "<div>a<br><br></div>", "a\n"],
    ["<br> inside a line", "a<br>b", "a\nb"],
    ["a lone <br> is one empty line", "<br>", ""],
    ["an empty line div", "<div><br></div>", ""],
    ["inline elements are flattened", "<div>one<span>two</span><b>three</b></div>", "onetwothree"],
    ["paragraphs", "<p>a</p><p>b</p>", "a\nb"],
    ["nested blocks", "<div><div>a</div><div>b</div></div>", "a\nb"],
    ["non-breaking and zero-width characters", "<div>a\u00a0b\u200bc</div>", "a bc"],
    ["a newline inside a text node (pre-wrap)", "<div>a\nb</div>", "a\nb"],
    ["scripts and styles are ignored", "<div>a<script>x()</script><style>p{}</style>b</div>", "ab"],
    ["leading and trailing spaces are kept", "<div>  a  </div>", "  a  "],
  ];
  for (const [name, markup, expected] of cases) {
    it(name, () => expect(domToText(html(markup))).toBe(expected));
  }
});

describe("list levels in the DOM", () => {
  it("domToText reads data-level as leading tabs", () => {
    expect(domToText(html('<div>a</div><div data-level="1">b</div><div data-level="2">c</div>'))).toBe("a\n\tb\n\t\tc");
  });

  it("empty leveled lines and <br> inside a leveled line keep the level", () => {
    expect(domToText(html('<div data-level="2"><br></div>'))).toBe("\t\t");
    expect(domToText(html('<div data-level="1">a<br>b</div><div>c</div>'))).toBe("\ta\n\tb\nc");
  });

  it("a level only applies inside its own block", () => {
    expect(domToText(html('x<div data-level="1">y</div>z'))).toBe("x\n\ty\nz");
    expect(domToText(html('<div data-level="1"><div>nested</div></div>'))).toBe("\tnested");
  });

  it("clamps and ignores bad levels", () => {
    expect(domToText(html('<div data-level="99">a</div>'))).toBe("\t".repeat(8) + "a");
    expect(domToText(html('<div data-level="abc">a</div>'))).toBe("a");
    expect(domToText(html('<div data-level="-2">a</div>'))).toBe("a");
  });

  it("textToDom sets data-level only above zero", () => {
    const el = document.createElement("div");
    el.appendChild(textToDom("a\n\tb\n\t\t", document));
    expect([...el.children].map((c) => c.getAttribute("data-level"))).toEqual([null, "1", "2"]);
    expect([...el.children].map((c) => c.textContent)).toEqual(["a", "b", ""]);
    expect(el.children[2].querySelector("br")).not.toBeNull();
  });

  it("round-trips outline text", () => {
    for (const t of ["a\n\tb\n\t\tc", "\t\tx", "a\n\t\n\tb", "\t".repeat(9) + "deep", "a\n\n\tb\n"]) {
      const el = document.createElement("div");
      el.appendChild(textToDom(t, document));
      expect(domToText(el), JSON.stringify(t)).toBe(t);
    }
  });
});

describe("textToDom", () => {
  it("builds one div per line with <br> for empty lines", () => {
    const el = document.createElement("div");
    el.appendChild(textToDom("a\n\nb", document));
    expect([...el.children].map((c) => c.className)).toEqual(["rt-line", "rt-line", "rt-line"]);
    expect([...el.children].map((c) => c.textContent)).toEqual(["a", "", "b"]);
    expect(el.children[1].querySelector("br")).not.toBeNull();
  });

  it("normalizes CRLF", () => {
    const el = document.createElement("div");
    el.appendChild(textToDom("a\r\nb", document));
    expect(el.children).toHaveLength(2);
  });

  it("round-trips through domToText", () => {
    for (const t of ["", "a", "a\nb", "a\n\nb", "a\n", "\n", " lead", "trail ", "two  spaces", "x\n\n\ny"]) {
      const el = document.createElement("div");
      el.appendChild(textToDom(t, document));
      expect(domToText(el), JSON.stringify(t)).toBe(t);
    }
  });
});

describe("placeCaret", () => {
  afterEach(() => {
    Reflect.deleteProperty(document, "caretRangeFromPoint");
    Reflect.deleteProperty(document, "caretPositionFromPoint");
    document.body.innerHTML = "";
  });
  const editor = (text: string) => {
    const el = document.createElement("div");
    el.appendChild(textToDom(text, document));
    document.body.appendChild(el);
    return el;
  };
  const sel = () => document.getSelection()!;

  it("defaults to the end of the last line", () => {
    const el = editor("Hello\nWorld");
    placeCaret(el, null);
    expect(sel().rangeCount).toBe(1);
    expect(sel().isCollapsed).toBe(true);
    expect(sel().anchorNode).toBe(el.lastElementChild);
    expect(sel().anchorOffset).toBe(1);
  });

  it("goes before the <br> when the last line is empty", () => {
    const el = editor("Hello\n");
    placeCaret(el, null);
    expect(sel().anchorNode).toBe(el.lastElementChild);
    expect(sel().anchorOffset).toBe(0);
  });

  it("uses the browser's caret lookup when it lands inside the editor", () => {
    const el = editor("Hello\nWorld");
    const range = document.createRange();
    range.setStart(el.firstElementChild!.firstChild!, 2);
    range.collapse(true);
    Object.defineProperty(document, "caretRangeFromPoint", { value: () => range, configurable: true });
    placeCaret(el, { x: 5, y: 5 });
    expect(sel().anchorNode).toBe(el.firstElementChild!.firstChild);
    expect(sel().anchorOffset).toBe(2);
  });

  it("prefers caretPositionFromPoint when available", () => {
    const el = editor("Hello\nWorld");
    const textNode = el.lastElementChild!.firstChild!;
    Object.defineProperty(document, "caretPositionFromPoint", {
      value: () => ({ offsetNode: textNode, offset: 3 }),
      configurable: true,
    });
    placeCaret(el, { x: 5, y: 5 });
    expect(sel().anchorNode).toBe(textNode);
    expect(sel().anchorOffset).toBe(3);
  });

  it("falls back to the end when the lookup lands outside the editor or fails", () => {
    const el = editor("Hello");
    const outside = document.createElement("p");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    const range = document.createRange();
    range.setStart(outside.firstChild!, 1);
    range.collapse(true);
    Object.defineProperty(document, "caretRangeFromPoint", { value: () => range, configurable: true });
    placeCaret(el, { x: 5, y: 5 });
    expect(sel().anchorNode).toBe(el.lastElementChild);
    Object.defineProperty(document, "caretRangeFromPoint", {
      value: () => {
        throw new Error("nope");
      },
      configurable: true,
    });
    placeCaret(el, { x: 5, y: 5 });
    expect(sel().anchorNode).toBe(el.lastElementChild);
  });
});

describe("insertTextAtSelection", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("inserts at the caret and leaves the caret after the text", () => {
    const el = document.createElement("div");
    el.appendChild(textToDom("Hello", document));
    document.body.appendChild(el);
    placeCaret(el, null);
    expect(insertTextAtSelection(el, "!\nBye")).toBe(true);
    expect(domToText(el)).toBe("Hello!\nBye");
    const s = document.getSelection()!;
    expect(s.isCollapsed).toBe(true);
    expect(el.contains(s.anchorNode)).toBe(true);
  });

  it("replaces a selection", () => {
    const el = document.createElement("div");
    el.appendChild(textToDom("Hello", document));
    document.body.appendChild(el);
    const text = el.firstElementChild!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 4);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    insertTextAtSelection(el, "I");
    expect(domToText(el)).toBe("HIo");
  });

  it("refuses when the selection is outside the editor", () => {
    const el = document.createElement("div");
    el.appendChild(textToDom("Hello", document));
    const other = document.createElement("p");
    other.textContent = "x";
    document.body.append(el, other);
    const range = document.createRange();
    range.selectNodeContents(other);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    expect(insertTextAtSelection(el, "no")).toBe(false);
    expect(domToText(el)).toBe("Hello");
  });
});
