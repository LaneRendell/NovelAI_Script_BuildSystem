import { describe, it, expect } from "vitest";
import { parseSvgFragment } from "./parse-svg";

describe("parseSvgFragment", () => {
  it("parses a self-closing element with attributes", () => {
    const nodes = parseSvgFragment(
      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
    );
    expect(nodes).toEqual([
      { tag: "polygon", attrs: { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" } },
    ]);
  });

  it("parses multiple mixed self-closing and open/close elements", () => {
    const nodes = parseSvgFragment(
      '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"></line>',
    );
    expect(nodes).toEqual([
      { tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } },
      { tag: "line", attrs: { x1: "12", y1: "8", x2: "12", y2: "16" } },
    ]);
  });

  it("throws on a non-whitelisted element", () => {
    expect(() => parseSvgFragment('<script>alert(1)</script>')).toThrow(
      "Unsupported SVG element 'script' in icon fragment",
    );
  });
});
