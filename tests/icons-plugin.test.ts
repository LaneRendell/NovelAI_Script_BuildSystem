import { describe, it, expect } from "vitest";
import { join } from "path";
import { rollup } from "rollup";
import { iconsPlugin } from "../src/plugins/icons";

const fixtures = join(__dirname, "fixtures");

async function build(entry: string): Promise<string> {
  const bundle = await rollup({
    input: join(fixtures, entry),
    plugins: [iconsPlugin()],
  });
  const { output } = await bundle.generate({ format: "es" });
  await bundle.close();
  return output[0].code;
}

describe("iconsPlugin", () => {
  it("bundles only the imported icons and references a global h", async () => {
    const code = await build("two-icons-entry.js");
    expect(code).toContain("Zap");
    expect(code).toContain("Edit");
    // Tree-shaking dropped an unimported icon:
    expect(code).not.toContain("Activity");
    // References the runtime global h, never imports it:
    expect(code).toMatch(/h\(/);
    expect(code).not.toMatch(/import[^\n]*\bh\b/);
  });

  it("fails the build for an unknown iconset", async () => {
    await expect(build("bogus-entry.js")).rejects.toThrow(
      /Unknown iconset 'bogus'\. Available: feather/,
    );
  });
});
