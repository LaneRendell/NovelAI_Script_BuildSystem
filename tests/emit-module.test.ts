import { describe, it, expect } from "vitest";
import ts from "typescript";
import { emitModule } from "../src/plugins/icons/emit-module";
import { IconData } from "../src/plugins/icons/types";

const sample = new Map<string, IconData>([
  [
    "Zap",
    {
      viewBox: "0 0 24 24",
      children: [
        { tag: "polygon", attrs: { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" } },
      ],
    },
  ],
  [
    "Circle",
    { viewBox: "0 0 24 24", children: [{ tag: "circle", attrs: { cx: "12", cy: "12", r: "10" } }] },
  ],
]);

describe("emitModule", () => {
  it("produces syntactically valid ESM", () => {
    const code = emitModule(sample);
    const out = ts.transpileModule(code, {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2021,
      },
    });
    expect(out.diagnostics ?? []).toHaveLength(0);
  });

  it("emits one export per icon and never imports h", () => {
    const code = emitModule(sample);
    expect(code).toContain("export const Zap = ");
    expect(code).toContain("export const Circle = ");
    expect(code).toMatch(/h\("svg"/);
    expect(code).not.toMatch(/import[^\n]*\bh\b/);
  });

  it("defaults width/height to 16 (NAI UI default), matching the runtime", () => {
    const code = emitModule(sample);
    expect(code).toContain("width: size ?? 16");
    expect(code).toContain("height: size ?? 16");
  });

  it("matches the Zap factory snapshot", () => {
    const code = emitModule(sample);
    const zapLine = code.split("\n").find((l) => l.startsWith("export const Zap"));
    expect(zapLine).toMatchInlineSnapshot(
      `"export const Zap = /*#__PURE__*/ make("0 0 24 24", () => [h("polygon", {"points":"13 2 3 14 12 14 11 22 21 10 12 10 13 2"})]);"`,
    );
  });
});
