import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { parseSvgFragment } from "./parse-svg";
import { IconData, IconSetProvider } from "./types";

function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// Anchor on package.json so the resolution works regardless of any
// "exports" map on the feather-icons package.
function featherIconsJsonPath(): string {
  const pkgJson = require.resolve("feather-icons/package.json");
  return join(dirname(pkgJson), "dist", "icons.json");
}

export const featherProvider: IconSetProvider = {
  name: "feather",
  async load(): Promise<Map<string, IconData>> {
    const raw = await readFile(featherIconsJsonPath(), "utf-8");
    const icons = JSON.parse(raw) as Record<string, string>;
    const result = new Map<string, IconData>();
    for (const [kebabName, contents] of Object.entries(icons)) {
      let children;
      try {
        children = parseSvgFragment(contents);
      } catch (err) {
        throw new Error(
          `feather icon '${kebabName}': ${(err as Error).message}`,
        );
      }
      result.set(toPascalCase(kebabName), { viewBox: "0 0 24 24", children });
    }
    return result;
  },
};
