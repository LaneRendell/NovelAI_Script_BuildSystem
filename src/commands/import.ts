import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path/posix";
import { parseDocument } from "yaml";
import { format } from "prettier";
import { writeTsConfig } from "../utils";

const FRONTMATTER = /\/\*---\n([\s\S]+)---\*\/([\s\S]+)/;

export async function importNaiscript(filePath: string) {
  const naiScriptBuf = await readFile(filePath);
  const naiScript = naiScriptBuf.toString();
  const matches = FRONTMATTER.exec(naiScript);
  if (!matches) throw new Error("Unable to parse naiscript.");

  const frontMatter = parseDocument(matches[1]);
  const script = matches[2];
  const formattedScript = await format(script, { parser: "typescript" });
  const name = frontMatter.get("name") as string;
  const projectDir = join(dirname(filePath), kebab(name));
  await mkdir(join(projectDir, "src"), { recursive: true });
  await writeFile(join(projectDir, "project.yaml"), frontMatter.toString());
  await writeFile(join(projectDir, "src", "index.ts"), formattedScript);
  await writeTsConfig(projectDir);
}

// Helpers
function kebab(a: string): string {
  return a.toLocaleLowerCase().replaceAll(/\W/g, "-").replaceAll(/-+/g, "-");
}
